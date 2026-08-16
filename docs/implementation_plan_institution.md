# Implementation Plan v2 — Institution & School Portal Modules (`VALO School`)
### Enterprise-Grade Revision | Strict Multi-Tenancy | Obsidian Navy (`data-portal="school"`)

> Revisi ini dibangun di atas **schema v3.0** (`ledger_accounts`, `fn_post_journal`, `auth_school_ids()`, dll) dan migration prasyarat `20260815_0001_ai_assistant_prereq.sql` yang sudah ada di repo kalian. Setiap tabel, RPC, dan RLS policy baru **mengikuti konvensi yang sudah dipakai** (composite tenant FK, `SECURITY DEFINER` + `search_path` terkunci, immutability trigger untuk baris finansial yang sudah disburse, `idempotency_keys` untuk aksi non-idempotent).

---

## 0. Temuan Kritis dari Draf Awal (Wajib Diperbaiki)

| # | Masalah di Draf Awal | Dampak Jika Tidak Diperbaiki | Perbaikan di Revisi Ini |
|---|---|---|---|
| 1 | Tab multi-kategori SPP (SPP/Gedung/Seragam/Kegiatan) diasumsikan langsung jalan di atas `spp_invoices` | `spp_invoices` sudah punya `CONSTRAINT uq_spp_student_period UNIQUE (student_id, period)` — insert kategori kedua untuk periode yang sama akan **gagal dengan 23505** | Migrasi mem-*backfill* `fee_category_id`, **drop** unique lama, ganti jadi `UNIQUE (student_id, period, fee_category_id)` |
| 2 | 6 tabel baru tidak disebutkan pola tenant-isolation-nya | Rawan *cross-tenant leak* kalau FK ke `merchants`/`students` tidak divalidasi terhadap `school_id` yang sama | Semua FK lintas-entitas pakai **composite FK** `(x_id, school_id) REFERENCES parent(id, school_id)`, identik pola `fk_ctx_student_tenant` di schema v3 |
| 3 | "Eksekusi Batch Payroll BNI" dideskripsikan sebagai 1 tombol tanpa spesifikasi atomicity | Tanpa idempotency key + transaksi atomik, klik ganda / retry jaringan bisa **double-disburse** dana ke rekening staf | RPC `public.fn_execute_payroll_batch()` — pola identik `fn_process_canteen_tap`: idempotency key wajib, ledger posting via `fn_post_journal`, immutable setelah `DISBURSED` |
| 4 | AI OCR dianggap "tabel JSON saja" | Tidak ada *confidence threshold*, tidak ada pemisahan data mentah OCR vs data yang sudah dikoreksi manusia → audit trail lemah | Kolom terpisah: `ocr_raw_json` (immutable, dari AI) vs `reviewed_*` (hasil HITL) + `ocr_confidence` untuk memicu *manual review flag* |
| 5 | Aset "non-working" & "working" digabung tanpa constraint | Data tidak konsisten — aset kantin bisa lupa di-assign ke merchant, atau aset sekolah malah punya `merchant_id` | `CHECK` constraint tegas: `kind='WORKING' → merchant_id NOT NULL`, `kind='NON_WORKING' → merchant_id NULL` |
| 6 | RLS "enable RLS dan default policies" — terlalu generik | Bisa berakhir jadi `USING (true)` yang membocorkan data lintas sekolah | Policy eksplisit per role (`school_admin`, `school_treasurer`, guru sebagai `requested_by`) + `FORCE ROW LEVEL SECURITY` pada tabel finansial |
| 7 | Tidak ada strategi *column-level grant* untuk approval | Guru pengaju reimbursement secara teori bisa `UPDATE status = 'PAID'` sendiri lewat RLS yang longgar | `REVOKE UPDATE` lalu `GRANT UPDATE (kolom spesifik)` — pola identik `GRANT UPDATE (daily_limit, ...) ON students` di schema v3 |
| 8 | Kalkulator simulasi kredit & runway tidak punya formula pasti | UI slider tanpa formula = angka yang ditampilkan tidak bisa diverifikasi/diaudit | Formula anuitas & runway dituliskan eksplisit (Section 5) + diimplementasikan sebagai pure function yang bisa di-unit-test |
| 9 | Tidak ada perluasan `fn_integrity_check()` | Modul baru tidak ter-cover CI integrity check yang sudah ada | Section 7 menambah 4 assertion baru ke `valo_private.fn_integrity_check()` |
| 10 | Tidak disebut representasi TypeScript & pola Next.js (`force-dynamic`, redirect, service client) | Developer lain harus menebak-nebak kontrak API | Section 3 & 4 memberi `types/institution.ts` lengkap + pola `route.ts` & `page.tsx` sesuai konvensi `app/(school)/school/spp/page.tsx` yang sudah ada |

---

## 1. Database Schema & Migration

### File: `supabase/migrations/20260816_institution_full_modules.sql`

