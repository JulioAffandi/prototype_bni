-- =============================================================
-- VALO EDUCATION ECOSYSTEM — FULL DATABASE SCHEMA DUMP v2.0
-- Target: Supabase PostgreSQL 15+
-- Generated: 2026-08-13
-- Combined schema from migrations: 001_core_schema, 002_rls_policies, 003_functions
-- =============================================================

-- =============================================================
-- EXTENSIONS & INITIAL SETUP
-- =============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------
-- 1. SCHOOLS (tenant root)
-- -------------------------------------------------------------
CREATE TABLE public.schools (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               VARCHAR NOT NULL,
  npsn               VARCHAR UNIQUE,                       -- Nomor Pokok Sekolah Nasional
  bni_giro_account   VARCHAR NOT NULL,
  address            TEXT,
  status             VARCHAR NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','suspended','offboarded')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- 2. PARENTS
-- -------------------------------------------------------------
CREATE TABLE public.parents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id       UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name          VARCHAR NOT NULL,
  phone_number       VARCHAR NOT NULL UNIQUE,
  phone_verified     BOOLEAN NOT NULL DEFAULT false,
  email              VARCHAR,
  bni_account_number VARCHAR NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- 3. PROFILES (auth.users <-> role & tenant binding)
-- -------------------------------------------------------------
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        VARCHAR NOT NULL
    CHECK (role IN ('parent','school_admin','merchant_staff','platform_admin')),
  school_id   UUID REFERENCES public.schools(id),
  parent_id   UUID REFERENCES public.parents(id),
  merchant_id UUID,                                        -- FK added after merchants table
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- 4. MERCHANTS
-- -------------------------------------------------------------
CREATE TABLE public.merchants (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             UUID NOT NULL REFERENCES public.schools(id),
  name                  VARCHAR NOT NULL,
  pic_name              VARCHAR,
  bni_merchant_account  VARCHAR NOT NULL,
  status                VARCHAR NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','suspended')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_merchant
    FOREIGN KEY (merchant_id) REFERENCES public.merchants(id);

-- -------------------------------------------------------------
-- 5. STUDENTS
-- nfc_uid stored as HASH only — never plaintext (§11.2)
-- -------------------------------------------------------------
CREATE TABLE public.students (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name                    VARCHAR NOT NULL,
  school_id                    UUID NOT NULL REFERENCES public.schools(id),
  nfc_uid_hash                 VARCHAR NOT NULL UNIQUE,    -- SHA-256(UID + per-tenant salt)
  nfc_uid_last4                VARCHAR(4),                 -- display/CS verification only
  daily_limit                  NUMERIC(12,2) NOT NULL DEFAULT 20000,
  daily_limit_used             NUMERIC(12,2) NOT NULL DEFAULT 0,
  daily_limit_reset_at         DATE NOT NULL DEFAULT CURRENT_DATE,
  emergency_approve            BOOLEAN NOT NULL DEFAULT true,
  emergency_limit              NUMERIC(12,2) NOT NULL DEFAULT 15000,
  emergency_used_today         BOOLEAN NOT NULL DEFAULT false,
  emergency_overdraft_count_7d INT NOT NULL DEFAULT 0,
  card_status                  VARCHAR NOT NULL DEFAULT 'active'
    CHECK (card_status IN ('active','lost_reported','blocked','graduated','transferred_out')),
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_students_school ON public.students(school_id);

-- -------------------------------------------------------------
-- 6. GUARDIAN_STUDENT_MAP (many-to-many parent <-> student)
-- -------------------------------------------------------------
CREATE TABLE public.guardian_student_map (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id           UUID NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  student_id          UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  relationship        VARCHAR DEFAULT 'orang_tua',
  is_primary_guardian BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_id, student_id)
);

CREATE INDEX idx_gsm_student ON public.guardian_student_map(student_id);
CREATE INDEX idx_gsm_parent  ON public.guardian_student_map(parent_id);

-- -------------------------------------------------------------
-- 7. STUDENT_VAULT (Savings from daily pagu remainder)
-- -------------------------------------------------------------
CREATE TABLE public.student_vault (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id           UUID NOT NULL UNIQUE REFERENCES public.students(id) ON DELETE CASCADE,
  vault_balance        NUMERIC(12,2) NOT NULL DEFAULT 0,
  savings_goal_name    VARCHAR DEFAULT 'Sepatu Baru',
  savings_goal_target  NUMERIC(12,2) DEFAULT 300000,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- 8. CANTEEN_TRANSACTIONS
-- -------------------------------------------------------------
CREATE TABLE public.canteen_transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            UUID NOT NULL REFERENCES public.students(id),
  merchant_id           UUID NOT NULL REFERENCES public.merchants(id),
  amount                NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status                VARCHAR NOT NULL DEFAULT 'INITIATED'
    CHECK (status IN (
      'INITIATED','SETTLED','SETTLED_OVERDRAFT','REJECTED_OVERLIMIT',
      'OFFLINE_QUEUED','PENDING_SYNC','REJECTED_POST_HOC','COMPLETED'
    )),
  is_emergency          BOOLEAN NOT NULL DEFAULT false,
  idempotency_key       UUID NOT NULL UNIQUE,
  client_local_tx_uuid  UUID,                              -- offline-queue origin tracking (§8)
  settlement_batch_id   UUID,
  items                 JSONB,                             -- menu items snapshot
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ctx_student  ON public.canteen_transactions(student_id);
CREATE INDEX idx_ctx_merchant ON public.canteen_transactions(merchant_id, created_at);
CREATE INDEX idx_ctx_batch    ON public.canteen_transactions(settlement_batch_id);

-- -------------------------------------------------------------
-- 9. SPP_INVOICES
-- -------------------------------------------------------------
CREATE TABLE public.spp_invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES public.students(id),
  school_id         UUID NOT NULL REFERENCES public.schools(id),
  period            VARCHAR NOT NULL,                      -- format 'YYYY-MM'
  amount            NUMERIC(12,2) NOT NULL,
  status            VARCHAR NOT NULL DEFAULT 'UNPAID'
    CHECK (status IN ('UNPAID','PAID','FAILED','OVERDUE')),
  retry_count       INT NOT NULL DEFAULT 0,
  due_date          DATE NOT NULL,
  paid_at           TIMESTAMPTZ,
  bni_h2h_reference VARCHAR,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, period)
);

CREATE INDEX idx_spp_school_period ON public.spp_invoices(school_id, period);

-- -------------------------------------------------------------
-- 10. WALLET_LEDGER (double-entry, internal)
-- No direct client access — mutations only via service_role in Edge Functions
-- -------------------------------------------------------------
CREATE TABLE public.wallet_ledger (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type     VARCHAR NOT NULL
    CHECK (account_type IN ('parent','student_vault','merchant','school_escrow')),
  account_ref_id   UUID NOT NULL,
  entry_type       VARCHAR NOT NULL CHECK (entry_type IN ('DEBIT','CREDIT')),
  amount           NUMERIC(12,2) NOT NULL,
  balance_after    NUMERIC(12,2) NOT NULL,
  reference_table  VARCHAR NOT NULL,                       -- e.g. 'canteen_transactions'
  reference_id     UUID NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ledger_account ON public.wallet_ledger(account_type, account_ref_id);

-- -------------------------------------------------------------
-- 11. IDEMPOTENCY_KEYS
-- -------------------------------------------------------------
CREATE TABLE public.idempotency_keys (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key               UUID NOT NULL UNIQUE,
  endpoint          VARCHAR NOT NULL,
  response_snapshot JSONB,
  status            VARCHAR NOT NULL DEFAULT 'PROCESSING'
    CHECK (status IN ('PROCESSING','COMPLETED','FAILED')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

-- -------------------------------------------------------------
-- 12. OFFLINE_SYNC_QUEUE (POS offline sync audit trail — §8)
-- -------------------------------------------------------------
CREATE TABLE public.offline_sync_queue (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id   UUID NOT NULL REFERENCES public.merchants(id),
  local_tx_uuid UUID NOT NULL UNIQUE,
  payload       JSONB NOT NULL,
  sync_status   VARCHAR NOT NULL DEFAULT 'PENDING'
    CHECK (sync_status IN ('PENDING','SYNCED','CONFLICT','DISCARDED')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at     TIMESTAMPTZ
);

-- -------------------------------------------------------------
-- 13. CARD_LIFECYCLE_EVENTS (§12.1)
-- -------------------------------------------------------------
CREATE TABLE public.card_lifecycle_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES public.students(id),
  event_type       VARCHAR NOT NULL
    CHECK (event_type IN ('issued','lost_reported','blocked','reissued','offboarded')),
  notes            TEXT,
  actor_profile_id UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- 14. PARENTAL_CONSENT (UU PDP — §11.1)
-- -------------------------------------------------------------
CREATE TABLE public.parental_consent (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id     UUID NOT NULL REFERENCES public.parents(id),
  student_id    UUID NOT NULL REFERENCES public.students(id),
  consent_type  VARCHAR NOT NULL DEFAULT 'DATA_PROCESSING_MINOR',
  consent_token VARCHAR NOT NULL,
  granted_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- 15. AUDIT_LOG (compliance & forensics)
-- -------------------------------------------------------------
CREATE TABLE public.audit_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_profile_id UUID REFERENCES public.profiles(id),
  action           VARCHAR NOT NULL,
  entity_type      VARCHAR NOT NULL,
  entity_id        UUID,
  metadata         JSONB,
  flag             VARCHAR,                                -- e.g. 'FREQUENT_OVERDRAFT'
  ip_address       INET,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- 16. AI_CHAT_LOGS (AI output audit — §10.4)
-- -------------------------------------------------------------
CREATE TABLE public.ai_chat_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_type     VARCHAR NOT NULL
    CHECK (persona_type IN ('merchant_ai','school_treasury_ai','parent_ai')),
  actor_profile_id UUID REFERENCES public.profiles(id),
  prompt           TEXT NOT NULL,
  response         TEXT NOT NULL,
  function_calls   JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- HELPER FUNCTIONS (SECURITY DEFINER)
-- =============================================================
CREATE OR REPLACE FUNCTION public.current_profile()
RETURNS public.profiles
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS varchar LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_school_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_parent_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT parent_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_merchant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT merchant_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'platform_admin'
  );
$$;

-- =============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================
ALTER TABLE public.schools               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchants             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_student_map  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_vault         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canteen_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spp_invoices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_sync_queue    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parental_consent      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_logs          ENABLE ROW LEVEL SECURITY;

-- POLICIES: PROFILES
CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_platform_admin());

-- POLICIES: SCHOOLS
CREATE POLICY "schools_admin_select" ON public.schools
  FOR SELECT USING (id = public.current_school_id() OR public.is_platform_admin());

-- POLICIES: STUDENTS
CREATE POLICY "students_school_admin_select" ON public.students
  FOR SELECT USING (
    public.current_role() = 'school_admin'
    AND school_id = public.current_school_id()
  );

CREATE POLICY "students_parent_select" ON public.students
  FOR SELECT USING (
    public.current_role() = 'parent'
    AND id IN (
      SELECT student_id FROM public.guardian_student_map
      WHERE parent_id = public.current_parent_id()
    )
  );

CREATE POLICY "students_merchant_select" ON public.students
  FOR SELECT USING (
    public.current_role() = 'merchant_staff'
    AND school_id = (
      SELECT school_id FROM public.merchants WHERE id = public.current_merchant_id()
    )
  );

CREATE POLICY "students_platform_admin_all" ON public.students
  FOR ALL USING (public.is_platform_admin());

-- POLICIES: STUDENT_VAULT
CREATE POLICY "vault_parent_select" ON public.student_vault
  FOR SELECT USING (
    student_id IN (
      SELECT student_id FROM public.guardian_student_map
      WHERE parent_id = public.current_parent_id()
    )
  );

CREATE POLICY "vault_parent_update_goal" ON public.student_vault
  FOR UPDATE USING (
    student_id IN (
      SELECT student_id FROM public.guardian_student_map
      WHERE parent_id = public.current_parent_id()
    )
  )
  WITH CHECK (
    student_id IN (
      SELECT student_id FROM public.guardian_student_map
      WHERE parent_id = public.current_parent_id()
    )
  );

-- POLICIES: CANTEEN_TRANSACTIONS
CREATE POLICY "ctx_merchant_own" ON public.canteen_transactions
  FOR SELECT USING (merchant_id = public.current_merchant_id());

CREATE POLICY "ctx_merchant_insert" ON public.canteen_transactions
  FOR INSERT WITH CHECK (merchant_id = public.current_merchant_id());

CREATE POLICY "ctx_parent_select" ON public.canteen_transactions
  FOR SELECT USING (
    student_id IN (
      SELECT student_id FROM public.guardian_student_map
      WHERE parent_id = public.current_parent_id()
    )
  );

CREATE POLICY "ctx_school_admin_select" ON public.canteen_transactions
  FOR SELECT USING (
    student_id IN (
      SELECT id FROM public.students WHERE school_id = public.current_school_id()
    )
  );

-- POLICIES: SPP_INVOICES
CREATE POLICY "spp_parent_select" ON public.spp_invoices
  FOR SELECT USING (
    student_id IN (
      SELECT student_id FROM public.guardian_student_map
      WHERE parent_id = public.current_parent_id()
    )
  );

CREATE POLICY "spp_school_admin_all" ON public.spp_invoices
  FOR SELECT USING (school_id = public.current_school_id());

-- POLICIES: WALLET_LEDGER
CREATE POLICY "ledger_platform_admin_only" ON public.wallet_ledger
  FOR SELECT USING (public.is_platform_admin());

-- POLICIES: OFFLINE_SYNC_QUEUE
CREATE POLICY "osq_merchant_own" ON public.offline_sync_queue
  FOR ALL USING (merchant_id = public.current_merchant_id())
  WITH CHECK (merchant_id = public.current_merchant_id());

-- POLICIES: CARD_LIFECYCLE_EVENTS & PARENTAL_CONSENT
CREATE POLICY "card_events_parent_select" ON public.card_lifecycle_events
  FOR SELECT USING (
    student_id IN (
      SELECT student_id FROM public.guardian_student_map
      WHERE parent_id = public.current_parent_id()
    )
  );

CREATE POLICY "card_events_school_admin_select" ON public.card_lifecycle_events
  FOR SELECT USING (
    student_id IN (
      SELECT id FROM public.students WHERE school_id = public.current_school_id()
    )
  );

CREATE POLICY "consent_parent_own" ON public.parental_consent
  FOR ALL USING (parent_id = public.current_parent_id())
  WITH CHECK (parent_id = public.current_parent_id());

-- POLICIES: AUDIT_LOG & AI_CHAT_LOGS
CREATE POLICY "audit_platform_admin_select" ON public.audit_log
  FOR SELECT USING (public.is_platform_admin());

CREATE POLICY "audit_school_admin_scoped" ON public.audit_log
  FOR SELECT USING (
    public.current_role() = 'school_admin'
    AND metadata->>'school_id' = public.current_school_id()::text
  );

CREATE POLICY "ai_logs_own_persona" ON public.ai_chat_logs
  FOR SELECT USING (
    actor_profile_id = auth.uid() OR public.is_platform_admin()
  );

-- POLICIES: GUARDIAN_STUDENT_MAP
CREATE POLICY "gsm_parent_select" ON public.guardian_student_map
  FOR SELECT USING (parent_id = public.current_parent_id());

CREATE POLICY "gsm_school_admin_select" ON public.guardian_student_map
  FOR SELECT USING (
    student_id IN (
      SELECT id FROM public.students WHERE school_id = public.current_school_id()
    )
  );

-- POLICIES: PARENTS
CREATE POLICY "parents_self_select" ON public.parents
  FOR SELECT USING (id = public.current_parent_id() OR public.is_platform_admin());

CREATE POLICY "parents_self_update" ON public.parents
  FOR UPDATE USING (id = public.current_parent_id())
  WITH CHECK (id = public.current_parent_id());

-- POLICIES: MERCHANTS
CREATE POLICY "merchants_staff_select" ON public.merchants
  FOR SELECT USING (
    id = public.current_merchant_id()
    OR school_id = public.current_school_id()
    OR public.is_platform_admin()
  );

-- =============================================================
-- STORED FUNCTIONS & SCHEDULED CRON JOBS
-- =============================================================

-- -------------------------------------------------------------
-- sp_rollover_daily_vault()
-- Atomic + idempotent daily vault roll-over job (23:59 WIB)
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

-- Schedule via pg_cron: 23:59 WIB = 16:59 UTC
SELECT cron.schedule(
  'rollover-vault-2359-wib',
  '59 16 * * *',
  $$SELECT public.sp_rollover_daily_vault();$$
);

-- -------------------------------------------------------------
-- sp_flag_frequent_overdraft()
-- Weekly anomaly detection — flags students with >2 overdrafts in 7 days
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sp_flag_frequent_overdraft()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rec RECORD;
BEGIN
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
    UPDATE public.students
    SET emergency_overdraft_count_7d = rec.overdraft_count
    WHERE id = rec.student_id;

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

-- Schedule weekly anomaly scan: Mon 07:00 WIB = Mon 00:00 UTC
SELECT cron.schedule(
  'flag-frequent-overdraft-weekly',
  '0 0 * * 1',
  $$SELECT public.sp_flag_frequent_overdraft();$$
);

-- -------------------------------------------------------------
-- sp_cleanup_expired_idempotency_keys()
-- Purge idempotency keys past their 24-hour expiry
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sp_cleanup_expired_idempotency_keys()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.idempotency_keys
  WHERE expires_at < now();
END;
$$;

-- Schedule daily cleanup at 02:00 UTC
SELECT cron.schedule(
  'cleanup-idempotency-keys-daily',
  '0 2 * * *',
  $$SELECT public.sp_cleanup_expired_idempotency_keys();$$
);
