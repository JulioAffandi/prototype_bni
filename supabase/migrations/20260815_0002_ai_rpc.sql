-- migrations/20260815_0002_ai_rpc.sql
BEGIN;

-- -----------------------------------------------------------------
-- 2.3.1 Escrow sekolah (Membaca ledger Schema v3)
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_school_escrow_summary()
RETURNS TABLE (
  net_balance      numeric,
  total_credit     numeric,
  total_debit      numeric,
  entry_count      bigint,
  last_entry_at    timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    coalesce(la.balance, 0)::numeric,
    coalesce(sum(CASE WHEN le.signed_amount > 0 THEN le.signed_amount ELSE 0 END), 0)::numeric,
    coalesce(sum(CASE WHEN le.signed_amount < 0 THEN abs(le.signed_amount) ELSE 0 END), 0)::numeric,
    count(le.id),
    max(le.created_at)
  FROM public.ledger_accounts la
  LEFT JOIN public.ledger_entries le ON le.account_id = la.id
  WHERE la.account_type = 'school_escrow'
    AND la.owner_school_id = ANY (public.auth_school_ids())
  GROUP BY la.id, la.balance;
$$;

REVOKE ALL     ON FUNCTION public.rpc_school_escrow_summary() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_school_escrow_summary() TO authenticated;

-- -----------------------------------------------------------------
-- 2.3.2 Metrik penjualan harian merchant
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_merchant_daily_metrics(p_business_date date)
RETURNS TABLE (
  gross_revenue      numeric,
  transaction_count  bigint,
  avg_ticket         numeric,
  emergency_count    bigint,
  rejected_count     bigint,
  estimated_cogs     numeric,
  cogs_coverage_pct  numeric,
  peak_hour          smallint,
  peak_hour_count    bigint
)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH tx AS (
    SELECT ct.id, ct.amount, ct.is_emergency, ct.status, ct.created_at
    FROM public.canteen_transactions ct
    WHERE ct.merchant_id = ANY (public.auth_merchant_ids())
      AND ct.business_date = p_business_date
  ),
  ok AS (SELECT * FROM tx WHERE status IN ('SETTLED')),
  jam AS (
    SELECT extract(hour FROM (created_at AT TIME ZONE 'Asia/Jakarta'))::smallint AS h,
           count(*) AS c
    FROM ok GROUP BY 1 ORDER BY c DESC LIMIT 1
  ),
  hpp AS (
    SELECT
      coalesce(sum(cti.unit_cost_snapshot * cti.qty), 0) AS cogs,
      CASE WHEN count(*) = 0 THEN 0
           ELSE round(100.0 * count(cti.unit_cost_snapshot) / count(*), 1) END AS coverage
    FROM public.canteen_transaction_items cti
    JOIN ok ON ok.id = cti.transaction_id
  )
  SELECT
    coalesce((SELECT sum(amount) FROM ok), 0)::numeric,
    (SELECT count(*) FROM ok)::bigint,
    coalesce((SELECT round(avg(amount)) FROM ok), 0)::numeric,
    (SELECT count(*) FROM ok WHERE is_emergency)::bigint,
    (SELECT count(*) FROM tx WHERE status IN ('REJECTED_OVERLIMIT','REJECTED_CARD_BLOCKED','REJECTED_POST_HOC'))::bigint,
    (SELECT cogs FROM hpp)::numeric,
    (SELECT coverage FROM hpp)::numeric,
    (SELECT h FROM jam)::smallint,
    (SELECT c FROM jam)::bigint;
$$;

-- -----------------------------------------------------------------
-- 2.3.3 Menu terlaris
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_merchant_top_items(p_days int, p_limit int)
RETURNS TABLE (
  item_name    varchar,
  category     varchar,
  qty_sold     bigint,
  revenue      numeric,
  stock_left   integer
)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT
    cti.item_name_snapshot::varchar,
    cti.category_snapshot::varchar,
    sum(cti.qty)::bigint,
    sum(cti.line_total)::numeric,
    max(mi.stock_qty)::integer
  FROM public.canteen_transaction_items cti
  JOIN public.canteen_transactions ct ON ct.id = cti.transaction_id
  LEFT JOIN public.menu_items mi ON mi.id = cti.menu_item_id
  WHERE ct.merchant_id = ANY (public.auth_merchant_ids())
    AND ct.status = 'SETTLED'
    AND ct.created_at >= now() - make_interval(days => greatest(1, least(p_days, 90)))
  GROUP BY 1, 2
  ORDER BY 3 DESC
  LIMIT greatest(1, least(p_limit, 20));
$$;

-- -----------------------------------------------------------------
-- 2.3.4 Rekap belanja anak per kategori
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_child_spending_by_category(
  p_student_id uuid, p_from date, p_to date
)
RETURNS TABLE (
  category      varchar,
  total_amount  numeric,
  item_count    bigint,
  pct_of_total  numeric
)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH rows_ AS (
    SELECT cti.category_snapshot AS cat, cti.line_total, cti.qty
    FROM public.canteen_transaction_items cti
    JOIN public.canteen_transactions ct ON ct.id = cti.transaction_id
    WHERE ct.student_id = p_student_id
      AND ct.student_id = ANY (public.auth_ward_ids())
      AND ct.status = 'SETTLED'
      AND ct.business_date BETWEEN p_from AND p_to
  ),
  tot AS (SELECT coalesce(sum(line_total), 0) AS t FROM rows_)
  SELECT
    cat::varchar,
    sum(line_total)::numeric,
    sum(qty)::bigint,
    CASE WHEN (SELECT t FROM tot) = 0 THEN 0
         ELSE round(100.0 * sum(line_total) / (SELECT t FROM tot), 1) END::numeric
  FROM rows_
  GROUP BY cat
  ORDER BY 2 DESC;
$$;

-- -----------------------------------------------------------------
-- 2.3.5 Tingkat penagihan SPP
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_spp_collection_rate(p_period varchar)
RETURNS TABLE (
  total_invoice    bigint,
  paid_count       bigint,
  unpaid_count     bigint,
  failed_count     bigint,
  overdue_count    bigint,
  billed_amount    numeric,
  collected_amount numeric,
  collection_pct   numeric
)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT
    count(*)::bigint,
    count(*) FILTER (WHERE status = 'PAID')::bigint,
    count(*) FILTER (WHERE status = 'UNPAID')::bigint,
    count(*) FILTER (WHERE status = 'FAILED')::bigint,
    count(*) FILTER (WHERE status = 'OVERDUE')::bigint,
    coalesce(sum(amount), 0)::numeric,
    coalesce(sum(amount) FILTER (WHERE status = 'PAID'), 0)::numeric,
    CASE WHEN count(*) = 0 THEN 0
         ELSE round(100.0 * count(*) FILTER (WHERE status = 'PAID') / count(*), 1) END::numeric
  FROM public.spp_invoices
  WHERE school_id = ANY (public.auth_school_ids())
    AND period = p_period;
$$;

-- -----------------------------------------------------------------
-- 2.3.6 Statistik kartu dan enrollment
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_school_card_stats()
RETURNS TABLE (
  total_students   bigint,
  active_cards     bigint,
  lost_reported    bigint,
  blocked          bigint,
  graduated        bigint,
  transferred_out  bigint,
  consent_pending  bigint,
  issued_last_30d  bigint
)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH s AS (
    SELECT id, status FROM public.students WHERE school_id = ANY (public.auth_school_ids())
  ),
  cards AS (
    SELECT sc.student_id, sc.status
    FROM public.student_cards sc
    WHERE sc.school_id = ANY (public.auth_school_ids())
  )
  SELECT
    (SELECT count(*) FROM s)::bigint,
    (SELECT count(*) FROM cards WHERE status = 'active')::bigint,
    (SELECT count(*) FROM cards WHERE status = 'lost_reported')::bigint,
    (SELECT count(*) FROM cards WHERE status = 'blocked')::bigint,
    (SELECT count(*) FROM s WHERE status = 'graduated')::bigint,
    (SELECT count(*) FROM s WHERE status = 'transferred_out')::bigint,
    (SELECT count(*) FROM s
      WHERE NOT EXISTS (
        SELECT 1 FROM public.parental_consent pc
        WHERE pc.student_id = s.id AND pc.granted_at IS NOT NULL AND pc.revoked_at IS NULL))::bigint,
    (SELECT count(*) FROM public.card_lifecycle_events e
      JOIN s ON s.id = e.student_id
      WHERE e.event_type IN ('issued','reissued') AND e.created_at >= now() - interval '30 days')::bigint;
$$;

COMMIT;