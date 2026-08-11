-- =============================================================
-- VALO EDUCATION ECOSYSTEM — Stored Functions & Scheduled Jobs
-- Reference: PRODUCT_SPECIFICATION_v2.md §7.3
-- =============================================================

-- -------------------------------------------------------------
-- sp_rollover_daily_vault()
-- Atomic + idempotent daily vault roll-over job.
-- Moves unused pagu remainder into student_vault at 23:59 WIB.
-- Idempotent: only processes students where daily_limit_reset_at = current_date
-- so safe to re-run if scheduler retries.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sp_rollover_daily_vault()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Step 1: Add unused pagu to vault_balance
  UPDATE public.student_vault sv
  SET
    vault_balance = vault_balance + GREATEST(0, (s.daily_limit - s.daily_limit_used)),
    updated_at    = now()
  FROM public.students s
  WHERE sv.student_id = s.id
    AND s.daily_limit_reset_at = CURRENT_DATE;

  -- Step 2: Reset daily usage + advance reset date to tomorrow
  UPDATE public.students
  SET
    daily_limit_used         = 0,
    emergency_used_today     = false,
    daily_limit_reset_at     = CURRENT_DATE + 1
  WHERE daily_limit_reset_at = CURRENT_DATE;

  -- Step 3: Log the rollover event in audit_log
  INSERT INTO public.audit_log (action, entity_type, metadata)
  VALUES (
    'DAILY_VAULT_ROLLOVER',
    'system',
    jsonb_build_object('rolled_at', now(), 'trigger', 'pg_cron')
  );
END;
$$;

-- -------------------------------------------------------------
-- Schedule via pg_cron (Supabase Cron extension)
-- 23:59 WIB = 16:59 UTC
-- -------------------------------------------------------------
SELECT cron.schedule(
  'rollover-vault-2359-wib',
  '59 16 * * *',
  $$SELECT public.sp_rollover_daily_vault();$$
);

-- -------------------------------------------------------------
-- sp_flag_frequent_overdraft()
-- Weekly anomaly detection — flags students with >2 overdrafts in 7 days.
-- Reference: PRODUCT_SPECIFICATION_v2.md §2.4, §12.5
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sp_flag_frequent_overdraft()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rec RECORD;
BEGIN
  -- Count overdraft transactions per student in last 7 days
  FOR rec IN
    SELECT
      student_id,
      COUNT(*) AS overdraft_count
    FROM public.canteen_transactions
    WHERE
      is_emergency   = true
      AND status     IN ('SETTLED_OVERDRAFT', 'COMPLETED')
      AND created_at >= now() - INTERVAL '7 days'
    GROUP BY student_id
    HAVING COUNT(*) > 2
  LOOP
    -- Update student overdraft counter
    UPDATE public.students
    SET emergency_overdraft_count_7d = rec.overdraft_count
    WHERE id = rec.student_id;

    -- Write audit flag
    INSERT INTO public.audit_log (action, entity_type, entity_id, flag, metadata)
    VALUES (
      'OVERDRAFT_ANOMALY_DETECTED',
      'students',
      rec.student_id,
      'FREQUENT_OVERDRAFT',
      jsonb_build_object(
        'overdraft_count_7d', rec.overdraft_count,
        'flagged_at', now()
      )
    );
  END LOOP;
END;
$$;

-- Schedule weekly anomaly scan — every Monday 07:00 WIB = 00:00 UTC
SELECT cron.schedule(
  'flag-frequent-overdraft-weekly',
  '0 0 * * 1',
  $$SELECT public.sp_flag_frequent_overdraft();$$
);

-- -------------------------------------------------------------
-- sp_cleanup_expired_idempotency_keys()
-- Purge idempotency keys past their 24-hour expiry.
-- Reference: PRODUCT_SPECIFICATION_v2.md §7.2
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sp_cleanup_expired_idempotency_keys()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.idempotency_keys
  WHERE expires_at < now();
END;
$$;

-- Run daily at 02:00 UTC
SELECT cron.schedule(
  'cleanup-idempotency-keys-daily',
  '0 2 * * *',
  $$SELECT public.sp_cleanup_expired_idempotency_keys();$$
);