```sql
-- =====================================================================
-- VALO INSTITUTION MODULES — v1.0
-- Depends on: schema v3.0 (public.schools, public.merchants, public.profiles,
--             public.ledger_transactions, public.spp_invoices, public.idempotency_keys)
-- Convention : composite tenant FK, SECURITY DEFINER RPC, idempotent DDL
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1.0 ENUM TYPES
-- ---------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.fee_category_t AS ENUM (
    'SPP_BULANAN','UANG_GEDUNG','SERAGAM','KEGIATAN','LAINNYA'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payroll_status_t AS ENUM (
    'DRAFT','PENDING','PROCESSING','DISBURSED','FAILED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.procurement_type_t AS ENUM ('PURCHASE_ORDER','REIMBURSEMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.procurement_status_t AS ENUM (
    'DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','PAID'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.asset_kind_t AS ENUM ('NON_WORKING','WORKING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.asset_condition_t AS ENUM ('BAIK','PERLU_PERBAIKAN','RUSAK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.credit_status_t AS ENUM (
    'DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','DISBURSED','CLOSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.investment_type_t AS ENUM (
    'BNI_DEPOSITO','SUKUK_NEGARA','REKSADANA_PASAR_UANG'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.investment_status_t AS ENUM ('ACTIVE','MATURED','WITHDRAWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 1.1 FEE CATEGORIES + FIX spp_invoices MULTI-CATEGORY CONFLICT
-- ---------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_fee_categories_school
  ON public.institution_fee_categories (school_id) WHERE is_active;

-- Extend spp_invoices to carry category + digital receipt fields
ALTER TABLE public.spp_invoices
  ADD COLUMN IF NOT EXISTS fee_category_id   uuid REFERENCES public.institution_fee_categories(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS receipt_qr_hash    text,
  ADD COLUMN IF NOT EXISTS receipt_issued_at  timestamptz;

-- Backfill: create a default 'SPP_BULANAN' category per school that already has invoices,
-- then attach every existing (legacy) invoice to it.
INSERT INTO public.institution_fee_categories (school_id, category, label, default_amount, is_recurring)
SELECT DISTINCT s.school_id, 'SPP_BULANAN', 'SPP Bulanan (Migrasi)', 0, true
  FROM public.spp_invoices s
 WHERE NOT EXISTS (
   SELECT 1 FROM public.institution_fee_categories f
    WHERE f.school_id = s.school_id AND f.category = 'SPP_BULANAN'
 );

UPDATE public.spp_invoices s
   SET fee_category_id = f.id
  FROM public.institution_fee_categories f
 WHERE f.school_id = s.school_id
   AND f.category = 'SPP_BULANAN'
   AND s.fee_category_id IS NULL;

ALTER TABLE public.spp_invoices
  ALTER COLUMN fee_category_id SET NOT NULL;

-- Replace the single-category unique constraint with a category-aware one
ALTER TABLE public.spp_invoices
  DROP CONSTRAINT IF EXISTS uq_spp_student_period;

ALTER TABLE public.spp_invoices
  ADD CONSTRAINT uq_spp_student_period_category UNIQUE (student_id, period, fee_category_id);

CREATE INDEX IF NOT EXISTS idx_spp_fee_category ON public.spp_invoices (fee_category_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_spp_receipt_hash
  ON public.spp_invoices (receipt_qr_hash) WHERE receipt_qr_hash IS NOT NULL;

-- ---------------------------------------------------------------------
-- 1.2 PAYROLL
-- ---------------------------------------------------------------------
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
  status                public.payroll_status_t NOT NULL DEFAULT 'PENDING',
  batch_id              uuid,
  bni_h2h_reference     text,
  paid_at               timestamptz,
  failure_reason        text,
  ledger_transaction_id uuid REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_payroll_staff_period CHECK (nip IS NULL OR length(btrim(nip)) > 0),
  CONSTRAINT ck_payroll_net_nonneg CHECK (basic_salary + allowances - deductions >= 0),
  CONSTRAINT ck_payroll_paid_consistency CHECK ((status = 'DISBURSED') = (paid_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_staff_period_idx
  ON public.institution_payroll (school_id, coalesce(nip, staff_name), period);
CREATE INDEX IF NOT EXISTS idx_payroll_school_period ON public.institution_payroll (school_id, period, status);
CREATE INDEX IF NOT EXISTS idx_payroll_batch ON public.institution_payroll (batch_id) WHERE batch_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_h2h_ref
  ON public.institution_payroll (bni_h2h_reference) WHERE bni_h2h_reference IS NOT NULL;

-- Once disbursed, financial fields become append-only (same guard style as canteen_transactions)
CREATE OR REPLACE FUNCTION valo_private.trg_payroll_guard_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF old.status = 'DISBURSED' AND (
       new.basic_salary IS DISTINCT FROM old.basic_salary OR
       new.allowances   IS DISTINCT FROM old.allowances   OR
       new.deductions   IS DISTINCT FROM old.deductions   OR
       new.bni_account_number IS DISTINCT FROM old.bni_account_number
     ) THEN
    RAISE EXCEPTION 'IMMUTABLE_FIELD: disbursed payroll rows are append-only' USING errcode = '42501';
  END IF;
  RETURN new;
END; $$;

DROP TRIGGER IF EXISTS tg_payroll_guard ON public.institution_payroll;
CREATE TRIGGER tg_payroll_guard
  BEFORE UPDATE ON public.institution_payroll
  FOR EACH ROW EXECUTE FUNCTION valo_private.trg_payroll_guard_immutable();

-- ---------------------------------------------------------------------
-- 1.3 PROCUREMENT & REIMBURSEMENT (with AI OCR fields)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.institution_procurement (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id              uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  type                   public.procurement_type_t NOT NULL,
  requested_by           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  vendor_name            text NOT NULL,
  category               text NOT NULL,
  description            text,
  amount                 public.idr_amt NOT NULL CHECK (amount > 0),
  status                 public.procurement_status_t NOT NULL DEFAULT 'DRAFT',

  -- AI OCR pipeline (Reimbursement only)
  receipt_file_path      text,
  ocr_raw_json           jsonb,              -- immutable AI output, never edited
  ocr_confidence         numeric(4,3) CHECK (ocr_confidence IS NULL OR ocr_confidence BETWEEN 0 AND 1),
  reviewed_vendor_name   text,               -- Human-in-the-Loop corrected fields
  reviewed_date          date,
  reviewed_amount        public.idr_amt,

  approved_by            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at            timestamptz,
  rejected_reason        text,
  paid_at                timestamptz,
  ledger_transaction_id  uuid REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ck_procurement_ocr_shape CHECK (
    ocr_raw_json IS NULL OR jsonb_typeof(ocr_raw_json) = 'object'
  ),
  CONSTRAINT ck_procurement_reimbursement_needs_receipt CHECK (
    type = 'PURCHASE_ORDER' OR receipt_file_path IS NOT NULL
  ),
  CONSTRAINT ck_procurement_paid_consistency CHECK ((status = 'PAID') = (paid_at IS NOT NULL)),
  CONSTRAINT ck_procurement_approved_consistency CHECK (
    (status NOT IN ('APPROVED','PAID')) OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_procurement_school_status ON public.institution_procurement (school_id, status, type);
CREATE INDEX IF NOT EXISTS idx_procurement_requester ON public.institution_procurement (requested_by);
CREATE INDEX IF NOT EXISTS idx_procurement_ocr_gin
  ON public.institution_procurement USING gin (ocr_raw_json jsonb_path_ops);

-- Low-confidence OCR (<0.75) must not be auto-approved — enforced in RPC (Section 2), flagged here for audit
COMMENT ON COLUMN public.institution_procurement.ocr_confidence IS
  'If < 0.75, UI must force manual review before Finance Admin can approve.';

-- ---------------------------------------------------------------------
-- 1.4 ASSETS (Non-working vs Working/Merchant)
-- ---------------------------------------------------------------------
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
  CONSTRAINT fk_assets_merchant_tenant
    FOREIGN KEY (merchant_id, school_id) REFERENCES public.merchants (id, school_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_assets_code_per_school
  ON public.institution_assets (school_id, asset_code) WHERE asset_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_school_kind ON public.institution_assets (school_id, kind, condition);
CREATE INDEX IF NOT EXISTS idx_assets_merchant ON public.institution_assets (merchant_id) WHERE merchant_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 1.5 CREDIT APPLICATIONS (BNI Working Capital Loan)
-- ---------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_credit_school_status
  ON public.institution_credit_applications (school_id, status);

-- ---------------------------------------------------------------------
-- 1.6 INVESTMENTS (Institutional Portfolio)
-- ---------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_investments_school_status
  ON public.institution_investments (school_id, status);

-- =====================================================================
-- 1.7 ROW LEVEL SECURITY
-- =====================================================================

ALTER TABLE public.institution_fee_categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_payroll             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_procurement         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_assets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_credit_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_investments         ENABLE ROW LEVEL SECURITY;

-- Force RLS on the financially sensitive ones even for table owner (matches
-- FORCE pattern already used on students / canteen_transactions / ledger_entries)
ALTER TABLE public.institution_payroll             FORCE ROW LEVEL SECURITY;
ALTER TABLE public.institution_procurement         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.institution_credit_applications FORCE ROW LEVEL SECURITY;
ALTER TABLE public.institution_investments         FORCE ROW LEVEL SECURITY;

-- ---- fee categories: read = any tenant staff, write = admin/treasurer ----
CREATE POLICY fee_categories_school_read ON public.institution_fee_categories
  FOR SELECT TO authenticated
  USING (school_id = ANY (public.auth_school_ids()) OR (SELECT public.is_platform_admin()));

CREATE POLICY fee_categories_school_write ON public.institution_fee_categories
  FOR ALL TO authenticated
  USING (school_id = ANY (public.auth_school_ids())
         AND (SELECT public.auth_has_role('school_admin') OR public.auth_has_role('school_treasurer')))
  WITH CHECK (school_id = ANY (public.auth_school_ids()));

-- ---- payroll: read = admin/treasurer of the school, write = same, PATCH restricted ----
CREATE POLICY payroll_school_read ON public.institution_payroll
  FOR SELECT TO authenticated
  USING (
    school_id = ANY (public.auth_school_ids())
    AND (SELECT public.auth_has_role('school_admin') OR public.auth_has_role('school_treasurer'))
    OR (SELECT public.is_platform_admin())
  );

CREATE POLICY payroll_treasurer_insert ON public.institution_payroll
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = ANY (public.auth_school_ids())
    AND (SELECT public.auth_has_role('school_admin') OR public.auth_has_role('school_treasurer'))
  );

CREATE POLICY payroll_treasurer_update ON public.institution_payroll
  FOR UPDATE TO authenticated
  USING (
    school_id = ANY (public.auth_school_ids())
    AND (SELECT public.auth_has_role('school_admin') OR public.auth_has_role('school_treasurer'))
  )
  WITH CHECK (school_id = ANY (public.auth_school_ids()));

-- Disbursement itself is only ever performed via the SECURITY DEFINER RPC
-- (fn_execute_payroll_batch), not raw UPDATE — see Section 2.

-- ---- procurement: requester can insert/see own; admin/treasurer sees all & approves ----
CREATE POLICY procurement_school_read ON public.institution_procurement
  FOR SELECT TO authenticated
  USING (
    school_id = ANY (public.auth_school_ids())
    AND (
      requested_by = (SELECT auth.uid())
      OR (SELECT public.auth_has_role('school_admin') OR public.auth_has_role('school_treasurer'))
    )
    OR (SELECT public.is_platform_admin())
  );

CREATE POLICY procurement_staff_insert ON public.institution_procurement
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = ANY (public.auth_school_ids())
    AND requested_by = (SELECT auth.uid())
    AND status IN ('DRAFT','SUBMITTED')
  );

-- Requester may only edit their OWN item while still DRAFT/SUBMITTED (e.g. fix reviewed_* fields)
CREATE POLICY procurement_requester_update ON public.institution_procurement
  FOR UPDATE TO authenticated
  USING (requested_by = (SELECT auth.uid()) AND status IN ('DRAFT','SUBMITTED'))
  WITH CHECK (requested_by = (SELECT auth.uid()) AND status IN ('DRAFT','SUBMITTED'));

-- Finance admin/treasurer approves or rejects
CREATE POLICY procurement_finance_update ON public.institution_procurement
  FOR UPDATE TO authenticated
  USING (
    school_id = ANY (public.auth_school_ids())
    AND (SELECT public.auth_has_role('school_admin') OR public.auth_has_role('school_treasurer'))
  )
  WITH CHECK (school_id = ANY (public.auth_school_ids()));

-- Column-level hardening: a plain requester cannot set status/approved_* themselves
REVOKE UPDATE ON public.institution_procurement FROM authenticated;
GRANT UPDATE (vendor_name, category, description, amount, reviewed_vendor_name,
              reviewed_date, reviewed_amount, receipt_file_path)
  ON public.institution_procurement TO authenticated;
-- Finance approval columns (status, approved_by, approved_at, rejected_reason, paid_at,
-- ledger_transaction_id) are only ever written by the SECURITY DEFINER RPCs in Section 2.

-- ---- assets: read = tenant staff, write = admin/treasurer ----
CREATE POLICY assets_school_read ON public.institution_assets
  FOR SELECT TO authenticated
  USING (school_id = ANY (public.auth_school_ids()) OR (SELECT public.is_platform_admin()));

CREATE POLICY assets_school_write ON public.institution_assets
  FOR ALL TO authenticated
  USING (school_id = ANY (public.auth_school_ids())
         AND (SELECT public.auth_has_role('school_admin') OR public.auth_has_role('school_treasurer')))
  WITH CHECK (school_id = ANY (public.auth_school_ids()));

-- ---- credit applications: admin/treasurer only ----
CREATE POLICY credit_school_read ON public.institution_credit_applications
  FOR SELECT TO authenticated
  USING (
    school_id = ANY (public.auth_school_ids())
    AND (SELECT public.auth_has_role('school_admin') OR public.auth_has_role('school_treasurer'))
    OR (SELECT public.is_platform_admin())
  );

CREATE POLICY credit_school_write ON public.institution_credit_applications
  FOR ALL TO authenticated
  USING (school_id = ANY (public.auth_school_ids())
         AND (SELECT public.auth_has_role('school_admin') OR public.auth_has_role('school_treasurer')))
  WITH CHECK (school_id = ANY (public.auth_school_ids()));

-- ---- investments: admin/treasurer only ----
CREATE POLICY investments_school_read ON public.institution_investments
  FOR SELECT TO authenticated
  USING (
    school_id = ANY (public.auth_school_ids())
    AND (SELECT public.auth_has_role('school_admin') OR public.auth_has_role('school_treasurer'))
    OR (SELECT public.is_platform_admin())
  );

CREATE POLICY investments_school_write ON public.institution_investments
  FOR ALL TO authenticated
  USING (school_id = ANY (public.auth_school_ids())
         AND (SELECT public.auth_has_role('school_admin') OR public.auth_has_role('school_treasurer')))
  WITH CHECK (school_id = ANY (public.auth_school_ids()));

-- =====================================================================
-- 1.8 ATOMIC RPCs (SECURITY DEFINER, idempotent, ledger-posting)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1.8.1 Payroll batch disbursement
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_execute_payroll_batch(
  p_idempotency_key uuid,
  p_school_id       uuid,
  p_period          public.period_ym
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, valo_private, pg_temp
AS $$
DECLARE
  v_caller      uuid := auth.uid();
  v_fingerprint text;
  v_idem        public.idempotency_keys%rowtype;
  v_batch_id    uuid := gen_random_uuid();
  r             record;
  v_acct_school uuid;   -- school_escrow (funding source, mirrors BNI Giro)
  v_acct_clear  uuid;   -- platform_clearing (H2H disbursement suspense)
  v_count       integer := 0;
  v_total       numeric := 0;
  v_result      jsonb;
BEGIN
  IF NOT (p_school_id = ANY (public.auth_school_ids())
          AND (public.auth_has_role('school_admin') OR public.auth_has_role('school_treasurer'))) THEN
    RAISE EXCEPTION 'RLS_FORBIDDEN' USING errcode = '42501';
  END IF;

  v_fingerprint := encode(digest(p_school_id::text || '|' || p_period, 'sha256'), 'hex');

  INSERT INTO public.idempotency_keys (key, endpoint, actor_user_id, request_fingerprint, status)
  VALUES (p_idempotency_key, 'fn_execute_payroll_batch', v_caller, v_fingerprint, 'PROCESSING')
  ON CONFLICT (endpoint, key) DO NOTHING;

  IF NOT FOUND THEN
    SELECT * INTO v_idem FROM public.idempotency_keys
     WHERE endpoint = 'fn_execute_payroll_batch' AND key = p_idempotency_key FOR UPDATE;

    IF v_idem.request_fingerprint <> v_fingerprint THEN
      RETURN jsonb_build_object('error','IDEMPOTENCY_KEY_REUSE','http_status',422);
    ELSIF v_idem.status = 'COMPLETED' THEN
      RETURN v_idem.response_snapshot || jsonb_build_object('replayed', true);
    ELSE
      RETURN jsonb_build_object('error','REQUEST_IN_PROGRESS','http_status',409);
    END IF;
  END IF;

  v_acct_school := valo_private.fn_ensure_account('school_escrow', p_school_id, NULL, NULL, NULL);
  v_acct_clear  := valo_private.fn_ensure_account('platform_clearing');

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
               jsonb_build_object('account_id', v_acct_school, 'signed_amount', -r.net_salary),
               jsonb_build_object('account_id', v_acct_clear,  'signed_amount',  r.net_salary)
             ),
             format('Payroll disbursement %s', p_period), v_caller
           )
     WHERE id = r.id;

    v_count := v_count + 1;
    v_total := v_total + r.net_salary;
  END LOOP;

  v_result := jsonb_build_object(
    'batch_id', v_batch_id, 'period', p_period, 'staff_disbursed', v_count,
    'total_amount', v_total, 'http_status', 200
  );

  UPDATE public.idempotency_keys
     SET status='COMPLETED', response_snapshot=v_result, response_status=200, completed_at=now()
   WHERE endpoint='fn_execute_payroll_batch' AND key=p_idempotency_key;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_execute_payroll_batch(uuid,uuid,public.period_ym) FROM public, anon;
GRANT   EXECUTE ON FUNCTION public.fn_execute_payroll_batch(uuid,uuid,public.period_ym) TO authenticated;

-- ---------------------------------------------------------------------
-- 1.8.2 Procurement / reimbursement approval & disbursement
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_resolve_procurement(
  p_idempotency_key uuid,
  p_procurement_id  uuid,
  p_decision        text,   -- 'APPROVE' | 'REJECT'
  p_rejection_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, valo_private, pg_temp
AS $$
DECLARE
  v_caller  uuid := auth.uid();
  v_row     public.institution_procurement%rowtype;
  v_fingerprint text;
  v_idem    public.idempotency_keys%rowtype;
  v_acct_school uuid;
  v_acct_clear  uuid;
  v_ledger_id   uuid;
  v_result  jsonb;
BEGIN
  IF p_decision NOT IN ('APPROVE','REJECT') THEN
    RAISE EXCEPTION 'INVALID_DECISION' USING errcode = '22023';
  END IF;

  SELECT * INTO v_row FROM public.institution_procurement WHERE id = p_procurement_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','NOT_FOUND','http_status',404);
  END IF;

  IF NOT (v_row.school_id = ANY (public.auth_school_ids())
          AND (public.auth_has_role('school_admin') OR public.auth_has_role('school_treasurer'))) THEN
    RAISE EXCEPTION 'RLS_FORBIDDEN' USING errcode = '42501';
  END IF;

  IF v_row.status NOT IN ('SUBMITTED','UNDER_REVIEW') THEN
    RETURN jsonb_build_object('error','INVALID_STATE','http_status',409);
  END IF;

  -- Guardrail: low-confidence OCR reimbursements cannot skip straight to approval
  -- from the frontend without the reviewed_* fields populated by a human.
  IF v_row.type = 'REIMBURSEMENT' AND p_decision = 'APPROVE'
     AND (v_row.reviewed_amount IS NULL OR v_row.reviewed_vendor_name IS NULL) THEN
    RETURN jsonb_build_object('error','HITL_REVIEW_INCOMPLETE','http_status',422);
  END IF;

  v_fingerprint := encode(digest(p_procurement_id::text || '|' || p_decision, 'sha256'), 'hex');
  INSERT INTO public.idempotency_keys (key, endpoint, actor_user_id, request_fingerprint, status)
  VALUES (p_idempotency_key, 'fn_resolve_procurement', v_caller, v_fingerprint, 'PROCESSING')
  ON CONFLICT (endpoint, key) DO NOTHING;

  IF NOT FOUND THEN
    SELECT * INTO v_idem FROM public.idempotency_keys
     WHERE endpoint = 'fn_resolve_procurement' AND key = p_idempotency_key FOR UPDATE;
    IF v_idem.status = 'COMPLETED' THEN
      RETURN v_idem.response_snapshot || jsonb_build_object('replayed', true);
    END IF;
  END IF;

  IF p_decision = 'REJECT' THEN
    UPDATE public.institution_procurement
       SET status = 'REJECTED', rejected_reason = p_rejection_reason,
           approved_by = v_caller, approved_at = now(), updated_at = now()
     WHERE id = p_procurement_id;

    v_result := jsonb_build_object('procurement_id', p_procurement_id, 'status','REJECTED','http_status',200);
  ELSE
    v_acct_school := valo_private.fn_ensure_account('school_escrow', v_row.school_id, NULL, NULL, NULL);
    v_acct_clear  := valo_private.fn_ensure_account('platform_clearing');

    v_ledger_id := valo_private.fn_post_journal(
      'MANUAL_ADJUSTMENT', 'institution_procurement', v_row.id, v_row.school_id,
      (now() AT TIME ZONE 'Asia/Jakarta')::date,
      jsonb_build_array(
        jsonb_build_object('account_id', v_acct_school, 'signed_amount', -coalesce(v_row.reviewed_amount, v_row.amount)),
        jsonb_build_object('account_id', v_acct_clear,  'signed_amount',  coalesce(v_row.reviewed_amount, v_row.amount))
      ),
      format('Procurement/reimbursement disbursement %s', v_row.id), v_caller
    );

    UPDATE public.institution_procurement
       SET status = 'PAID', approved_by = v_caller, approved_at = now(),
           paid_at = now(), ledger_transaction_id = v_ledger_id, updated_at = now()
     WHERE id = p_procurement_id;

    v_result := jsonb_build_object('procurement_id', p_procurement_id, 'status','PAID','http_status',200);
  END IF;

  UPDATE public.idempotency_keys
     SET status='COMPLETED', response_snapshot=v_result, response_status=200, completed_at=now()
   WHERE endpoint='fn_resolve_procurement' AND key=p_idempotency_key;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_resolve_procurement(uuid,uuid,text,text) FROM public, anon;
GRANT   EXECUTE ON FUNCTION public.fn_resolve_procurement(uuid,uuid,text,text) TO authenticated;

-- =====================================================================
-- 1.9 DEMO SEED DATA — DEMO_SCHOOL_ID = 09c77f03-7f77-4c26-8da4-6ad5462f860c
-- =====================================================================

DO $$
DECLARE
  v_school   uuid := '09c77f03-7f77-4c26-8da4-6ad5462f860c';
  v_merchant uuid;
  v_cat_spp  uuid;
  v_cat_gedung uuid;
  v_cat_seragam uuid;
  v_cat_kegiatan uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id = v_school) THEN
    RAISE NOTICE 'Demo school % not found — skipping institution seed', v_school;
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
  ON CONFLICT (school_id, category, label) DO NOTHING
  RETURNING id INTO v_cat_spp; -- (first insert id captured only; fine for demo)

  SELECT id INTO v_cat_spp      FROM public.institution_fee_categories WHERE school_id = v_school AND category = 'SPP_BULANAN' LIMIT 1;
  SELECT id INTO v_cat_gedung   FROM public.institution_fee_categories WHERE school_id = v_school AND category = 'UANG_GEDUNG' LIMIT 1;
  SELECT id INTO v_cat_seragam  FROM public.institution_fee_categories WHERE school_id = v_school AND category = 'SERAGAM' LIMIT 1;
  SELECT id INTO v_cat_kegiatan FROM public.institution_fee_categories WHERE school_id = v_school AND category = 'KEGIATAN' LIMIT 1;

  -- Payroll roster (5 staff)
  INSERT INTO public.institution_payroll
    (school_id, staff_name, nip, position, bni_account_number, bni_account_name, period,
     basic_salary, allowances, deductions, status)
  VALUES
    (v_school, 'Drs. Bambang Santoso', '198501012010011001', 'Kepala Sekolah', '0123456781', 'BAMBANG SANTOSO', to_char(now(),'YYYY-MM'), 8500000, 1500000, 250000, 'PENDING'),
    (v_school, 'Siti Rahmawati, S.Pd', '199003152012022002', 'Guru Matematika', '0123456782', 'SITI RAHMAWATI', to_char(now(),'YYYY-MM'), 5500000, 800000, 150000, 'PENDING'),
    (v_school, 'Ahmad Fauzi, S.Pd', '198812102015011003', 'Guru Bahasa Indonesia', '0123456783', 'AHMAD FAUZI', to_char(now(),'YYYY-MM'), 5200000, 700000, 140000, 'PENDING'),
    (v_school, 'Dewi Lestari', '199207202016022004', 'Staf Tata Usaha', '0123456784', 'DEWI LESTARI', to_char(now(),'YYYY-MM'), 4200000, 500000, 100000, 'PENDING'),
    (v_school, 'Rudi Hartono', '198606052014011005', 'Petugas Kebersihan', '0123456785', 'RUDI HARTONO', to_char(now(),'YYYY-MM'), 3200000, 300000, 80000, 'DISBURSED')
  ON CONFLICT DO NOTHING;

  -- Procurement: 1 PO + 2 reimbursements (1 pending OCR review, 1 approved)
  INSERT INTO public.institution_procurement
    (school_id, type, vendor_name, category, description, amount, status)
  VALUES
    (v_school, 'PURCHASE_ORDER', 'CV Sumber Alat Tulis', 'ATK', 'Pengadaan alat tulis kantor semester genap', 4500000, 'SUBMITTED')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.institution_procurement
    (school_id, type, vendor_name, category, description, amount, status,
     receipt_file_path, ocr_raw_json, ocr_confidence)
  VALUES
    (v_school, 'REIMBURSEMENT', 'Toko Bangunan Jaya', 'Perawatan Gedung', 'Perbaikan atap ruang kelas 3B', 1250000, 'SUBMITTED',
     'receipts/demo-nota-01.jpg',
     '{"vendor_guess":"Toko Bangunan Jaya","date_guess":"2026-08-10","total_guess":1250000,"items":["Genteng","Semen","Ongkos tukang"]}'::jsonb,
     0.91)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.institution_procurement
    (school_id, type, vendor_name, category, description, amount, status,
     receipt_file_path, reviewed_vendor_name, reviewed_date, reviewed_amount,
     approved_at, paid_at)
  VALUES
    (v_school, 'REIMBURSEMENT', 'Warung Makan Sederhana', 'Konsumsi Rapat', 'Konsumsi rapat wali murid', 850000, 'PAID',
     'receipts/demo-nota-02.jpg', 'Warung Makan Sederhana', '2026-08-05', 850000, now(), now())
  ON CONFLICT DO NOTHING;

  -- Assets: 5 non-working + 3 working (merchant)
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
    (school_id, plafon_amount, tenor_months, purpose, estimated_interest_rate, status, submitted_at)
  VALUES
    (v_school, 150000000, 24, 'Modal kerja renovasi kantin dan pengadaan fasilitas belajar semester baru',
     9.5, 'SUBMITTED', now())
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
```

