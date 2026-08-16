-- =====================================================================
-- VALO INSTITUTION MODULES — v1.0
-- Migration Script: 20260816_institution_full_modules.sql (Fixed Idempotency)
-- =====================================================================

BEGIN;

-- 1.0 ENUM TYPES
DO $$ BEGIN   CREATE TYPE public.fee_category_t AS ENUM ('SPP_BULANAN','UANG_GEDUNG','SERAGAM','KEGIATAN','LAINNYA'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN   CREATE TYPE public.payroll_status_t AS ENUM ('DRAFT','PENDING','PROCESSING','DISBURSED','FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN   CREATE TYPE public.procurement_type_t AS ENUM ('PURCHASE_ORDER','REIMBURSEMENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN   CREATE TYPE public.procurement_status_t AS ENUM ('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','PAID'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN   CREATE TYPE public.asset_kind_t AS ENUM ('NON_WORKING','WORKING'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN   CREATE TYPE public.asset_condition_t AS ENUM ('BAIK','PERLU_PERBAIKAN','RUSAK'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN   CREATE TYPE public.credit_status_t AS ENUM ('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','DISBURSED','CLOSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN   CREATE TYPE public.investment_type_t AS ENUM ('BNI_DEPOSITO','SUKUK_NEGARA','REKSADANA_PASAR_UANG'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN   CREATE TYPE public.investment_status_t AS ENUM ('ACTIVE','MATURED','WITHDRAWN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1.1 STORAGE BUCKET FOR RECEIPTS
INSERT INTO storage.buckets (id, name, public) 
VALUES ('procurement-receipts', 'procurement-receipts', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "tenant_receipts_upload" ON storage.objects;
CREATE POLICY "tenant_receipts_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'procurement-receipts');

DROP POLICY IF EXISTS "tenant_receipts_read" ON storage.objects;
CREATE POLICY "tenant_receipts_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'procurement-receipts');

-- 1.2 MULTI-FEE CATEGORIES & SPP INVOICE EXTENSION
CREATE TABLE IF NOT EXISTS public.institution_fee_categories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  category        public.fee_category_t NOT NULL,
  label           text NOT NULL CHECK (length(btrim(label)) BETWEEN 2 AND 100),
  default_amount  public.idr_amt NOT NULL CHECK (default_amount >= 0),
  is_recurring    boolean NOT NULL DEFAULT true,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_fee_category_school UNIQUE (school_id, category, label)
);

CREATE INDEX IF NOT EXISTS idx_fee_categories_school ON public.institution_fee_categories (school_id) WHERE is_active;

ALTER TABLE public.spp_invoices
  ADD COLUMN IF NOT EXISTS fee_category_id   uuid REFERENCES public.institution_fee_categories(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS receipt_qr_hash    text,
  ADD COLUMN IF NOT EXISTS receipt_issued_at  timestamptz;

INSERT INTO public.institution_fee_categories (school_id, category, label, default_amount, is_recurring)
SELECT DISTINCT s.school_id, 'SPP_BULANAN'::public.fee_category_t, 'SPP Bulanan (Migrasi)', 0, true
  FROM public.spp_invoices s
 WHERE NOT EXISTS (
   SELECT 1 FROM public.institution_fee_categories f
    WHERE f.school_id = s.school_id AND f.category = 'SPP_BULANAN'::public.fee_category_t
 );

UPDATE public.spp_invoices s
   SET fee_category_id = f.id
  FROM public.institution_fee_categories f
 WHERE f.school_id = s.school_id
   AND f.category = 'SPP_BULANAN'
   AND s.fee_category_id IS NULL;

ALTER TABLE public.spp_invoices ALTER COLUMN fee_category_id SET NOT NULL;

-- Idempotent constraint replacement
ALTER TABLE public.spp_invoices DROP CONSTRAINT IF EXISTS uq_spp_student_period;
ALTER TABLE public.spp_invoices DROP CONSTRAINT IF EXISTS uq_spp_student_period_category;
ALTER TABLE public.spp_invoices ADD CONSTRAINT uq_spp_student_period_category UNIQUE (student_id, period, fee_category_id);

CREATE INDEX IF NOT EXISTS idx_spp_fee_category ON public.spp_invoices (fee_category_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_spp_receipt_hash ON public.spp_invoices (receipt_qr_hash) WHERE receipt_qr_hash IS NOT NULL;

-- 1.3 PAYROLL TABLE
CREATE TABLE IF NOT EXISTS public.institution_payroll (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  staff_name            text NOT NULL,
  nip                   text,
  position              text NOT NULL,
  bni_account_number    text NOT NULL,
  bni_account_name      text NOT NULL,
  period                public.period_ym NOT NULL,
  basic_salary          public.idr_amt NOT NULL CHECK (basic_salary >= 0),
  allowances            public.idr_amt NOT NULL DEFAULT 0 CHECK (allowances >= 0),
  deductions            public.idr_amt NOT NULL DEFAULT 0 CHECK (deductions >= 0),
  net_salary            public.idr_amt GENERATED ALWAYS AS (basic_salary + allowances - deductions) STORED,
  breakdown_details     jsonb NOT NULL DEFAULT '{"allowance_items":[],"deduction_items":[{"name":"PPh 21","amount":0},{"name":"BPJS Ketenagakerjaan","amount":0}]}'::jsonb,
  status                public.payroll_status_t NOT NULL DEFAULT 'PENDING',
  batch_id              uuid,
  bni_h2h_reference     text,
  paid_at               timestamptz,
  failure_reason        text,
  ledger_transaction_id uuid REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_payroll_net_nonneg CHECK (basic_salary + allowances - deductions >= 0),
  CONSTRAINT ck_payroll_paid_consistency CHECK ((status = 'DISBURSED') = (paid_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_staff_period_idx ON public.institution_payroll (school_id, coalesce(nip, staff_name), period);
CREATE INDEX IF NOT EXISTS idx_payroll_school_period ON public.institution_payroll (school_id, period, status);
CREATE INDEX IF NOT EXISTS idx_payroll_batch ON public.institution_payroll (batch_id) WHERE batch_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_h2h_ref ON public.institution_payroll (bni_h2h_reference) WHERE bni_h2h_reference IS NOT NULL;

-- 1.4 PROCUREMENT & REIMBURSEMENT TABLE
CREATE TABLE IF NOT EXISTS public.institution_procurement (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id              uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  type                   public.procurement_type_t NOT NULL,
  requested_by           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  claimed_by_name        text,
  claimed_by_phone       text,
  vendor_name            text NOT NULL,
  category               text NOT NULL,
  description            text,
  amount                 public.idr_amt NOT NULL CHECK (amount > 0),
  status                 public.procurement_status_t NOT NULL DEFAULT 'DRAFT',
  receipt_file_path      text,
  ocr_raw_json           jsonb,
  ocr_confidence         numeric(4,3) CHECK (ocr_confidence IS NULL OR ocr_confidence BETWEEN 0 AND 1),
  reviewed_vendor_name   text,
  reviewed_date          date,
  reviewed_amount        public.idr_amt,
  approved_by            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at            timestamptz,
  rejected_reason        text,
  paid_at                timestamptz,
  ledger_transaction_id  uuid REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_procurement_reimbursement_needs_receipt CHECK (type = 'PURCHASE_ORDER' OR receipt_file_path IS NOT NULL),
  CONSTRAINT ck_procurement_paid_consistency CHECK ((status = 'PAID') = (paid_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_procurement_school_status ON public.institution_procurement (school_id, status, type);
CREATE INDEX IF NOT EXISTS idx_procurement_requester ON public.institution_procurement (requested_by);

CREATE UNIQUE INDEX IF NOT EXISTS uq_merchants_id_school ON public.merchants (id, school_id);

-- 1.5 ASSET MANAGEMENT TABLE
CREATE TABLE IF NOT EXISTS public.institution_assets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id          uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  kind               public.asset_kind_t NOT NULL,
  merchant_id        uuid REFERENCES public.merchants(id) ON DELETE SET NULL,
  asset_name         text NOT NULL,
  asset_code         text,
  category           text NOT NULL,
  location           text,
  quantity           integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  condition          public.asset_condition_t NOT NULL DEFAULT 'BAIK',
  acquisition_date   date,
  acquisition_value  public.idr_amt CHECK (acquisition_value IS NULL OR acquisition_value >= 0),
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_assets_merchant_shape CHECK (
    (kind = 'WORKING'     AND merchant_id IS NOT NULL) OR
    (kind = 'NON_WORKING' AND merchant_id IS NULL)
  ),
  CONSTRAINT fk_assets_merchant_tenant FOREIGN KEY (merchant_id, school_id) REFERENCES public.merchants (id, school_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_assets_code_per_school ON public.institution_assets (school_id, asset_code) WHERE asset_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_school_kind ON public.institution_assets (school_id, kind, condition);

-- 1.6 CREDIT & INVESTMENTS TABLES
CREATE TABLE IF NOT EXISTS public.institution_credit_applications (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id                       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  plafon_amount                   public.idr_amt NOT NULL CHECK (plafon_amount > 0),
  tenor_months                    smallint NOT NULL CHECK (tenor_months BETWEEN 1 AND 120),
  purpose                         text NOT NULL CHECK (length(btrim(purpose)) >= 10),
  estimated_interest_rate         numeric(5,2) NOT NULL CHECK (estimated_interest_rate >= 0),
  estimated_monthly_installment   public.idr_amt,
  status                          public.credit_status_t NOT NULL DEFAULT 'DRAFT',
  submitted_at                    timestamptz,
  reviewed_by                     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at                     timestamptz,
  rejection_reason                text,
  disbursed_at                    timestamptz,
  bni_reference                   text,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_credit_submitted_consistency CHECK ((status = 'DRAFT') OR (submitted_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.institution_investments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  investment_type       public.investment_type_t NOT NULL,
  principal_amount      public.idr_amt NOT NULL CHECK (principal_amount > 0),
  expected_yield_rate   numeric(5,2) NOT NULL CHECK (expected_yield_rate >= 0),
  accumulated_yield     public.idr_amt NOT NULL DEFAULT 0 CHECK (accumulated_yield >= 0),
  placement_date        date NOT NULL,
  maturity_date         date,
  status                public.investment_status_t NOT NULL DEFAULT 'ACTIVE',
  bni_reference         text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_investment_maturity CHECK (maturity_date IS NULL OR maturity_date > placement_date)
);

-- 1.7 STRICT RLS POLICIES
ALTER TABLE public.institution_fee_categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_payroll             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_procurement         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_assets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_credit_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_investments         ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.institution_payroll             FORCE ROW LEVEL SECURITY;
ALTER TABLE public.institution_procurement         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.institution_credit_applications FORCE ROW LEVEL SECURITY;
ALTER TABLE public.institution_investments         FORCE ROW LEVEL SECURITY;

-- Fee categories policies
DROP POLICY IF EXISTS fee_categories_school_read ON public.institution_fee_categories;
CREATE POLICY fee_categories_school_read ON public.institution_fee_categories FOR SELECT TO authenticated
  USING (school_id = ANY (public.auth_school_ids()) OR (SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS fee_categories_school_write ON public.institution_fee_categories;
CREATE POLICY fee_categories_school_write ON public.institution_fee_categories FOR ALL TO authenticated
  USING (school_id = ANY (public.auth_school_ids()) AND (SELECT public.auth_has_role('school_admin') OR public.auth_has_role('school_treasurer')))
  WITH CHECK (school_id = ANY (public.auth_school_ids()));

-- Payroll policies
DROP POLICY IF EXISTS payroll_school_read ON public.institution_payroll;
CREATE POLICY payroll_school_read ON public.institution_payroll FOR SELECT TO authenticated
  USING (school_id = ANY (public.auth_school_ids()) AND (SELECT public.auth_has_role('school_admin') OR public.auth_has_role('school_treasurer')) OR (SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS payroll_treasurer_manage ON public.institution_payroll;
CREATE POLICY payroll_treasurer_manage ON public.institution_payroll FOR ALL TO authenticated
  USING (school_id = ANY (public.auth_school_ids()) AND (SELECT public.auth_has_role('school_admin') OR public.auth_has_role('school_treasurer')))
  WITH CHECK (school_id = ANY (public.auth_school_ids()));

-- Procurement policies
DROP POLICY IF EXISTS procurement_school_read ON public.institution_procurement;
CREATE POLICY procurement_school_read ON public.institution_procurement FOR SELECT TO authenticated
  USING (school_id = ANY (public.auth_school_ids()) AND (requested_by = (SELECT auth.uid()) OR (SELECT public.auth_has_role('school_admin') OR public.auth_has_role('school_treasurer'))) OR (SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS procurement_staff_insert ON public.institution_procurement;
CREATE POLICY procurement_staff_insert ON public.institution_procurement FOR INSERT TO authenticated
  WITH CHECK (school_id = ANY (public.auth_school_ids()) AND requested_by = (SELECT auth.uid()) AND status IN ('DRAFT','SUBMITTED'));

DROP POLICY IF EXISTS procurement_staff_update ON public.institution_procurement;
CREATE POLICY procurement_staff_update ON public.institution_procurement FOR UPDATE TO authenticated
  USING (requested_by = (SELECT auth.uid()) AND status IN ('DRAFT','SUBMITTED'))
  WITH CHECK (requested_by = (SELECT auth.uid()) AND status IN ('DRAFT','SUBMITTED'));

-- Assets policies
DROP POLICY IF EXISTS assets_school_read ON public.institution_assets;
CREATE POLICY assets_school_read ON public.institution_assets FOR SELECT TO authenticated
  USING (school_id = ANY (public.auth_school_ids()) OR (SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS assets_school_write ON public.institution_assets;
CREATE POLICY assets_school_write ON public.institution_assets FOR ALL TO authenticated
  USING (school_id = ANY (public.auth_school_ids()) AND (SELECT public.auth_has_role('school_admin') OR public.auth_has_role('school_treasurer')))
  WITH CHECK (school_id = ANY (public.auth_school_ids()));

-- Secure Credit Applications
DROP POLICY IF EXISTS credit_school_read ON public.institution_credit_applications;
CREATE POLICY credit_school_read ON public.institution_credit_applications FOR SELECT TO authenticated
  USING (school_id = ANY (public.auth_school_ids()) AND (SELECT public.auth_has_role('school_admin') OR public.auth_has_role('school_treasurer')) OR (SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS credit_school_insert ON public.institution_credit_applications;
CREATE POLICY credit_school_insert ON public.institution_credit_applications FOR INSERT TO authenticated
  WITH CHECK (school_id = ANY (public.auth_school_ids()) AND status IN ('DRAFT', 'SUBMITTED'));

DROP POLICY IF EXISTS credit_admin_update ON public.institution_credit_applications;
CREATE POLICY credit_admin_update ON public.institution_credit_applications FOR UPDATE TO authenticated
  USING ((SELECT public.is_platform_admin()))
  WITH CHECK ((SELECT public.is_platform_admin()));

-- Investment policies
DROP POLICY IF EXISTS investments_school_read ON public.institution_investments;
CREATE POLICY investments_school_read ON public.institution_investments FOR SELECT TO authenticated
  USING (school_id = ANY (public.auth_school_ids()) AND (SELECT public.auth_has_role('school_admin') OR public.auth_has_role('school_treasurer')) OR (SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS investments_school_write ON public.institution_investments;
CREATE POLICY investments_school_write ON public.institution_investments FOR ALL TO authenticated
  USING (school_id = ANY (public.auth_school_ids()) AND (SELECT public.auth_has_role('school_admin') OR public.auth_has_role('school_treasurer')))
  WITH CHECK (school_id = ANY (public.auth_school_ids()));

-- 1.8 RPC: ATOMIC PAYROLL BATCH DISBURSEMENT (Debit: school_expense_payroll)
CREATE OR REPLACE FUNCTION public.fn_execute_payroll_batch(
  p_idempotency_key uuid,
  p_school_id       uuid,
  p_period          public.period_ym
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, valo_private, pg_temp AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_fingerprint text;
  v_idem        public.idempotency_keys%rowtype;
  v_batch_id    uuid := gen_random_uuid();
  r             record;
  v_acct_school  uuid;   -- school_escrow (funding source Giro)
  v_acct_expense uuid;   -- school_expense_payroll (Operating Expense)
  v_count       integer := 0;
  v_total       numeric := 0;
  v_result      jsonb;
BEGIN
  IF NOT (p_school_id = ANY (public.auth_school_ids()) AND (public.auth_has_role('school_admin') OR public.auth_has_role('school_treasurer'))) THEN
    RAISE EXCEPTION 'RLS_FORBIDDEN' USING errcode = '42501';
  END IF;

  v_fingerprint := encode(digest(p_school_id::text || '|' || p_period, 'sha256'), 'hex');

  INSERT INTO public.idempotency_keys (key, endpoint, actor_user_id, request_fingerprint, status)
  VALUES (p_idempotency_key, 'fn_execute_payroll_batch', v_caller, v_fingerprint, 'PROCESSING')
  ON CONFLICT (endpoint, key) DO NOTHING;

  IF NOT FOUND THEN
    SELECT * INTO v_idem FROM public.idempotency_keys WHERE endpoint = 'fn_execute_payroll_batch' AND key = p_idempotency_key FOR UPDATE;
    IF v_idem.status = 'COMPLETED' THEN
      RETURN v_idem.response_snapshot || jsonb_build_object('replayed', true);
    END IF;
  END IF;

  v_acct_school  := valo_private.fn_ensure_account('school_escrow', p_school_id, NULL, NULL, NULL);
  v_acct_expense := valo_private.fn_ensure_account('school_expense_payroll', p_school_id, NULL, NULL, NULL);

  FOR r IN
    SELECT id, net_salary FROM public.institution_payroll
     WHERE school_id = p_school_id AND period = p_period AND status = 'PENDING'
     FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.institution_payroll
       SET status = 'DISBURSED',
           batch_id = v_batch_id,
           bni_h2h_reference = 'H2H-PAYROLL-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(r.id::text, 1, 8),
           paid_at = now(),
           updated_at = now(),
           ledger_transaction_id = valo_private.fn_post_journal(
             'MANUAL_ADJUSTMENT', 'institution_payroll', r.id, p_school_id,
             (now() AT TIME ZONE 'Asia/Jakarta')::date,
             jsonb_build_array(
               jsonb_build_object('account_id', v_acct_school,  'signed_amount', -r.net_salary),
               jsonb_build_object('account_id', v_acct_expense, 'signed_amount',  r.net_salary)
             ),
             format('Payroll disbursement %s', p_period), v_caller
           )
     WHERE id = r.id;
    v_count := v_count + 1;
    v_total := v_total + r.net_salary;
  END LOOP;

  v_result := jsonb_build_object('batch_id', v_batch_id, 'period', p_period, 'staff_disbursed', v_count, 'total_amount', v_total, 'http_status', 200);

  UPDATE public.idempotency_keys
     SET status='COMPLETED', response_snapshot=v_result, response_status=200, completed_at=now()
   WHERE endpoint='fn_execute_payroll_batch' AND key=p_idempotency_key;

  RETURN v_result;
END; $$;

-- 1.9 RPC: RESOLVE PROCUREMENT & REIMBURSEMENT
CREATE OR REPLACE FUNCTION public.fn_resolve_procurement(
  p_idempotency_key uuid,
  p_procurement_id  uuid,
  p_decision        text,
  p_rejection_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, valo_private, pg_temp AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_row         public.institution_procurement%rowtype;
  v_fingerprint text;
  v_idem        public.idempotency_keys%rowtype;
  v_acct_school  uuid;
  v_acct_expense uuid;
  v_ledger_id   uuid;
  v_result      jsonb;
BEGIN
  SELECT * INTO v_row FROM public.institution_procurement WHERE id = p_procurement_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND','http_status',404); END IF;

  IF NOT (v_row.school_id = ANY (public.auth_school_ids()) AND (public.auth_has_role('school_admin') OR public.auth_has_role('school_treasurer'))) THEN
    RAISE EXCEPTION 'RLS_FORBIDDEN' USING errcode = '42501';
  END IF;

  IF v_row.type = 'REIMBURSEMENT' AND p_decision = 'APPROVE' AND (v_row.reviewed_amount IS NULL OR v_row.reviewed_vendor_name IS NULL) THEN
    RETURN jsonb_build_object('error','HITL_REVIEW_INCOMPLETE','http_status',422);
  END IF;

  IF p_decision = 'REJECT' THEN
    UPDATE public.institution_procurement
       SET status = 'REJECTED', rejected_reason = p_rejection_reason, approved_by = v_caller, approved_at = now(), updated_at = now()
     WHERE id = p_procurement_id;
    v_result := jsonb_build_object('procurement_id', p_procurement_id, 'status','REJECTED','http_status',200);
  ELSE
    v_acct_school  := valo_private.fn_ensure_account('school_escrow', v_row.school_id, NULL, NULL, NULL);
    v_acct_expense := valo_private.fn_ensure_account('school_expense_procurement', v_row.school_id, NULL, NULL, NULL);

    v_ledger_id := valo_private.fn_post_journal(
      'MANUAL_ADJUSTMENT', 'institution_procurement', v_row.id, v_row.school_id,
      (now() AT TIME ZONE 'Asia/Jakarta')::date,
      jsonb_build_array(
        jsonb_build_object('account_id', v_acct_school,  'signed_amount', -coalesce(v_row.reviewed_amount, v_row.amount)),
        jsonb_build_object('account_id', v_acct_expense, 'signed_amount',  coalesce(v_row.reviewed_amount, v_row.amount))
      ),
      format('Procurement disbursement %s', v_row.id), v_caller
    );

    UPDATE public.institution_procurement
       SET status = 'PAID', approved_by = v_caller, approved_at = now(), paid_at = now(), ledger_transaction_id = v_ledger_id, updated_at = now()
     WHERE id = p_procurement_id;
    v_result := jsonb_build_object('procurement_id', p_procurement_id, 'status','PAID','http_status',200);
  END IF;

  RETURN v_result;
END; $$;

-- 1.10 INTEGRITY CHECK EXPANSION
CREATE OR REPLACE FUNCTION valo_private.fn_integrity_check()
RETURNS TABLE (check_name text, violations bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT 'canteen_unbalanced_journals'::text AS check_name,
         count(*) AS violations
    FROM public.ledger_transactions t
   WHERE t.source_table = 'canteen_transactions'
     AND EXISTS (
       SELECT 1 FROM public.ledger_entries e
        WHERE e.transaction_id = t.id
       HAVING sum(e.signed_amount) <> 0
     )
  UNION ALL
  SELECT 'payroll_disbursed_without_ledger',
         count(*) FROM public.institution_payroll
          WHERE status = 'DISBURSED' AND ledger_transaction_id IS NULL
  UNION ALL
  SELECT 'procurement_paid_without_ledger',
         count(*) FROM public.institution_procurement
          WHERE status = 'PAID' AND ledger_transaction_id IS NULL
  UNION ALL
  SELECT 'assets_shape_violation',
         count(*) FROM public.institution_assets
          WHERE (kind = 'WORKING' AND merchant_id IS NULL)
             OR (kind = 'NON_WORKING' AND merchant_id IS NOT NULL)
  UNION ALL
  SELECT 'spp_invoices_missing_category',
         count(*) FROM public.spp_invoices WHERE fee_category_id IS NULL;
$$;

-- 1.11 SEED DEMO DATA FOR DEMO_SCHOOL_ID ('09c77f03-7f77-4c26-8da4-6ad5462f860c')
DO $$
DECLARE
  v_school   uuid := '09c77f03-7f77-4c26-8da4-6ad5462f860c';
  v_merchant uuid;
  v_period   text := to_char(now(), 'YYYY-MM');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id = v_school) THEN
    RETURN;
  END IF;

  SELECT id INTO v_merchant FROM public.merchants WHERE school_id = v_school LIMIT 1;

  -- Fee categories
  INSERT INTO public.institution_fee_categories (school_id, category, label, default_amount, is_recurring)
  VALUES
    (v_school, 'SPP_BULANAN', 'SPP Bulanan', 350000, true),
    (v_school, 'UANG_GEDUNG', 'Uang Gedung', 5000000, false),
    (v_school, 'SERAGAM',     'Seragam Sekolah', 750000, false),
    (v_school, 'KEGIATAN',    'Kegiatan & Ekstrakurikuler', 200000, true)
  ON CONFLICT (school_id, category, label) DO NOTHING;

  -- Payroll roster (5 staff) with breakdown_details
  INSERT INTO public.institution_payroll
    (school_id, staff_name, nip, position, bni_account_number, bni_account_name, period,
     basic_salary, allowances, deductions, breakdown_details, status, paid_at)
  VALUES
    (v_school, 'Drs. Bambang Santoso', '198501012010011001', 'Kepala Sekolah', '0123456781', 'BAMBANG SANTOSO', v_period, 8500000, 1500000, 250000,
     '{"allowance_items":[{"name":"Tunjangan Jabatan","amount":1500000}],"deduction_items":[{"name":"PPh 21","amount":150000},{"name":"BPJS Ketenagakerjaan","amount":100000}]}'::jsonb, 'PENDING', NULL),
    (v_school, 'Siti Rahmawati, S.Pd', '199003152012022002', 'Guru Matematika', '0123456782', 'SITI RAHMAWATI', v_period, 5500000, 800000, 150000,
     '{"allowance_items":[{"name":"Tunjangan Wali Kelas","amount":800000}],"deduction_items":[{"name":"PPh 21","amount":90000},{"name":"BPJS Ketenagakerjaan","amount":60000}]}'::jsonb, 'PENDING', NULL),
    (v_school, 'Ahmad Fauzi, S.Pd', '198812102015011003', 'Guru Bahasa Indonesia', '0123456783', 'AHMAD FAUZI', v_period, 5200000, 700000, 140000,
     '{"allowance_items":[{"name":"Tunjangan Fungsional","amount":700000}],"deduction_items":[{"name":"PPh 21","amount":80000},{"name":"BPJS Ketenagakerjaan","amount":60000}]}'::jsonb, 'PENDING', NULL),
    (v_school, 'Dewi Lestari', '199207202016022004', 'Staf Tata Usaha', '0123456784', 'DEWI LESTARI', v_period, 4200000, 500000, 100000,
     '{"allowance_items":[{"name":"Tunjangan Transport","amount":500000}],"deduction_items":[{"name":"PPh 21","amount":60000},{"name":"BPJS Ketenagakerjaan","amount":40000}]}'::jsonb, 'PENDING', NULL),
    (v_school, 'Rudi Hartono', '198606052014011005', 'Petugas Kebersihan', '0123456785', 'RUDI HARTONO', v_period, 3200000, 300000, 80000,
     '{"allowance_items":[{"name":"Tunjangan Kebersihan","amount":300000}],"deduction_items":[{"name":"PPh 21","amount":50000},{"name":"BPJS Ketenagakerjaan","amount":30000}]}'::jsonb, 'DISBURSED', now())
  ON CONFLICT DO NOTHING;

  -- Procurement entries (including WhatsApp submission simulation with low OCR confidence)
  INSERT INTO public.institution_procurement
    (school_id, type, vendor_name, category, description, amount, status)
  VALUES
    (v_school, 'PURCHASE_ORDER', 'CV Sumber Alat Tulis', 'ATK', 'Pengadaan alat tulis kantor semester genap', 4500000, 'SUBMITTED')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.institution_procurement
    (school_id, type, claimed_by_name, claimed_by_phone, vendor_name, category, description, amount, status,
     receipt_file_path, ocr_raw_json, ocr_confidence)
  VALUES
    (v_school, 'REIMBURSEMENT', 'Ahmad Fauzi, S.Pd', '+6281234567890', 'Toko Bangunan Jaya', 'Perawatan Gedung', 'Perbaikan atap ruang kelas 3B (Ingested via WhatsApp)', 1250000, 'SUBMITTED',
     'receipts/whatsapp-nota-01.jpg',
     '{"vendor_guess":"Toko Bangunan Jaya","date_guess":"2026-08-10","total_guess":1250000,"items":["Genteng","Semen","Ongkos tukang"]}'::jsonb,
     0.68)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.institution_procurement
    (school_id, type, vendor_name, category, description, amount, status,
     receipt_file_path, reviewed_vendor_name, reviewed_date, reviewed_amount,
     approved_at, paid_at)
  VALUES
    (v_school, 'REIMBURSEMENT', 'Warung Makan Sederhana', 'Konsumsi Rapat', 'Konsumsi rapat wali murid', 850000, 'PAID',
     'receipts/demo-nota-02.jpg', 'Warung Makan Sederhana', '2026-08-05', 850000, now(), now())
  ON CONFLICT DO NOTHING;

  -- Assets (5 non-working + 3 working commercial merchant assets)
  INSERT INTO public.institution_assets (school_id, kind, asset_name, category, location, quantity, condition)
  VALUES
    (v_school, 'NON_WORKING', 'Proyektor Epson EB-X05', 'Elektronik', 'Ruang Kelas 4A', 1, 'BAIK'),
    (v_school, 'NON_WORKING', 'CCTV Hikvision', 'Keamanan', 'Koridor Lantai 2', 6, 'BAIK'),
    (v_school, 'NON_WORKING', 'Bangku & Meja Siswa', 'Furnitur', 'Ruang Kelas 5B', 32, 'PERLU_PERBAIKAN'),
    (v_school, 'NON_WORKING', 'AC Split 1PK', 'Elektronik', 'Ruang Guru', 3, 'BAIK'),
    (v_school, 'NON_WORKING', 'Papan Tulis Interaktif', 'Elektronik', 'Lab Komputer', 2, 'RUSAK')
  ON CONFLICT DO NOTHING;

  IF v_merchant IS NOT NULL THEN
    INSERT INTO public.institution_assets (school_id, kind, merchant_id, asset_name, category, location, quantity, condition)
    VALUES
      (v_school, 'WORKING', v_merchant, 'POS Terminal BNI', 'Perangkat Pembayaran', 'Kantin Utama', 1, 'BAIK'),
      (v_school, 'WORKING', v_merchant, 'EDC Android BNI', 'Perangkat Pembayaran', 'Kantin Utama', 2, 'BAIK'),
      (v_school, 'WORKING', v_merchant, 'Kios Kantin Portable', 'Furnitur Komersial', 'Area Kantin', 1, 'BAIK')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Credit application (1 submitted)
  INSERT INTO public.institution_credit_applications
    (school_id, plafon_amount, tenor_months, purpose, estimated_interest_rate, estimated_monthly_installment, status, submitted_at)
  VALUES
    (v_school, 150000000, 24, 'Modal kerja renovasi kantin dan pengadaan fasilitas belajar semester baru',
     9.5, 6888365, 'SUBMITTED', now())
  ON CONFLICT DO NOTHING;

  -- Investments (2 active)
  INSERT INTO public.institution_investments
    (school_id, investment_type, principal_amount, expected_yield_rate, accumulated_yield, placement_date, maturity_date, status)
  VALUES
    (v_school, 'BNI_DEPOSITO', 200000000, 5.25, 3937500, '2026-02-01', '2027-02-01', 'ACTIVE'),
    (v_school, 'REKSADANA_PASAR_UANG', 75000000, 6.10, 1830000, '2026-04-15', NULL, 'ACTIVE')
  ON CONFLICT DO NOTHING;
END $$;

COMMIT;
NOTIFY pgrst, 'reload schema';