---

## 2. API Endpoints

### `types/institution.ts` (kontrak bersama FE/BE)

```typescript
// types/institution.ts

export type FeeCategoryCode = "SPP_BULANAN" | "UANG_GEDUNG" | "SERAGAM" | "KEGIATAN" | "LAINNYA";
export type PayrollStatus = "DRAFT" | "PENDING" | "PROCESSING" | "DISBURSED" | "FAILED";
export type ProcurementType = "PURCHASE_ORDER" | "REIMBURSEMENT";
export type ProcurementStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "PAID";
export type AssetKind = "NON_WORKING" | "WORKING";
export type AssetCondition = "BAIK" | "PERLU_PERBAIKAN" | "RUSAK";
export type CreditStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "DISBURSED" | "CLOSED";
export type InvestmentType = "BNI_DEPOSITO" | "SUKUK_NEGARA" | "REKSADANA_PASAR_UANG";
export type InvestmentStatus = "ACTIVE" | "MATURED" | "WITHDRAWN";

export interface FeeCategory {
  id: string;
  school_id: string;
  category: FeeCategoryCode;
  label: string;
  default_amount: number;
  is_recurring: boolean;
  is_active: boolean;
}

export interface PayrollRecord {
  id: string;
  school_id: string;
  staff_name: string;
  nip: string | null;
  position: string;
  bni_account_number: string;
  bni_account_name: string;
  period: string; // YYYY-MM
  basic_salary: number;
  allowances: number;
  deductions: number;
  net_salary: number; // generated column, read-only
  status: PayrollStatus;
  batch_id: string | null;
  bni_h2h_reference: string | null;
  paid_at: string | null;
  failure_reason: string | null;
}

export interface PayrollBatchExecuteRequest {
  school_id: string;
  period: string; // YYYY-MM
  idempotency_key: string; // client-generated UUID, required
}

export interface PayrollBatchExecuteResponse {
  batch_id: string;
  period: string;
  staff_disbursed: number;
  total_amount: number;
}

export interface ProcurementItem {
  id: string;
  school_id: string;
  type: ProcurementType;
  requested_by: string | null;
  vendor_name: string;
  category: string;
  description: string | null;
  amount: number;
  status: ProcurementStatus;
  receipt_file_path: string | null;
  ocr_raw_json: OcrExtractionResult | null;
  ocr_confidence: number | null;
  reviewed_vendor_name: string | null;
  reviewed_date: string | null;
  reviewed_amount: number | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  paid_at: string | null;
}

export interface OcrExtractionResult {
  vendor_guess: string;
  date_guess: string;   // YYYY-MM-DD
  total_guess: number;
  items: string[];
  confidence: number;   // 0..1
}

export interface ProcurementResolveRequest {
  procurement_id: string;
  decision: "APPROVE" | "REJECT";
  rejection_reason?: string;
  idempotency_key: string;
}

export interface InstitutionAsset {
  id: string;
  school_id: string;
  kind: AssetKind;
  merchant_id: string | null;
  asset_name: string;
  asset_code: string | null;
  category: string;
  location: string | null;
  quantity: number;
  condition: AssetCondition;
  acquisition_date: string | null;
  acquisition_value: number | null;
}

export interface CreditApplication {
  id: string;
  school_id: string;
  plafon_amount: number;
  tenor_months: number;
  purpose: string;
  estimated_interest_rate: number;
  estimated_monthly_installment: number | null;
  status: CreditStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  disbursed_at: string | null;
}

export interface InvestmentPosition {
  id: string;
  school_id: string;
  investment_type: InvestmentType;
  principal_amount: number;
  expected_yield_rate: number;
  accumulated_yield: number;
  placement_date: string;
  maturity_date: string | null;
  status: InvestmentStatus;
}

export interface ApiErrorResponse {
  error: string;
  http_status: number;
  detail?: string;
}
```

### 2.1 `app/api/v1/schools/[id]/payroll/route.ts` (referensi lengkap)

```typescript
// app/api/v1/schools/[id]/payroll/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { PayrollBatchExecuteResponse } from "@/types/institution";

export const dynamic = "force-dynamic";

const executeBatchSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format periode harus YYYY-MM"),
  idempotency_key: z.string().uuid(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: schoolId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const searchParams = req.nextUrl.searchParams;
  const period = searchParams.get("period") ?? new Date().toISOString().slice(0, 7);

  // RLS on institution_payroll already scopes rows to auth_school_ids(); we still
  // use the request-scoped client (not the service client) so RLS is enforced.
  const { data, error } = await supabase
    .from("institution_payroll")
    .select("*")
    .eq("school_id", schoolId)
    .eq("period", period)
    .order("staff_name");

  if (error) {
    return NextResponse.json({ error: "QUERY_FAILED", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ period, roster: data });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: schoolId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = executeBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Delegate atomicity + idempotency + ledger posting entirely to the RPC.
  // We call it through the *user-scoped* client so auth.uid()/auth_school_ids()
  // resolve correctly inside the SECURITY DEFINER function.
  const { data, error } = await supabase.rpc("fn_execute_payroll_batch", {
    p_idempotency_key: parsed.data.idempotency_key,
    p_school_id: schoolId,
    p_period: parsed.data.period,
  });

  if (error) {
    return NextResponse.json({ error: "RPC_FAILED", detail: error.message }, { status: 500 });
  }

  const result = data as PayrollBatchExecuteResponse & { error?: string; http_status?: number };
  if (result.error) {
    return NextResponse.json(result, { status: result.http_status ?? 400 });
  }

  return NextResponse.json(result, { status: 200 });
}
```

> **Pola yang sama** dipakai di seluruh route lain — perbedaannya hanya nama tabel/RPC dan skema zod. Ringkasan tiap route:

### 2.2 `app/api/v1/schools/[id]/procurement/route.ts`
- `GET` — query params `?type=PURCHASE_ORDER|REIMBURSEMENT&status=...`, `select("*")` dari `institution_procurement` (RLS otomatis membatasi requester ke baris miliknya sendiri).
- `POST` — body `{ type, vendor_name, category, description, amount, receipt_file_path? }`, insert langsung (RLS `procurement_staff_insert` memvalidasi `requested_by = auth.uid()`).
- `PATCH` — body `ProcurementResolveRequest`; **tidak** melakukan `UPDATE` langsung — memanggil `supabase.rpc("fn_resolve_procurement", {...})` agar approval selalu lewat jalur atomik & ter-audit.

### 2.3 `app/api/v1/schools/[id]/procurement/ocr/route.ts`
```typescript
// Simulasi AI OCR — production akan memanggil layanan vision model sungguhan.
const ocrSimulationSchema = z.object({ receipt_file_path: z.string().min(1) });

export async function POST(req: NextRequest) {
  const body = ocrSimulationSchema.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });

  // Simulated deterministic-ish extraction for demo purposes.
  const result: OcrExtractionResult = {
    vendor_guess: "Toko Sumber Rejeki",
    date_guess: new Date().toISOString().slice(0, 10),
    total_guess: 275000,
    items: ["Kertas HVS A4", "Tinta Printer"],
    confidence: 0.86,
  };

  // confidence < 0.75 → FE wajib menampilkan banner "Perlu koreksi manual" dan
  // mengunci tombol "Setujui & Cairkan" sampai reviewed_* diisi.
  return NextResponse.json(result);
}
```

### 2.4 `app/api/v1/schools/[id]/assets/route.ts`
- `GET` — `?kind=NON_WORKING|WORKING`, join opsional ke `merchants(name)` untuk aset `WORKING`.
- `POST` — body divalidasi dengan **discriminated union** zod agar `merchant_id` wajib ada hanya ketika `kind === "WORKING"` — mencerminkan `ck_assets_merchant_shape` di DB (defense-in-depth, bukan pengganti constraint DB).

```typescript
const assetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("NON_WORKING"),
    asset_name: z.string().min(2),
    category: z.string().min(2),
    location: z.string().optional(),
    quantity: z.number().int().positive().default(1),
    condition: z.enum(["BAIK", "PERLU_PERBAIKAN", "RUSAK"]).default("BAIK"),
  }),
  z.object({
    kind: z.literal("WORKING"),
    merchant_id: z.string().uuid(),
    asset_name: z.string().min(2),
    category: z.string().min(2),
    location: z.string().optional(),
    quantity: z.number().int().positive().default(1),
    condition: z.enum(["BAIK", "PERLU_PERBAIKAN", "RUSAK"]).default("BAIK"),
  }),
]);
```

### 2.5 `app/api/v1/schools/[id]/financial/route.ts`
- `GET` — mengembalikan `{ credit_applications, investments }` sekaligus (2 query paralel via `Promise.all`) agar dashboard finansial 1x round-trip.
- `POST` — body `{ resource: "credit" | "investment", payload }`; untuk `credit`, hitung `estimated_monthly_installment` di server (Section 5 formula) sebelum insert agar FE tidak bisa memalsukan angka cicilan.

---

## 3. UI Pages & Components

### 3.1 Pola Server Component (mengikuti `app/(school)/school/spp/page.tsx` yang sudah ada)

```tsx
// app/(school)/school/payroll/page.tsx
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import PayrollBatchTable from "@/components/school/PayrollBatchTable";
import { Wallet } from "lucide-react";

export const metadata: Metadata = { title: "Payroll Guru & Staf" };
export const dynamic = "force-dynamic";

export default async function SchoolPayrollPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const appMetadata = user.app_metadata || {};
  const userSchoolIds: string[] = Array.isArray(appMetadata.school_ids) ? appMetadata.school_ids : [];

  const service = createServiceClient();
  let schoolId: string | null = userSchoolIds[0] || null;
  if (!schoolId) {
    const { data: roles } = await service
      .from("user_roles")
      .select("school_id")
      .eq("user_id", user.id)
      .is("revoked_at", null);
    schoolId = roles?.[0]?.school_id || null;
  }
  if (!schoolId) redirect("/login");

  const currentPeriod = new Date().toISOString().slice(0, 7);

  const { data: roster } = await service
    .from("institution_payroll")
    .select("*")
    .eq("school_id", schoolId)
    .eq("period", currentPeriod)
    .order("staff_name");

  return (
    <div className="space-y-6" data-portal="school">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Payroll Guru & Staf</h1>
          <p className="text-sm text-muted-foreground">
            Roster gaji, batch disbursement BNI H2H, dan slip gaji digital
          </p>
        </div>
      </div>

      <PayrollBatchTable
        schoolId={schoolId}
        initialPeriod={currentPeriod}
        initialRoster={roster ?? []}
      />
    </div>
  );
}
```

Klien (`PayrollBatchTable`, `"use client"`) bertanggung jawab atas:
- state tabel roster + filter periode,
- tombol **"Eksekusi Batch Payroll BNI"**: generate `crypto.randomUUID()` sebagai `idempotency_key`, tampilkan modal konfirmasi (jumlah staf, total nominal), lalu `POST /api/v1/schools/[id]/payroll` dengan status `processing → success/error`,
- disable tombol re-submit selama request in-flight (mencegah double click memicu 2 idempotency key berbeda — tombol harus disabled, bukan cuma RPC yang idempotent),
- modal **"Cetak Slip Gaji"**: render struct payslip dari 1 baris `PayrollRecord`, tombol print via `window.print()` dengan CSS `@media print`.

### 3.2 Pola yang sama untuk modul lain (ringkas — mengikuti struktur identik di atas)

| Halaman | Server Component fetch | Client Component utama | Interaksi kunci |
|---|---|---|---|
| `school/spp/page.tsx` (modify) | `spp_invoices` join `institution_fee_categories`, `students` | `SPPReconciliationTable` (tambah props `feeCategories: FeeCategory[]`, tab switch by `category`) | Modal kuitansi digital: render `receipt_qr_hash` sebagai QR (pakai lib `qrcode` client-side), badge "Terverifikasi BNI H2H" |
| `school/procurement/page.tsx` (new) | `institution_procurement` (2 query: `PURCHASE_ORDER`, `REIMBURSEMENT`) | `ProcurementTabs` → `POTable` + `ReimbursementOcrPanel` | Upload nota → `POST .../ocr` → isi form HITL (`reviewed_vendor_name`, `reviewed_date`, `reviewed_amount`) → submit → admin klik "Setujui & Cairkan" → `PATCH` (memanggil RPC `fn_resolve_procurement`) |
| `school/assets/page.tsx` (new) | `institution_assets` (2 query: `NON_WORKING`, `WORKING` + join `merchants(name)`) | `AssetTabs` → `NonWorkingAssetTable` + `MerchantAssetTable` | Badge kondisi berwarna (`BAIK`=success, `PERLU_PERBAIKAN`=warning, `RUSAK`=danger) |
| `school/financial/page.tsx` (new) | `institution_credit_applications`, `institution_investments` | `CreditApplicationForm`, `InvestmentPortfolioCard`, `RunwaySimulator` | Slider `collection_rate` & `monthly_expense` men-drive kalkulasi runway real-time di client (pure function, Section 5) — **tidak** perlu roundtrip API |

---

## 4. Navigation Integration

### `app/(school)/_components/Sidebar.tsx` (revisi lengkap)

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  ShieldCheck,
  Bot,
  User,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  GraduationCap,
  Building2,
  LogOut,
  Wallet,
  ShoppingCart,
  Boxes,
  Landmark,
} from "lucide-react";
import { handleLogout } from "@/lib/auth/actions";

interface SidebarProps {
  schoolName?: string;
}

const NAV_ITEMS = [
  { href: "/school", label: "Dashboard", icon: LayoutDashboard },
  { href: "/school/students", label: "Manajemen Siswa", icon: Users },
  { href: "/school/spp", label: "Tagihan & SPP", icon: FileText },
  { href: "/school/payroll", label: "Payroll Guru & Staf", icon: Wallet },
  { href: "/school/procurement", label: "Pengadaan & Reimburse", icon: ShoppingCart },
  { href: "/school/assets", label: "Inventaris Aset", icon: Boxes },
  { href: "/school/financial", label: "Investasi & Kredit Bank", icon: Landmark },
  { href: "/school/ai", label: "Treasury AI", icon: Bot },
  { href: "/school/audit", label: "Audit & Kepatuhan", icon: ShieldCheck },
] as const;

export function Sidebar({ schoolName = "VALO School" }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      data-portal="school"
      className={`sticky top-0 h-screen shrink-0 border-r border-portal-border bg-portal-surface flex flex-col transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex h-14 items-center justify-between border-b border-portal-border px-4">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 truncate">
            <div className="flex h-8 w-8 items-center justify-center rounded-portal bg-portal-primary/15 border border-portal-primary/30 text-portal-primary">
              <GraduationCap size={18} />
            </div>
            <div className="truncate">
              <p className="text-[10px] uppercase tracking-wider text-portal-muted">VALO</p>
              <p className="truncate text-xs font-semibold text-portal-text">{schoolName}</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-portal bg-portal-primary/15 border border-portal-primary/30 text-portal-primary">
            <GraduationCap size={18} />
          </div>
        )}

        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
          className="ml-auto rounded-portal p-1.5 text-portal-muted hover:bg-portal-surface-alt hover:text-portal-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-portal-primary"
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto space-y-1 p-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/school" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              id={`school-nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-portal px-3 py-2 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-portal-primary ${
                active
                  ? "bg-portal-primary text-portal-primary-foreground font-semibold"
                  : "text-portal-muted hover:bg-portal-surface-alt hover:text-portal-text"
              }`}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-portal-border p-3 space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Building2 size={16} className="text-portal-muted shrink-0" />
          {!collapsed && (
            <div className="truncate">
              <p className="text-[10px] text-portal-muted leading-tight">Terhubung ke BNI H2H</p>
              <div className="flex items-center gap-1 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-portal-success" />
                <span className="text-[11px] text-portal-success font-medium">SNAP BI Active</span>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          id="school-logout-sidebar-btn"
          onClick={() => handleLogout("/login")}
          className="flex w-full items-center gap-3 rounded-portal px-3 py-2 text-xs font-semibold text-portal-danger hover:bg-portal-danger/15 transition-colors border border-portal-danger/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-portal-primary"
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span className="truncate">Keluar / Switch User</span>}
        </button>
      </div>
    </aside>
  );
}
```

> Catatan: item **"Profil Sekolah"** dan **"Pengaturan"** di file asli dihilangkan dari daftar 9-item plan aslinya (plan menyebut 9 item persis: Dashboard, Manajemen Siswa, Tagihan & SPP, Payroll, Pengadaan, Aset, Finansial, Treasury AI, Audit). Jika kedua item itu masih dipakai di rute lain, pertahankan dan jadikan 11 item — sebutkan preferensinya, karena ini murni keputusan produk, bukan keputusan teknis.

---

## 5. Formula Finansial (Kredit & Runway)

```typescript
// lib/finance/calculations.ts

/** Cicilan bulanan anuitas (flat-rate BNI working capital estimate). */
export function calculateMonthlyInstallment(
  plafonAmount: number,
  annualInterestRatePct: number,
  tenorMonths: number
): number {
  const r = annualInterestRatePct / 100 / 12; // monthly rate
  if (r === 0) return plafonAmount / tenorMonths;
  const factor = (r * Math.pow(1 + r, tenorMonths)) / (Math.pow(1 + r, tenorMonths) - 1);
  return Math.round(plafonAmount * factor);
}

export interface RunwayInput {
  currentLiquidity: number;      // saldo Giro + escrow saat ini
  monthlyOperationalExpense: number;
  expectedMonthlyTuitionGross: number; // total tagihan SPP jatuh tempo per bulan
  collectionRatePct: number;     // 0..100, asumsi persentase tagihan yang benar2 tertagih
}

export interface RunwayResult {
  netMonthlyCashflow: number;
  runwayMonths: number | null; // null berarti "runway tak terbatas" (cashflow positif)
}

/** Proyeksi runway likuiditas sekolah berdasarkan tingkat penagihan SPP. */
export function calculateRunway(input: RunwayInput): RunwayResult {
  const collected = input.expectedMonthlyTuitionGross * (input.collectionRatePct / 100);
  const netMonthlyCashflow = collected - input.monthlyOperationalExpense;

  if (netMonthlyCashflow >= 0) {
    return { netMonthlyCashflow, runwayMonths: null };
  }

  const runwayMonths = input.currentLiquidity / Math.abs(netMonthlyCashflow);
  return { netMonthlyCashflow, runwayMonths: Math.max(0, Math.floor(runwayMonths * 10) / 10) };
}
```

Server route `financial/route.ts` memanggil `calculateMonthlyInstallment` sebelum `INSERT` ke `institution_credit_applications`, sehingga `estimated_monthly_installment` yang tersimpan **selalu dihitung server-side**, bukan dikirim dari client.

---

## 6. Phased Execution Steps

| Fase | Deliverable | Detail |
|---|---|---|
| **Fase 1 — Migrasi DB** | `20260816_institution_full_modules.sql` | Jalankan via `supabase migration up` / `supabase db push` di environment staging dulu. Verifikasi `\d+ institution_*` dan jalankan `SELECT * FROM valo_private.fn_integrity_check();` (lihat Section 7) sebelum lanjut. |
| **Fase 2 — RPC & Grant Audit** | `fn_execute_payroll_batch`, `fn_resolve_procurement` | Uji manual: panggil RPC 2x dengan `idempotency_key` sama → pastikan response kedua punya `"replayed": true` dan **tidak** ada baris ledger ganda (`SELECT count(*) FROM ledger_entries WHERE transaction_id = ...`). |
| **Fase 3 — API Routes** | 5 route handler + `types/institution.ts` | `npx tsc --noEmit` setelah setiap file. Uji dengan Postman/Thunder Client memakai token role `school_treasurer` **dan** `parent` untuk memverifikasi RLS menolak yang seharusnya ditolak (403/empty result). |
| **Fase 4 — UI Pages** | `payroll`, `procurement`, `assets`, `financial` pages + modifikasi `spp` page | Build tiap halaman terhadap data demo (`DEMO_SCHOOL_ID`) sebelum hook ke RPC live. Terapkan `force-dynamic` di semua Server Component baru. |
| **Fase 5 — Sidebar Integration** | `Sidebar.tsx` | Update `NAV_ITEMS`, smoke test seluruh link di viewport collapsed & expanded. |
| **Fase 6 — Verifikasi Otomatis & Manual** | Lihat Section 7 | Jalankan sebelum merge ke `main`. |

---

## 7. Verification Plan

### 7.1 Automated

```bash
npx tsc --noEmit
```

Tambahkan 4 assertion baru ke `valo_private.fn_integrity_check()` (extend `UNION ALL` yang sudah ada di schema v3):

```sql
CREATE OR REPLACE FUNCTION valo_private.fn_integrity_check()
RETURNS TABLE (check_name text, violations bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  -- ... (semua check existing tetap dipertahankan) ...
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
```

### 7.2 Manual

- **Multi-category SPP**: buat 2 tagihan periode sama untuk 1 siswa dengan kategori berbeda (`SPP_BULANAN` & `KEGIATAN`) → pastikan **tidak** error `23505`; buat 2 tagihan kategori **sama** periode sama → pastikan **error** (constraint bekerja).
- **Batch Payroll**: klik "Eksekusi Batch Payroll BNI" 2x berturut-turut cepat (double click) → pastikan hanya 1 batch tereksekusi (tombol disabled setelah klik pertama).
- **OCR HITL**: upload nota → cek `ocr_confidence` < 0.75 memicu banner review wajib; coba klik "Setujui & Cairkan" tanpa mengisi `reviewed_amount` → harus ditolak RPC dengan `HITL_REVIEW_INCOMPLETE`.
- **RLS Cross-Tenant**: login sebagai `school_treasurer` sekolah A, coba `GET /api/v1/schools/{school_B_id}/payroll` → harus mengembalikan array kosong (bukan 500/leak).
- **Digital Receipt QR**: verifikasi `receipt_qr_hash` unik per invoice dan modal menampilkan referensi H2H yang sama dengan `bni_h2h_reference`.
- **Financial Simulation**: geser slider `collection_rate` ke 100% dan 0% → pastikan `runwayMonths` berubah sesuai formula (uji dengan kalkulator manual sebagai pembanding).

---

## Ringkasan File yang Berubah/Ditambah

```
supabase/migrations/20260816_institution_full_modules.sql   [NEW]
types/institution.ts                                        [NEW]
lib/finance/calculations.ts                                 [NEW]
app/api/v1/schools/[id]/payroll/route.ts                     [NEW]
app/api/v1/schools/[id]/procurement/route.ts                 [NEW]
app/api/v1/schools/[id]/procurement/ocr/route.ts              [NEW]
app/api/v1/schools/[id]/assets/route.ts                       [NEW]
app/api/v1/schools/[id]/financial/route.ts                    [NEW]
app/(school)/school/payroll/page.tsx                          [NEW]
app/(school)/school/procurement/page.tsx                      [NEW]
app/(school)/school/assets/page.tsx                            [NEW]
app/(school)/school/financial/page.tsx                         [NEW]
app/(school)/school/spp/page.tsx                               [MODIFY]
components/school/SPPReconciliationTable.tsx                   [MODIFY]
app/(school)/_components/Sidebar.tsx                           [MODIFY]
```
