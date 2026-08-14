-- =====================================================================
-- VALO EDUCATION ECOSYSTEM - CORE SCHEMA v3.0 (FIXED)
-- Target      : PostgreSQL 15+ / Supabase
-- Supersedes  : schema v2.0 & schema v3.0 (Array comparison bugfix)
-- Author      : Principal Database Architect
-- Currency    : IDR only in v3 (multi-currency ready via currency_code)
-- Timezone    : Business day = Asia/Jakarta (WIB, UTC+7)
-- =====================================================================

-- Clean Drop & Rebuild Guard
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

BEGIN;

-- =====================================================================
-- SECTION 0. EXTENSIONS, SCHEMAS, ROLE HARDENING
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Private schema: NOT exposed by PostgREST
CREATE SCHEMA IF NOT EXISTS valo_private;
REVOKE ALL ON SCHEMA valo_private FROM public, anon, authenticated;

-- Audit/reporting schema for read-only analytical views
CREATE SCHEMA IF NOT EXISTS valo_reporting;

-- Schema for Supabase custom Auth Hooks
CREATE SCHEMA IF NOT EXISTS supabase_functions;
REVOKE ALL ON SCHEMA supabase_functions FROM public, anon, authenticated;

COMMENT ON SCHEMA valo_private IS
  'Internal helpers and privileged routines. Never added to PostgREST db-schemas.';

-- =====================================================================
-- SECTION 1. ENUM TYPES AND DOMAINS
-- =====================================================================

CREATE TYPE public.user_role_t AS ENUM (
  'parent', 'school_admin', 'school_treasurer', 'merchant_owner',
  'merchant_staff', 'platform_admin', 'platform_support'
);

CREATE TYPE public.school_status_t   AS ENUM ('active','suspended','offboarded');
CREATE TYPE public.merchant_status_t AS ENUM ('pending','active','suspended','terminated');

CREATE TYPE public.student_status_t AS ENUM (
  'active','suspended','graduated','transferred_out','archived'
);

CREATE TYPE public.card_status_t AS ENUM (
  'pending_activation','active','lost_reported','blocked','replaced','retired'
);

CREATE TYPE public.guardian_relationship_t AS ENUM (
  'ayah','ibu','wali','kakek_nenek','saudara','institusi','lainnya'
);

CREATE TYPE public.guardian_link_status_t AS ENUM ('pending','active','revoked');

CREATE TYPE public.txn_status_t AS ENUM (
  'PENDING','SETTLED','REJECTED_OVERLIMIT','REJECTED_CARD_BLOCKED',
  'REJECTED_POST_HOC','REVERSED'
);

CREATE TYPE public.settlement_status_t AS ENUM (
  'UNSETTLED','BATCHED','DISBURSED','FAILED'
);

CREATE TYPE public.txn_channel_t AS ENUM ('ONLINE_TAP','OFFLINE_SYNC','MANUAL_ADJUSTMENT');

CREATE TYPE public.invoice_status_t AS ENUM (
  'DRAFT','UNPAID','PROCESSING','PAID','FAILED','OVERDUE','WAIVED','CANCELLED'
);

CREATE TYPE public.ledger_account_t AS ENUM (
  'parent_funding',      -- source of funds held at BNI, mirrored internally
  'student_pagu',        -- allowance control account per student
  'student_vault',       -- savings vault per student
  'student_advance',     -- receivable created by emergency overdraft
  'merchant_payable',    -- amount owed to a canteen merchant
  'school_escrow',       -- SPP collected, pending disbursement to Giro
  'platform_clearing',   -- suspense account for in-flight H2H movements
  'platform_revenue'
);

CREATE TYPE public.ledger_normal_balance_t AS ENUM ('DEBIT','CREDIT');

CREATE TYPE public.ledger_source_t AS ENUM (
  'CANTEEN_TAP','CANTEEN_REVERSAL','SPP_DEBIT','VAULT_ROLLOVER',
  'VAULT_WITHDRAWAL','ADVANCE_REPAYMENT','MERCHANT_DISBURSEMENT',
  'TOPUP','MANUAL_ADJUSTMENT','OFFBOARDING_PAYOUT'
);

CREATE TYPE public.card_event_t AS ENUM (
  'issued','activated','lost_reported','blocked','unblocked','reissued','retired','offboarded'
);

CREATE TYPE public.consent_type_t AS ENUM (
  'DATA_PROCESSING_MINOR','MARKETING','AI_ANALYTICS','BIOMETRIC_NONE'
);

CREATE TYPE public.sync_status_t AS ENUM ('PENDING','SYNCED','CONFLICT','DISCARDED');

CREATE TYPE public.idempotency_status_t AS ENUM ('PROCESSING','COMPLETED','FAILED');

CREATE TYPE public.ai_persona_t AS ENUM ('merchant_ai','school_treasury_ai','parent_ai');

-- Monetary domains
CREATE DOMAIN public.money_amt  AS numeric(14,2);
CREATE DOMAIN public.ledger_amt AS numeric(18,2);

CREATE DOMAIN public.idr_amt AS numeric(14,2)
  CHECK (VALUE = round(VALUE, 0));

CREATE DOMAIN public.period_ym AS text
  CHECK (VALUE ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

CREATE DOMAIN public.phone_e164 AS text
  CHECK (VALUE ~ '^\+[1-9][0-9]{7,14}$');

-- =====================================================================
-- SECTION 2. TENANT ROOT AND IDENTITY
-- =====================================================================

CREATE TABLE public.schools (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text NOT NULL CHECK (length(btrim(name)) BETWEEN 3 AND 200),
  npsn                    text UNIQUE CHECK (npsn ~ '^[0-9]{8}$'),
  bni_giro_account        text NOT NULL,
  address                 text,
  timezone                text NOT NULL DEFAULT 'Asia/Jakarta',
  default_daily_limit     public.idr_amt NOT NULL DEFAULT 20000,
  default_emergency_limit public.idr_amt NOT NULL DEFAULT 15000,
  status                  public.school_status_t NOT NULL DEFAULT 'active',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  deleted_at              timestamptz
);

COMMENT ON COLUMN public.schools.timezone IS
  'Per-tenant business day boundary. Schools outside WIB (WITA/WIT) get correct pagu windows.';

CREATE TABLE public.merchants (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  name                  text NOT NULL,
  pic_name              text,
  bni_merchant_account  text NOT NULL,
  status                public.merchant_status_t NOT NULL DEFAULT 'pending',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz,
  CONSTRAINT uq_merchants_id_school UNIQUE (id, school_id)
);

CREATE TABLE public.parents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name           text NOT NULL,
  phone_number        public.phone_e164 NOT NULL UNIQUE,
  phone_verified_at   timestamptz,
  email               text CHECK (email IS NULL OR email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  bni_account_number  text,
  bni_link_status     text NOT NULL DEFAULT 'PENDING_BANK_LINK'
                      CHECK (bni_link_status IN ('PENDING_BANK_LINK','LINKED','FAILED','REVOKED')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE TABLE public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  display_name  text NOT NULL,
  parent_id     uuid REFERENCES public.parents(id) ON DELETE RESTRICT,
  locale        text NOT NULL DEFAULT 'id-ID',
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_profiles_parent UNIQUE (parent_id)
);

CREATE TABLE public.user_roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role         public.user_role_t NOT NULL,
  school_id    uuid REFERENCES public.schools(id)   ON DELETE CASCADE,
  merchant_id  uuid REFERENCES public.merchants(id) ON DELETE CASCADE,
  granted_by   uuid REFERENCES public.profiles(id)  ON DELETE SET NULL,
  granted_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at   timestamptz,

  CONSTRAINT ck_user_roles_scope CHECK (
    CASE role
      WHEN 'parent'            THEN school_id IS NULL AND merchant_id IS NULL
      WHEN 'platform_admin'    THEN school_id IS NULL AND merchant_id IS NULL
      WHEN 'platform_support'  THEN school_id IS NULL AND merchant_id IS NULL
      WHEN 'school_admin'      THEN school_id IS NOT NULL AND merchant_id IS NULL
      WHEN 'school_treasurer'  THEN school_id IS NOT NULL AND merchant_id IS NULL
      WHEN 'merchant_owner'    THEN merchant_id IS NOT NULL
      WHEN 'merchant_staff'    THEN merchant_id IS NOT NULL
    END
  )
);

CREATE UNIQUE INDEX uq_user_roles_active
  ON public.user_roles (user_id, role, coalesce(school_id, merchant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE revoked_at IS NULL;

CREATE INDEX idx_user_roles_user_active ON public.user_roles (user_id) WHERE revoked_at IS NULL;

-- =====================================================================
-- SECTION 3. STUDENTS AND CARD CREDENTIALS
-- =====================================================================

CREATE TABLE public.students (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  full_name         text NOT NULL,
  student_number    text,
  class_label       text,
  date_of_birth     date,
  status            public.student_status_t NOT NULL DEFAULT 'active',

  daily_limit       public.idr_amt NOT NULL DEFAULT 20000 CHECK (daily_limit >= 0),
  emergency_approve boolean NOT NULL DEFAULT true,
  emergency_limit   public.idr_amt NOT NULL DEFAULT 15000 CHECK (emergency_limit >= 0),

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  offboarded_at     timestamptz,

  CONSTRAINT uq_students_id_school UNIQUE (id, school_id),
  CONSTRAINT uq_students_number_per_school UNIQUE (school_id, student_number)
);

CREATE TABLE public.student_cards (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  school_id           uuid NOT NULL REFERENCES public.schools(id)  ON DELETE RESTRICT,
  uid_hash            bytea NOT NULL,
  uid_last4           text CHECK (uid_last4 ~ '^[0-9A-Fa-f]{4}$'),
  status              public.card_status_t NOT NULL DEFAULT 'pending_activation',
  issued_at           timestamptz NOT NULL DEFAULT now(),
  activated_at        timestamptz,
  retired_at          timestamptz,
  replaced_by_card_id uuid REFERENCES public.student_cards(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ck_card_hash_len CHECK (octet_length(uid_hash) = 32),
  CONSTRAINT fk_cards_student_tenant
    FOREIGN KEY (student_id, school_id) REFERENCES public.students(id, school_id)
);

CREATE UNIQUE INDEX uq_cards_tenant_uid ON public.student_cards (school_id, uid_hash);

CREATE UNIQUE INDEX uq_cards_one_active
  ON public.student_cards (student_id)
  WHERE status IN ('active','pending_activation');

CREATE INDEX idx_cards_uid_active
  ON public.student_cards (uid_hash)
  WHERE status = 'active';

-- =====================================================================
-- SECTION 4. GUARDIANSHIP
-- =====================================================================

CREATE TABLE public.guardian_student_map (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id             uuid NOT NULL REFERENCES public.parents(id)  ON DELETE RESTRICT,
  student_id            uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  school_id             uuid NOT NULL REFERENCES public.schools(id)  ON DELETE RESTRICT,
  relationship          public.guardian_relationship_t NOT NULL DEFAULT 'wali',
  is_primary_guardian   boolean NOT NULL DEFAULT false,
  status                public.guardian_link_status_t NOT NULL DEFAULT 'pending',

  can_view_activity     boolean NOT NULL DEFAULT true,
  can_manage_pagu       boolean NOT NULL DEFAULT false,
  can_fund              boolean NOT NULL DEFAULT false,
  can_approve_vault     boolean NOT NULL DEFAULT false,
  can_report_card_lost  boolean NOT NULL DEFAULT true,

  valid_from            timestamptz NOT NULL DEFAULT now(),
  valid_until           timestamptz,
  revoked_at            timestamptz,
  revoked_reason        text,
  created_by            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_gsm_pair UNIQUE (parent_id, student_id),
  CONSTRAINT ck_gsm_validity CHECK (valid_until IS NULL OR valid_until > valid_from),
  CONSTRAINT ck_gsm_revoked  CHECK (
    (status = 'revoked') = (revoked_at IS NOT NULL)
  ),
  CONSTRAINT fk_gsm_student_tenant
    FOREIGN KEY (student_id, school_id) REFERENCES public.students(id, school_id)
);

CREATE UNIQUE INDEX uq_gsm_one_primary
  ON public.guardian_student_map (student_id)
  WHERE is_primary_guardian AND status = 'active';

CREATE INDEX idx_gsm_parent_active
  ON public.guardian_student_map (parent_id, student_id)
  WHERE status = 'active';

CREATE INDEX idx_gsm_student_active
  ON public.guardian_student_map (student_id, parent_id)
  WHERE status = 'active';

-- =====================================================================
-- SECTION 5. DAILY PAGU COUNTERS
-- =====================================================================

CREATE TABLE public.student_daily_counters (
  student_id          uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  business_date       date NOT NULL,
  school_id           uuid NOT NULL REFERENCES public.schools(id)  ON DELETE RESTRICT,
  limit_snapshot      public.idr_amt NOT NULL,
  spent_amount        public.idr_amt NOT NULL DEFAULT 0 CHECK (spent_amount >= 0),
  overdraft_amount    public.idr_amt NOT NULL DEFAULT 0 CHECK (overdraft_amount >= 0),
  overdraft_count     smallint NOT NULL DEFAULT 0 CHECK (overdraft_count >= 0),
  txn_count           integer NOT NULL DEFAULT 0,
  rolled_over_at      timestamptz,
  rolled_over_amount  public.idr_amt,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, business_date)
);

CREATE INDEX idx_sdc_overdraft
  ON public.student_daily_counters (student_id, business_date DESC)
  WHERE overdraft_count > 0;

CREATE INDEX idx_sdc_pending_rollover
  ON public.student_daily_counters (business_date)
  WHERE rolled_over_at IS NULL;

-- =====================================================================
-- SECTION 6. DOUBLE-ENTRY LEDGER
-- =====================================================================

CREATE TABLE public.ledger_accounts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type       public.ledger_account_t NOT NULL,
  normal_balance     public.ledger_normal_balance_t NOT NULL,
  currency_code      char(3) NOT NULL DEFAULT 'IDR',

  owner_school_id    uuid REFERENCES public.schools(id)   ON DELETE RESTRICT,
  owner_parent_id    uuid REFERENCES public.parents(id)   ON DELETE RESTRICT,
  owner_student_id   uuid REFERENCES public.students(id)  ON DELETE RESTRICT,
  owner_merchant_id  uuid REFERENCES public.merchants(id) ON DELETE RESTRICT,

  balance            public.ledger_amt NOT NULL DEFAULT 0,
  last_entry_seq     bigint NOT NULL DEFAULT 0,

  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ck_ledger_owner_shape CHECK (
    num_nonnulls(owner_school_id, owner_parent_id, owner_student_id, owner_merchant_id)
      = CASE WHEN account_type IN ('platform_clearing','platform_revenue') THEN 0 ELSE 1 END
  ),
  CONSTRAINT ck_ledger_owner_matches_type CHECK (
    CASE account_type
      WHEN 'parent_funding'    THEN owner_parent_id   IS NOT NULL
      WHEN 'student_pagu'      THEN owner_student_id  IS NOT NULL
      WHEN 'student_vault'     THEN owner_student_id  IS NOT NULL
      WHEN 'student_advance'   THEN owner_student_id  IS NOT NULL
      WHEN 'merchant_payable'  THEN owner_merchant_id IS NOT NULL
      WHEN 'school_escrow'     THEN owner_school_id   IS NOT NULL
      ELSE true
    END
  )
);

CREATE UNIQUE INDEX uq_ledger_acct_parent ON public.ledger_accounts (account_type, owner_parent_id)   WHERE owner_parent_id   IS NOT NULL;
CREATE UNIQUE INDEX uq_ledger_acct_student ON public.ledger_accounts (account_type, owner_student_id) WHERE owner_student_id  IS NOT NULL;
CREATE UNIQUE INDEX uq_ledger_acct_merchant ON public.ledger_accounts (account_type, owner_merchant_id) WHERE owner_merchant_id IS NOT NULL;
CREATE UNIQUE INDEX uq_ledger_acct_school ON public.ledger_accounts (account_type, owner_school_id)   WHERE owner_school_id   IS NOT NULL;
CREATE UNIQUE INDEX uq_ledger_acct_platform ON public.ledger_accounts (account_type, currency_code)
  WHERE account_type IN ('platform_clearing','platform_revenue');

CREATE TABLE public.ledger_transactions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source         public.ledger_source_t NOT NULL,
  source_table   text NOT NULL,
  source_id      uuid NOT NULL,
  school_id      uuid REFERENCES public.schools(id) ON DELETE RESTRICT,
  business_date  date NOT NULL,
  currency_code  char(3) NOT NULL DEFAULT 'IDR',
  description    text,
  reverses_id    uuid REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  posted_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_ledger_txn_source
  ON public.ledger_transactions (source, source_table, source_id)
  WHERE reverses_id IS NULL;

CREATE INDEX idx_ledger_txn_school_date ON public.ledger_transactions (school_id, business_date DESC);

CREATE TABLE public.ledger_entries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  account_id     uuid NOT NULL REFERENCES public.ledger_accounts(id)     ON DELETE RESTRICT,
  signed_amount  public.ledger_amt NOT NULL CHECK (signed_amount <> 0),
  entry_seq      bigint NOT NULL,
  balance_after  public.ledger_amt NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_ledger_entry_seq UNIQUE (account_id, entry_seq)
);

CREATE INDEX idx_ledger_entries_txn     ON public.ledger_entries (transaction_id);
CREATE INDEX idx_ledger_entries_account ON public.ledger_entries (account_id, entry_seq DESC);

CREATE OR REPLACE FUNCTION valo_private.trg_assert_journal_balanced()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_sum public.ledger_amt;
  v_cnt integer;
  v_txn uuid;
BEGIN
  IF tg_op = 'DELETE' THEN v_txn := old.transaction_id; ELSE v_txn := new.transaction_id; END IF;

  SELECT coalesce(sum(signed_amount), 0), count(*)
    INTO v_sum, v_cnt
    FROM public.ledger_entries
   WHERE transaction_id = v_txn;

  IF v_cnt = 0 THEN
    RETURN NULL;
  END IF;

  IF v_cnt < 2 THEN
    RAISE EXCEPTION 'LEDGER_UNBALANCED: journal % has % entry line(s), minimum is 2', v_txn, v_cnt
      USING errcode = '23514';
  END IF;

  IF v_sum <> 0 THEN
    RAISE EXCEPTION 'LEDGER_UNBALANCED: journal % sums to %, expected 0', v_txn, v_sum
      USING errcode = '23514';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER ct_ledger_entries_balanced
  AFTER INSERT OR UPDATE OR DELETE ON public.ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION valo_private.trg_assert_journal_balanced();

-- =====================================================================
-- SECTION 7. IMMUTABILITY ENFORCEMENT
-- =====================================================================

CREATE OR REPLACE FUNCTION valo_private.trg_forbid_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE_RECORD: % on %.% is not permitted',
    tg_op, tg_table_schema, tg_table_name
    USING errcode = '42501',
          hint = 'Post a compensating reversal entry instead of mutating history.';
END;
$$;

CREATE TRIGGER tg_ledger_txn_immutable
  BEFORE UPDATE OR DELETE ON public.ledger_transactions
  FOR EACH ROW EXECUTE FUNCTION valo_private.trg_forbid_mutation();

CREATE TRIGGER tg_ledger_entries_immutable
  BEFORE UPDATE OR DELETE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION valo_private.trg_forbid_mutation();

REVOKE UPDATE, DELETE, TRUNCATE ON public.ledger_transactions FROM public, anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.ledger_entries      FROM public, anon, authenticated;

-- =====================================================================
-- SECTION 8. CANTEEN TRANSACTIONS  (range-partitioned by month)
-- =====================================================================

CREATE TABLE public.canteen_transactions (
  id                    uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id             uuid NOT NULL,
  student_id            uuid NOT NULL,
  merchant_id           uuid NOT NULL,
  card_id               uuid,
  amount                public.idr_amt NOT NULL CHECK (amount > 0),
  status                public.txn_status_t NOT NULL DEFAULT 'PENDING',
  settlement_status     public.settlement_status_t NOT NULL DEFAULT 'UNSETTLED',
  channel               public.txn_channel_t NOT NULL DEFAULT 'ONLINE_TAP',
  is_emergency          boolean NOT NULL DEFAULT false,
  emergency_amount      public.idr_amt NOT NULL DEFAULT 0 CHECK (emergency_amount >= 0),
  idempotency_key       uuid NOT NULL,
  client_local_tx_uuid  uuid,
  settlement_batch_id   uuid,
  ledger_transaction_id uuid,
  reversal_of_id        uuid,
  items                 jsonb NOT NULL DEFAULT '[]'::jsonb,
  rejection_reason      text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  business_date         date NOT NULL
    GENERATED ALWAYS AS (((created_at AT TIME ZONE 'Asia/Jakarta'))::date) STORED,

  CONSTRAINT pk_canteen_transactions PRIMARY KEY (id, created_at),
  CONSTRAINT ck_ctx_emergency_amount CHECK (
    (is_emergency AND emergency_amount > 0) OR (NOT is_emergency AND emergency_amount = 0)
  ),
  CONSTRAINT ck_ctx_items_array CHECK (jsonb_typeof(items) = 'array'),
  CONSTRAINT fk_ctx_student_tenant
    FOREIGN KEY (student_id, school_id) REFERENCES public.students(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT fk_ctx_merchant_tenant
    FOREIGN KEY (merchant_id, school_id) REFERENCES public.merchants(id, school_id) ON DELETE RESTRICT
) PARTITION BY RANGE (created_at);

CREATE INDEX idx_ctx_idem ON public.canteen_transactions (idempotency_key);
CREATE INDEX idx_ctx_student_time ON public.canteen_transactions (student_id, created_at DESC);
CREATE INDEX idx_ctx_merchant_bdate ON public.canteen_transactions (merchant_id, business_date DESC, status);
CREATE INDEX idx_ctx_school_bdate ON public.canteen_transactions (school_id, business_date DESC);
CREATE INDEX idx_ctx_settlement ON public.canteen_transactions (settlement_batch_id) WHERE settlement_status IN ('BATCHED','FAILED');
CREATE INDEX idx_ctx_unsettled ON public.canteen_transactions (merchant_id, created_at) WHERE settlement_status = 'UNSETTLED' AND status = 'SETTLED';
CREATE INDEX uq_ctx_local_tx ON public.canteen_transactions (merchant_id, client_local_tx_uuid) WHERE client_local_tx_uuid IS NOT NULL;
CREATE INDEX idx_ctx_items_gin ON public.canteen_transactions USING gin (items jsonb_path_ops);
CREATE INDEX idx_ctx_created_brin ON public.canteen_transactions USING brin (created_at) WITH (pages_per_range = 32);

CREATE OR REPLACE FUNCTION valo_private.trg_ctx_guard_immutable_cols()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (new.id, new.student_id, new.merchant_id, new.school_id, new.amount,
      new.idempotency_key, new.is_emergency, new.created_at)
     IS DISTINCT FROM
     (old.id, old.student_id, old.merchant_id, old.school_id, old.amount,
      old.idempotency_key, old.is_emergency, old.created_at)
  THEN
    RAISE EXCEPTION 'IMMUTABLE_FIELD: financial fields of canteen_transactions are append-only'
      USING errcode = '42501';
  END IF;
  RETURN new;
END;
$$;

CREATE TRIGGER tg_ctx_guard_cols
  BEFORE UPDATE ON public.canteen_transactions
  FOR EACH ROW EXECUTE FUNCTION valo_private.trg_ctx_guard_immutable_cols();

CREATE TRIGGER tg_ctx_no_delete
  BEFORE DELETE ON public.canteen_transactions
  FOR EACH ROW EXECUTE FUNCTION valo_private.trg_forbid_mutation();

-- =====================================================================
-- SECTION 9. SPP INVOICES
-- =====================================================================

CREATE TABLE public.spp_invoices (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  student_id            uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  billed_parent_id      uuid REFERENCES public.parents(id) ON DELETE RESTRICT,
  period                public.period_ym NOT NULL,
  period_start          date GENERATED ALWAYS AS (make_date(left(period,4)::int, right(period,2)::int, 1)) STORED,
  amount                public.idr_amt NOT NULL CHECK (amount > 0),
  amount_paid           public.idr_amt NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  status                public.invoice_status_t NOT NULL DEFAULT 'UNPAID',
  retry_count           smallint NOT NULL DEFAULT 0 CHECK (retry_count BETWEEN 0 AND 10),
  next_retry_at         timestamptz,
  due_date              date NOT NULL,
  paid_at               timestamptz,
  bni_h2h_reference     text,
  ledger_transaction_id uuid REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_spp_student_period UNIQUE (student_id, period),
  CONSTRAINT ck_spp_paid_consistency CHECK (
    (status = 'PAID') = (paid_at IS NOT NULL)
  ),
  CONSTRAINT ck_spp_overpay CHECK (amount_paid <= amount),
  CONSTRAINT fk_spp_student_tenant
    FOREIGN KEY (student_id, school_id) REFERENCES public.students(id, school_id)
);

CREATE UNIQUE INDEX uq_spp_h2h_ref ON public.spp_invoices (bni_h2h_reference) WHERE bni_h2h_reference IS NOT NULL;
CREATE INDEX idx_spp_school_period ON public.spp_invoices (school_id, period, status);
CREATE INDEX idx_spp_retry_due ON public.spp_invoices (next_retry_at) WHERE status IN ('UNPAID','FAILED');
CREATE INDEX idx_spp_overdue ON public.spp_invoices (school_id, due_date) WHERE status IN ('UNPAID','FAILED','OVERDUE');

-- =====================================================================
-- SECTION 10. STUDENT VAULT AND OVERDRAFT ADVANCES
-- =====================================================================

CREATE TABLE public.student_vault (
  student_id          uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE RESTRICT,
  school_id           uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  ledger_account_id   uuid NOT NULL REFERENCES public.ledger_accounts(id) ON DELETE RESTRICT,
  savings_goal_name   text,
  savings_goal_target public.idr_amt CHECK (savings_goal_target IS NULL OR savings_goal_target > 0),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_vault_student_tenant
    FOREIGN KEY (student_id, school_id) REFERENCES public.students(id, school_id)
);

CREATE TABLE public.vault_withdrawal_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  requested_by          uuid NOT NULL REFERENCES public.parents(id)  ON DELETE RESTRICT,
  approved_by           uuid REFERENCES public.parents(id) ON DELETE RESTRICT,
  amount                public.idr_amt NOT NULL CHECK (amount > 0),
  status                text NOT NULL DEFAULT 'PENDING_CONFIRM'
                        CHECK (status IN ('PENDING_CONFIRM','APPROVED','REJECTED','DISBURSED','EXPIRED')),
  destination_account   text,
  ledger_transaction_id uuid REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  requested_at          timestamptz NOT NULL DEFAULT now(),
  resolved_at           timestamptz,
  expires_at            timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.vault_withdrawal_requests
  ADD CONSTRAINT ck_vault_dual_control
  CHECK (approved_by IS NULL OR approved_by <> requested_by);

CREATE INDEX idx_vault_wd_pending
  ON public.vault_withdrawal_requests (student_id, requested_at DESC)
  WHERE status = 'PENDING_CONFIRM';

CREATE TABLE public.student_advances (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  school_id           uuid NOT NULL REFERENCES public.schools(id)  ON DELETE RESTRICT,
  origin_txn_id       uuid NOT NULL,
  principal_amount    public.idr_amt NOT NULL CHECK (principal_amount > 0),
  outstanding_amount  public.idr_amt NOT NULL CHECK (outstanding_amount >= 0),
  status              text NOT NULL DEFAULT 'OUTSTANDING'
                      CHECK (status IN ('OUTSTANDING','PARTIALLY_REPAID','REPAID','WRITTEN_OFF')),
  incurred_on         date NOT NULL,
  repaid_at           timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_advance_outstanding CHECK (outstanding_amount <= principal_amount),
  CONSTRAINT fk_advance_student_tenant
    FOREIGN KEY (student_id, school_id) REFERENCES public.students(id, school_id)
);

CREATE INDEX idx_advances_outstanding
  ON public.student_advances (student_id, incurred_on)
  WHERE status IN ('OUTSTANDING','PARTIALLY_REPAID');

-- =====================================================================
-- SECTION 11. IDEMPOTENCY
-- =====================================================================

CREATE TABLE public.idempotency_keys (
  key                 uuid NOT NULL,
  endpoint            text NOT NULL,
  actor_user_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  request_fingerprint text NOT NULL,
  response_snapshot   jsonb,
  response_status     smallint,
  status              public.idempotency_status_t NOT NULL DEFAULT 'PROCESSING',
  created_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  expires_at          timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  CONSTRAINT pk_idempotency PRIMARY KEY (endpoint, key)
);

CREATE INDEX idx_idem_expiry ON public.idempotency_keys (expires_at);

-- =====================================================================
-- SECTION 12. OFFLINE SYNC QUEUE
-- =====================================================================

CREATE TABLE public.offline_sync_queue (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id         uuid NOT NULL REFERENCES public.merchants(id) ON DELETE RESTRICT,
  school_id           uuid NOT NULL REFERENCES public.schools(id)   ON DELETE RESTRICT,
  local_tx_uuid       uuid NOT NULL,
  payload             jsonb NOT NULL,
  sync_status         public.sync_status_t NOT NULL DEFAULT 'PENDING',
  conflict_reason     text,
  resulting_txn_id    uuid,
  device_captured_at  timestamptz NOT NULL,
  received_at         timestamptz NOT NULL DEFAULT now(),
  synced_at           timestamptz,
  CONSTRAINT uq_osq_local UNIQUE (merchant_id, local_tx_uuid),
  CONSTRAINT fk_osq_merchant_tenant
    FOREIGN KEY (merchant_id, school_id) REFERENCES public.merchants(id, school_id)
);

CREATE INDEX idx_osq_pending
  ON public.offline_sync_queue (merchant_id, device_captured_at)
  WHERE sync_status = 'PENDING';

-- =====================================================================
-- SECTION 13. COMPLIANCE, LIFECYCLE AND AUDIT
-- =====================================================================

CREATE TABLE public.card_lifecycle_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  card_id             uuid REFERENCES public.student_cards(id) ON DELETE RESTRICT,
  school_id           uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  event_type          public.card_event_t NOT NULL,
  notes               text,
  actor_user_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role_snapshot public.user_role_t,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_cle_student_tenant
    FOREIGN KEY (student_id, school_id) REFERENCES public.students(id, school_id)
);

CREATE INDEX idx_cle_student ON public.card_lifecycle_events (student_id, created_at DESC);

CREATE TRIGGER tg_cle_immutable
  BEFORE UPDATE OR DELETE ON public.card_lifecycle_events
  FOR EACH ROW EXECUTE FUNCTION valo_private.trg_forbid_mutation();

CREATE TABLE public.parental_consent (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id           uuid NOT NULL REFERENCES public.parents(id)  ON DELETE RESTRICT,
  student_id          uuid NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
  school_id           uuid NOT NULL REFERENCES public.schools(id)  ON DELETE RESTRICT,
  consent_type        public.consent_type_t NOT NULL DEFAULT 'DATA_PROCESSING_MINOR',
  consent_version     text NOT NULL DEFAULT 'v1.0',
  consent_token       text NOT NULL,
  granted_at          timestamptz,
  revoked_at          timestamptz,
  evidence_ip         inet,
  evidence_user_agent text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_consent_student_tenant
    FOREIGN KEY (student_id, school_id) REFERENCES public.students(id, school_id)
);

CREATE UNIQUE INDEX uq_consent_active
  ON public.parental_consent (student_id, consent_type)
  WHERE revoked_at IS NULL AND granted_at IS NOT NULL;

CREATE INDEX idx_consent_parent ON public.parental_consent (parent_id, student_id);

CREATE TABLE public.audit_log (
  id                  uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id           uuid,
  actor_user_id       uuid,
  actor_role_snapshot public.user_role_t,
  action              text NOT NULL,
  entity_type         text NOT NULL,
  entity_id           uuid,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  flag                text,
  ip_address          inet,
  request_id          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_audit_log PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE INDEX idx_audit_entity  ON public.audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_actor   ON public.audit_log (actor_user_id, created_at DESC);
CREATE INDEX idx_audit_school  ON public.audit_log (school_id, created_at DESC);
CREATE INDEX idx_audit_flag    ON public.audit_log (flag, created_at DESC) WHERE flag IS NOT NULL;
CREATE INDEX idx_audit_meta    ON public.audit_log USING gin (metadata jsonb_path_ops);
CREATE INDEX idx_audit_brin    ON public.audit_log USING brin (created_at) WITH (pages_per_range = 32);

CREATE TRIGGER tg_audit_immutable
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION valo_private.trg_forbid_mutation();

CREATE TABLE public.ai_chat_logs (
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  persona_type   public.ai_persona_t NOT NULL,
  actor_user_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  school_id      uuid,
  prompt         text NOT NULL,
  response       text NOT NULL,
  function_calls jsonb,
  model          text,
  latency_ms     integer,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_ai_chat_logs PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE INDEX idx_ai_actor ON public.ai_chat_logs (actor_user_id, created_at DESC);

-- =====================================================================
-- SECTION 14. PARTITION MANAGEMENT
-- =====================================================================

CREATE OR REPLACE FUNCTION valo_private.fn_ensure_month_partitions(
  p_parent regclass,
  p_months_ahead integer DEFAULT 3
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, valo_private, pg_temp
AS $$
DECLARE
  v_i integer;
  v_start date;
  v_end   date;
  v_name  text;
  v_made  integer := 0;
  v_base  text := replace(p_parent::text, 'public.', '');
BEGIN
  FOR v_i IN 0 .. p_months_ahead LOOP
    v_start := date_trunc('month', (now() AT TIME ZONE 'UTC')::date)::date + (v_i || ' month')::interval;
    v_end   := (v_start + interval '1 month')::date;
    v_name  := format('%s_p%s', v_base, to_char(v_start, 'YYYYMM'));

    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = v_name) THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF %s FOR VALUES FROM (%L) TO (%L)',
        v_name, p_parent::text, v_start, v_end
      );
      v_made := v_made + 1;
    END IF;
  END LOOP;

  v_name := format('%s_default', v_base);
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = v_name) THEN
    EXECUTE format('CREATE TABLE public.%I PARTITION OF %s DEFAULT', v_name, p_parent::text);
  END IF;

  RETURN v_made;
END;
$$;

SELECT valo_private.fn_ensure_month_partitions('public.canteen_transactions'::regclass, 3);
SELECT valo_private.fn_ensure_month_partitions('public.audit_log'::regclass, 3);
SELECT valo_private.fn_ensure_month_partitions('public.ai_chat_logs'::regclass, 3);

-- =====================================================================
-- SECTION 15. RLS CONTEXT HELPERS & SUPABASE AUTH HOOK
-- =====================================================================

CREATE OR REPLACE FUNCTION valo_private.jwt_app_meta()
RETURNS jsonb
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata',
    '{}'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_parent_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
PARALLEL SAFE
SET search_path = public, valo_private, pg_temp
AS $$
DECLARE v_id uuid;
BEGIN
  v_id := nullif(valo_private.jwt_app_meta() ->> 'parent_id', '')::uuid;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  SELECT p.parent_id INTO v_id FROM public.profiles p WHERE p.id = auth.uid();
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.auth_school_ids()
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
PARALLEL SAFE
SET search_path = public, valo_private, pg_temp
AS $$
DECLARE v_ids uuid[];
BEGIN
  SELECT array(SELECT jsonb_array_elements_text(
           coalesce(valo_private.jwt_app_meta() -> 'school_ids', '[]'::jsonb))::uuid)
    INTO v_ids;
  IF array_length(v_ids, 1) IS NOT NULL THEN RETURN v_ids; END IF;
  SELECT array_agg(DISTINCT ur.school_id)
    INTO v_ids
    FROM public.user_roles ur
   WHERE ur.user_id = auth.uid()
     AND ur.revoked_at IS NULL
     AND ur.school_id IS NOT NULL;
  RETURN coalesce(v_ids, '{}'::uuid[]);
END;
$$;

CREATE OR REPLACE FUNCTION public.auth_merchant_ids()
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
PARALLEL SAFE
SET search_path = public, valo_private, pg_temp
AS $$
DECLARE v_ids uuid[];
BEGIN
  SELECT array(SELECT jsonb_array_elements_text(
           coalesce(valo_private.jwt_app_meta() -> 'merchant_ids', '[]'::jsonb))::uuid)
    INTO v_ids;
  IF array_length(v_ids, 1) IS NOT NULL THEN RETURN v_ids; END IF;
  SELECT array_agg(DISTINCT ur.merchant_id)
    INTO v_ids
    FROM public.user_roles ur
   WHERE ur.user_id = auth.uid()
     AND ur.revoked_at IS NULL
     AND ur.merchant_id IS NOT NULL;
  RETURN coalesce(v_ids, '{}'::uuid[]);
END;
$$;

CREATE OR REPLACE FUNCTION public.auth_has_role(p_role public.user_role_t)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
PARALLEL SAFE
SET search_path = public, valo_private, pg_temp
AS $$
DECLARE v_roles jsonb;
BEGIN
  v_roles := coalesce(valo_private.jwt_app_meta() -> 'roles', '[]'::jsonb);
  IF jsonb_array_length(v_roles) > 0 THEN
    RETURN v_roles ? p_role::text;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
     WHERE ur.user_id = auth.uid() AND ur.role = p_role AND ur.revoked_at IS NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$ SELECT public.auth_has_role('platform_admin'::public.user_role_t); $$;

CREATE OR REPLACE FUNCTION public.auth_ward_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(array_agg(g.student_id), '{}'::uuid[])
    FROM public.guardian_student_map g
   WHERE g.parent_id = public.auth_parent_id()
     AND g.status = 'active'
     AND (g.valid_until IS NULL OR g.valid_until > now());
$$;

-- Custom Access Token Hook for Supabase Auth
CREATE OR REPLACE FUNCTION supabase_functions.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_claims  jsonb;
  v_parent_id uuid;
  v_roles   text[];
  v_school_ids uuid[];
  v_merchant_ids uuid[];
BEGIN
  v_user_id := (event->>'user_id')::uuid;
  v_claims := event->'claims';

  -- Resolve parent_id
  SELECT parent_id INTO v_parent_id FROM public.profiles WHERE id = v_user_id;

  -- Resolve Active Roles and Scopes
  SELECT 
    coalesce(array_agg(DISTINCT role::text), '{}'::text[]),
    coalesce(array_agg(DISTINCT school_id) FILTER (WHERE school_id IS NOT NULL), '{}'::uuid[]),
    coalesce(array_agg(DISTINCT merchant_id) FILTER (WHERE merchant_id IS NOT NULL), '{}'::uuid[])
  INTO v_roles, v_school_ids, v_merchant_ids
  FROM public.user_roles
  WHERE user_id = v_user_id AND revoked_at IS NULL;

  -- Enrich app_metadata in JWT claims
  v_claims := jsonb_set(v_claims, '{app_metadata, parent_id}', to_jsonb(v_parent_id));
  v_claims := jsonb_set(v_claims, '{app_metadata, roles}', to_jsonb(v_roles));
  v_claims := jsonb_set(v_claims, '{app_metadata, school_ids}', to_jsonb(v_school_ids));
  v_claims := jsonb_set(v_claims, '{app_metadata, merchant_ids}', to_jsonb(v_merchant_ids));

  event := jsonb_set(event, '{claims}', v_claims);
  RETURN event;
END;
$$;

GRANT USAGE ON SCHEMA supabase_functions TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION supabase_functions.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE ALL ON FUNCTION supabase_functions.custom_access_token_hook(jsonb) FROM public, anon, authenticated;

REVOKE EXECUTE ON FUNCTION valo_private.jwt_app_meta() FROM public, anon;
GRANT EXECUTE ON FUNCTION
  public.auth_parent_id(), public.auth_school_ids(), public.auth_merchant_ids(),
  public.auth_has_role(public.user_role_t), public.is_platform_admin(), public.auth_ward_ids()
  TO authenticated;

-- =====================================================================
-- SECTION 16. ROW LEVEL SECURITY (STRICT ARRAY OPERATOR POLICIES)
-- =====================================================================

ALTER TABLE public.schools                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchants               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_cards           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_student_map    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_daily_counters  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canteen_transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spp_invoices            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_vault           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_advances        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_sync_queue      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_lifecycle_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parental_consent        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_logs            ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.students             FORCE ROW LEVEL SECURITY;
ALTER TABLE public.canteen_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries       FORCE ROW LEVEL SECURITY;

-- ---------- profiles / roles ----------
CREATE POLICY profiles_self_read ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR (SELECT public.is_platform_admin()));

CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY user_roles_self_read ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_platform_admin()));

-- ---------- schools ----------
CREATE POLICY schools_scoped_read ON public.schools
  FOR SELECT TO authenticated
  USING (id = ANY (public.auth_school_ids()) OR (SELECT public.is_platform_admin()));

CREATE POLICY schools_admin_update ON public.schools
  FOR UPDATE TO authenticated
  USING (id = ANY (public.auth_school_ids())
         AND (SELECT public.auth_has_role('school_admin')))
  WITH CHECK (id = ANY (public.auth_school_ids()));

-- ---------- merchants ----------
CREATE POLICY merchants_scoped_read ON public.merchants
  FOR SELECT TO authenticated
  USING (
    id = ANY (public.auth_merchant_ids())
    OR school_id = ANY (public.auth_school_ids())
    OR (SELECT public.is_platform_admin())
  );

-- ---------- parents ----------
CREATE POLICY parents_self_read ON public.parents
  FOR SELECT TO authenticated
  USING (id = (SELECT public.auth_parent_id()) OR (SELECT public.is_platform_admin()));

CREATE POLICY parents_self_update ON public.parents
  FOR UPDATE TO authenticated
  USING (id = (SELECT public.auth_parent_id()))
  WITH CHECK (id = (SELECT public.auth_parent_id()));

REVOKE UPDATE ON public.parents FROM authenticated;
GRANT  UPDATE (full_name, email) ON public.parents TO authenticated;

-- ---------- students ----------
CREATE POLICY students_school_read ON public.students
  FOR SELECT TO authenticated
  USING (school_id = ANY (public.auth_school_ids()));

CREATE POLICY students_guardian_read ON public.students
  FOR SELECT TO authenticated
  USING (id = ANY (public.auth_ward_ids()));

CREATE POLICY students_platform_all ON public.students
  FOR ALL TO authenticated
  USING ((SELECT public.is_platform_admin()))
  WITH CHECK ((SELECT public.is_platform_admin()));

CREATE POLICY students_guardian_update_policy_fields ON public.students
  FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT g.student_id FROM public.guardian_student_map g
       WHERE g.parent_id = (SELECT public.auth_parent_id())
         AND g.status = 'active' AND g.can_manage_pagu
    )
  )
  WITH CHECK (
    id IN (
      SELECT g.student_id FROM public.guardian_student_map g
       WHERE g.parent_id = (SELECT public.auth_parent_id())
         AND g.status = 'active' AND g.can_manage_pagu
    )
  );

REVOKE UPDATE ON public.students FROM authenticated;
GRANT  UPDATE (daily_limit, emergency_approve, emergency_limit) ON public.students TO authenticated;

-- ---------- student_cards ----------
CREATE POLICY cards_school_read ON public.student_cards
  FOR SELECT TO authenticated
  USING (school_id = ANY (public.auth_school_ids()));

CREATE POLICY cards_guardian_read ON public.student_cards
  FOR SELECT TO authenticated
  USING (student_id = ANY (public.auth_ward_ids()));

-- ---------- guardianship ----------
CREATE POLICY gsm_parent_read ON public.guardian_student_map
  FOR SELECT TO authenticated
  USING (parent_id = (SELECT public.auth_parent_id()));

CREATE POLICY gsm_school_read ON public.guardian_student_map
  FOR SELECT TO authenticated
  USING (school_id = ANY (public.auth_school_ids()));

-- ---------- daily counters ----------
CREATE POLICY sdc_guardian_read ON public.student_daily_counters
  FOR SELECT TO authenticated
  USING (student_id = ANY (public.auth_ward_ids()));

CREATE POLICY sdc_school_read ON public.student_daily_counters
  FOR SELECT TO authenticated
  USING (school_id = ANY (public.auth_school_ids()));

-- ---------- canteen transactions ----------
CREATE POLICY ctx_merchant_read ON public.canteen_transactions
  FOR SELECT TO authenticated
  USING (merchant_id = ANY (public.auth_merchant_ids()));

CREATE POLICY ctx_school_read ON public.canteen_transactions
  FOR SELECT TO authenticated
  USING (school_id = ANY (public.auth_school_ids()));

CREATE POLICY ctx_guardian_read ON public.canteen_transactions
  FOR SELECT TO authenticated
  USING (student_id = ANY (public.auth_ward_ids()));

-- ---------- spp invoices ----------
CREATE POLICY spp_school_read ON public.spp_invoices
  FOR SELECT TO authenticated
  USING (school_id = ANY (public.auth_school_ids()));

CREATE POLICY spp_guardian_read ON public.spp_invoices
  FOR SELECT TO authenticated
  USING (student_id = ANY (public.auth_ward_ids()));

-- ---------- vault ----------
CREATE POLICY vault_guardian_read ON public.student_vault
  FOR SELECT TO authenticated
  USING (student_id = ANY (public.auth_ward_ids()));

CREATE POLICY vault_guardian_update ON public.student_vault
  FOR UPDATE TO authenticated
  USING (student_id = ANY (public.auth_ward_ids()))
  WITH CHECK (student_id = ANY (public.auth_ward_ids()));

REVOKE UPDATE ON public.student_vault FROM authenticated;
GRANT  UPDATE (savings_goal_name, savings_goal_target) ON public.student_vault TO authenticated;

CREATE POLICY vault_wd_guardian_read ON public.vault_withdrawal_requests
  FOR SELECT TO authenticated
  USING (student_id = ANY (public.auth_ward_ids()));

CREATE POLICY advances_guardian_read ON public.student_advances
  FOR SELECT TO authenticated
  USING (student_id = ANY (public.auth_ward_ids()));

CREATE POLICY advances_school_read ON public.student_advances
  FOR SELECT TO authenticated
  USING (school_id = ANY (public.auth_school_ids()));

-- ---------- ledger ----------
CREATE POLICY ledger_accounts_platform ON public.ledger_accounts
  FOR SELECT TO authenticated USING ((SELECT public.is_platform_admin()));

CREATE POLICY ledger_txn_platform ON public.ledger_transactions
  FOR SELECT TO authenticated USING ((SELECT public.is_platform_admin()));

CREATE POLICY ledger_entries_platform ON public.ledger_entries
  FOR SELECT TO authenticated USING ((SELECT public.is_platform_admin()));

-- ---------- offline queue ----------
CREATE POLICY osq_merchant_rw ON public.offline_sync_queue
  FOR ALL TO authenticated
  USING (merchant_id = ANY (public.auth_merchant_ids()))
  WITH CHECK (merchant_id = ANY (public.auth_merchant_ids()));

-- ---------- compliance ----------
CREATE POLICY cle_guardian_read ON public.card_lifecycle_events
  FOR SELECT TO authenticated
  USING (student_id = ANY (public.auth_ward_ids()));

CREATE POLICY cle_school_read ON public.card_lifecycle_events
  FOR SELECT TO authenticated
  USING (school_id = ANY (public.auth_school_ids()));

CREATE POLICY consent_parent_read ON public.parental_consent
  FOR SELECT TO authenticated
  USING (parent_id = (SELECT public.auth_parent_id()));

CREATE POLICY consent_school_read ON public.parental_consent
  FOR SELECT TO authenticated
  USING (school_id = ANY (public.auth_school_ids()));

CREATE POLICY audit_platform_read ON public.audit_log
  FOR SELECT TO authenticated
  USING ((SELECT public.is_platform_admin()));

CREATE POLICY audit_school_read ON public.audit_log
  FOR SELECT TO authenticated
  USING (school_id = ANY (public.auth_school_ids())
         AND (SELECT public.auth_has_role('school_admin')));

CREATE POLICY ai_logs_self_read ON public.ai_chat_logs
  FOR SELECT TO authenticated
  USING (actor_user_id = (SELECT auth.uid()) OR (SELECT public.is_platform_admin()));

-- =====================================================================
-- SECTION 17. PRIVILEGED ROUTINES
-- =====================================================================

CREATE OR REPLACE FUNCTION valo_private.jwt_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', 'anon');
$$;

CREATE OR REPLACE FUNCTION valo_private.fn_ensure_account(
  p_type      public.ledger_account_t,
  p_school    uuid DEFAULT NULL,
  p_parent    uuid DEFAULT NULL,
  p_student   uuid DEFAULT NULL,
  p_merchant  uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, valo_private, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_normal public.ledger_normal_balance_t;
BEGIN
  SELECT id INTO v_id
    FROM public.ledger_accounts
   WHERE account_type = p_type
     AND owner_school_id   IS NOT DISTINCT FROM p_school
     AND owner_parent_id   IS NOT DISTINCT FROM p_parent
     AND owner_student_id  IS NOT DISTINCT FROM p_student
     AND owner_merchant_id IS NOT DISTINCT FROM p_merchant;

  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  v_normal := CASE p_type
    WHEN 'student_pagu'      THEN 'DEBIT'
    WHEN 'student_advance'   THEN 'DEBIT'
    WHEN 'platform_clearing' THEN 'DEBIT'
    ELSE 'CREDIT'
  END::public.ledger_normal_balance_t;

  INSERT INTO public.ledger_accounts
    (account_type, normal_balance, owner_school_id, owner_parent_id, owner_student_id, owner_merchant_id)
  VALUES
    (p_type, v_normal, p_school, p_parent, p_student, p_merchant)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION valo_private.fn_post_journal(
  p_source       public.ledger_source_t,
  p_source_table text,
  p_source_id    uuid,
  p_school_id    uuid,
  p_business_date date,
  p_lines        jsonb,
  p_description  text DEFAULT NULL,
  p_posted_by    uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, valo_private, pg_temp
AS $$
DECLARE
  v_txn_id uuid;
  v_line   record;
  v_seq    bigint;
  v_bal    public.ledger_amt;
  v_total  public.ledger_amt := 0;
BEGIN
  SELECT coalesce(sum((l ->> 'signed_amount')::numeric), 0)
    INTO v_total
    FROM jsonb_array_elements(p_lines) l;

  IF v_total <> 0 THEN
    RAISE EXCEPTION 'LEDGER_UNBALANCED: supplied lines sum to %', v_total USING errcode = '23514';
  END IF;

  INSERT INTO public.ledger_transactions
    (source, source_table, source_id, school_id, business_date, description, posted_by)
  VALUES
    (p_source, p_source_table, p_source_id, p_school_id, p_business_date, p_description, p_posted_by)
  RETURNING id INTO v_txn_id;

  FOR v_line IN
    SELECT (l ->> 'account_id')::uuid AS account_id,
           (l ->> 'signed_amount')::numeric AS signed_amount
      FROM jsonb_array_elements(p_lines) l
     ORDER BY 1
  LOOP
    UPDATE public.ledger_accounts
       SET last_entry_seq = last_entry_seq + 1,
           balance        = balance + v_line.signed_amount,
           updated_at     = now()
     WHERE id = v_line.account_id
    RETURNING last_entry_seq, balance INTO v_seq, v_bal;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'LEDGER_ACCOUNT_NOT_FOUND: %', v_line.account_id USING errcode = '23503';
    END IF;

    INSERT INTO public.ledger_entries
      (transaction_id, account_id, signed_amount, entry_seq, balance_after)
    VALUES
      (v_txn_id, v_line.account_id, v_line.signed_amount, v_seq, v_bal);
  END LOOP;

  RETURN v_txn_id;
END;
$$;

-- ---------------------------------------------------------------------
-- 17.1 THE NFC TAP (Fixed Array Evaluation)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_process_canteen_tap(
  p_idempotency_key uuid,
  p_card_uid_hash   bytea,
  p_merchant_id     uuid,
  p_amount          numeric,
  p_items           jsonb DEFAULT '[]'::jsonb,
  p_client_local_tx_uuid uuid DEFAULT NULL,
  p_channel         public.txn_channel_t DEFAULT 'ONLINE_TAP',
  p_occurred_at     timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, valo_private, pg_temp
AS $$
DECLARE
  v_caller        uuid := auth.uid();
  v_role          text := valo_private.jwt_role();
  v_fingerprint   text;
  v_idem          public.idempotency_keys%rowtype;
  v_merchant      public.merchants%rowtype;
  v_card          public.student_cards%rowtype;
  v_student       public.students%rowtype;
  v_bdate         date;
  v_ctr           public.student_daily_counters%rowtype;
  v_remaining     numeric;
  v_from_pagu     numeric;
  v_shortfall     numeric;
  v_txn_id        uuid := gen_random_uuid();
  v_status        public.txn_status_t;
  v_is_emergency  boolean := false;
  v_acct_pagu     uuid;
  v_acct_adv      uuid;
  v_acct_merch    uuid;
  v_lines         jsonb;
  v_ledger_id     uuid;
  v_result        jsonb;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount <> round(p_amount, 0) THEN
    RAISE EXCEPTION 'INVALID_AMOUNT' USING errcode = '22023';
  END IF;

  v_fingerprint := encode(digest(
    p_card_uid_hash::text || '|' || p_merchant_id::text || '|' || p_amount::text, 'sha256'), 'hex');

  -- 1. Idempotency
  INSERT INTO public.idempotency_keys
    (key, endpoint, actor_user_id, request_fingerprint, status)
  VALUES
    (p_idempotency_key, 'fn_process_canteen_tap', v_caller, v_fingerprint, 'PROCESSING')
  ON CONFLICT (endpoint, key) DO NOTHING;

  IF NOT FOUND THEN
    SELECT * INTO v_idem
      FROM public.idempotency_keys
     WHERE endpoint = 'fn_process_canteen_tap' AND key = p_idempotency_key
     FOR UPDATE;

    IF v_idem.request_fingerprint <> v_fingerprint THEN
      RETURN jsonb_build_object('error','IDEMPOTENCY_KEY_REUSE','http_status',422);
    ELSIF v_idem.status = 'COMPLETED' THEN
      RETURN v_idem.response_snapshot || jsonb_build_object('replayed', true);
    ELSE
      RETURN jsonb_build_object('error','REQUEST_IN_PROGRESS','http_status',409);
    END IF;
  END IF;

  -- 2. Authorisation
  SELECT * INTO v_merchant FROM public.merchants WHERE id = p_merchant_id AND deleted_at IS NULL;
  IF NOT FOUND OR v_merchant.status <> 'active' THEN
    RETURN jsonb_build_object('error','MERCHANT_INACTIVE','http_status',403);
  END IF;

  IF v_role <> 'service_role' THEN
    -- Array comparison fix using ANY operator:
    IF v_caller IS NULL OR NOT (p_merchant_id = ANY (public.auth_merchant_ids())) THEN
      RAISE EXCEPTION 'RLS_FORBIDDEN' USING errcode = '42501';
    END IF;
  END IF;

  -- 3. Card resolution
  SELECT * INTO v_card
    FROM public.student_cards
   WHERE school_id = v_merchant.school_id
     AND uid_hash  = p_card_uid_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','STUDENT_NOT_FOUND','http_status',404);
  END IF;

  IF v_card.status <> 'active' THEN
    INSERT INTO public.canteen_transactions
      (id, school_id, student_id, merchant_id, card_id, amount, status, channel,
       idempotency_key, client_local_tx_uuid, items, rejection_reason, created_at)
    VALUES
      (v_txn_id, v_merchant.school_id, v_card.student_id, p_merchant_id, v_card.id, p_amount,
       'REJECTED_CARD_BLOCKED', p_channel, p_idempotency_key, p_client_local_tx_uuid, p_items,
       'card_status=' || v_card.status, p_occurred_at);

    v_result := jsonb_build_object('error','CARD_BLOCKED','transaction_id',v_txn_id,'http_status',423);
    UPDATE public.idempotency_keys
       SET status='COMPLETED', response_snapshot=v_result, response_status=423, completed_at=now()
     WHERE endpoint='fn_process_canteen_tap' AND key=p_idempotency_key;
    RETURN v_result;
  END IF;

  -- 4. Student & counter
  SELECT * INTO v_student FROM public.students WHERE id = v_card.student_id;
  IF v_student.status <> 'active' THEN
    RETURN jsonb_build_object('error','STUDENT_INACTIVE','http_status',423);
  END IF;

  v_bdate := (p_occurred_at AT TIME ZONE 'Asia/Jakarta')::date;

  INSERT INTO public.student_daily_counters
    (student_id, business_date, school_id, limit_snapshot)
  VALUES
    (v_student.id, v_bdate, v_student.school_id, v_student.daily_limit)
  ON CONFLICT (student_id, business_date)
    DO UPDATE SET updated_at = now()
  RETURNING * INTO v_ctr;

  -- 5. Pagu rules engine
  v_remaining := greatest(v_ctr.limit_snapshot - v_ctr.spent_amount, 0);

  IF p_amount <= v_remaining THEN
    v_from_pagu := p_amount;
    v_shortfall := 0;
    v_status    := 'SETTLED';
  ELSE
    v_from_pagu := v_remaining;
    v_shortfall := p_amount - v_remaining;

    IF v_student.emergency_approve
       AND v_shortfall <= v_student.emergency_limit
       AND v_ctr.overdraft_count = 0
    THEN
      v_status := 'SETTLED';
      v_is_emergency := true;
    ELSE
      INSERT INTO public.canteen_transactions
        (id, school_id, student_id, merchant_id, card_id, amount, status, channel,
         idempotency_key, client_local_tx_uuid, items, rejection_reason, created_at)
      VALUES
        (v_txn_id, v_merchant.school_id, v_student.id, p_merchant_id, v_card.id, p_amount,
         'REJECTED_OVERLIMIT', p_channel, p_idempotency_key, p_client_local_tx_uuid, p_items,
         CASE WHEN NOT v_student.emergency_approve THEN 'emergency_disabled'
              WHEN v_ctr.overdraft_count > 0       THEN 'overdraft_rate_limit'
              ELSE 'exceeds_emergency_limit' END,
         p_occurred_at);

      v_result := jsonb_build_object(
        'error','PAGU_EXCEEDED','transaction_id',v_txn_id,
        'sisa_pagu', v_remaining, 'http_status', 402);

      UPDATE public.idempotency_keys
         SET status='COMPLETED', response_snapshot=v_result, response_status=402, completed_at=now()
       WHERE endpoint='fn_process_canteen_tap' AND key=p_idempotency_key;
      RETURN v_result;
    END IF;
  END IF;

  -- 6. Persist transaction
  INSERT INTO public.canteen_transactions
    (id, school_id, student_id, merchant_id, card_id, amount, status, channel,
     is_emergency, emergency_amount, idempotency_key, client_local_tx_uuid, items,
     created_at)
  VALUES
    (v_txn_id, v_merchant.school_id, v_student.id, p_merchant_id, v_card.id, p_amount,
     v_status, p_channel, v_is_emergency, v_shortfall, p_idempotency_key,
     p_client_local_tx_uuid, p_items, p_occurred_at);

  UPDATE public.student_daily_counters
     SET spent_amount     = spent_amount + v_from_pagu,
         overdraft_amount = overdraft_amount + v_shortfall,
         overdraft_count  = overdraft_count + (CASE WHEN v_is_emergency THEN 1 ELSE 0 END),
         txn_count        = txn_count + 1,
         updated_at       = now()
   WHERE student_id = v_student.id AND business_date = v_bdate;

  -- 7. Double-entry posting
  v_acct_pagu  := valo_private.fn_ensure_account('student_pagu',     NULL, NULL, v_student.id, NULL);
  v_acct_merch := valo_private.fn_ensure_account('merchant_payable', NULL, NULL, NULL, p_merchant_id);

  v_lines := jsonb_build_array(
    jsonb_build_object('account_id', v_acct_merch, 'signed_amount', -p_amount)
  );

  IF v_from_pagu > 0 THEN
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_id', v_acct_pagu, 'signed_amount', v_from_pagu));
  END IF;

  IF v_shortfall > 0 THEN
    v_acct_adv := valo_private.fn_ensure_account('student_advance', NULL, NULL, v_student.id, NULL);
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_id', v_acct_adv, 'signed_amount', v_shortfall));

    INSERT INTO public.student_advances
      (student_id, school_id, origin_txn_id, principal_amount, outstanding_amount, incurred_on)
    VALUES
      (v_student.id, v_student.school_id, v_txn_id, v_shortfall, v_shortfall, v_bdate);
  END IF;

  v_ledger_id := valo_private.fn_post_journal(
    'CANTEEN_TAP', 'canteen_transactions', v_txn_id,
    v_merchant.school_id, v_bdate, v_lines,
    'Canteen tap', v_caller);

  UPDATE public.canteen_transactions
     SET ledger_transaction_id = v_ledger_id
   WHERE id = v_txn_id AND created_at = p_occurred_at;

  -- 8. Anomaly flag
  IF v_is_emergency THEN
    IF (SELECT count(*) FROM public.student_daily_counters
         WHERE student_id = v_student.id
           AND business_date > v_bdate - 7
           AND overdraft_count > 0) > 2
    THEN
      INSERT INTO public.audit_log
        (school_id, actor_user_id, action, entity_type, entity_id, flag, metadata)
      VALUES
        (v_student.school_id, v_caller, 'OVERDRAFT_ANOMALY', 'students', v_student.id,
         'FREQUENT_OVERDRAFT',
         jsonb_build_object('transaction_id', v_txn_id, 'merchant_id', p_merchant_id));
    END IF;
  END IF;

  -- 9. Response
  v_result := jsonb_build_object(
    'transaction_id', v_txn_id,
    'status',         v_status,
    'is_emergency',   v_is_emergency,
    'emergency_amount', v_shortfall,
    'sisa_pagu',      greatest(v_remaining - v_from_pagu, 0),
    'business_date',  v_bdate,
    'settled_at',     p_occurred_at,
    'http_status',    200
  );

  UPDATE public.idempotency_keys
     SET status='COMPLETED', response_snapshot=v_result, response_status=200, completed_at=now()
   WHERE endpoint='fn_process_canteen_tap' AND key=p_idempotency_key;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_process_canteen_tap(uuid,bytea,uuid,numeric,jsonb,uuid,public.txn_channel_t,timestamptz) FROM public, anon;
GRANT   EXECUTE ON FUNCTION public.fn_process_canteen_tap(uuid,bytea,uuid,numeric,jsonb,uuid,public.txn_channel_t,timestamptz) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 17.2 VAULT ROLL-OVER
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION valo_private.sp_rollover_daily_vault(
  p_business_date date DEFAULT ((now() AT TIME ZONE 'Asia/Jakarta')::date)
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, valo_private, pg_temp
AS $$
DECLARE
  r        record;
  v_acct_v uuid;
  v_acct_p uuid;
  v_count  integer := 0;
  v_unused numeric;
BEGIN
  FOR r IN
    SELECT c.student_id, c.school_id, c.limit_snapshot, c.spent_amount, g.parent_id
      FROM public.student_daily_counters c
      JOIN public.students s ON s.id = c.student_id
      LEFT JOIN LATERAL (
        SELECT gm.parent_id FROM public.guardian_student_map gm
         WHERE gm.student_id = c.student_id AND gm.status = 'active' AND gm.can_fund
         ORDER BY gm.is_primary_guardian DESC LIMIT 1
      ) g ON true
     WHERE c.business_date = p_business_date
       AND c.rolled_over_at IS NULL
       AND s.status = 'active'
     FOR UPDATE OF c SKIP LOCKED
  LOOP
    v_unused := greatest(r.limit_snapshot - r.spent_amount, 0);

    IF v_unused > 0 AND r.parent_id IS NOT NULL THEN
      v_acct_v := valo_private.fn_ensure_account('student_vault',  NULL, NULL, r.student_id, NULL);
      v_acct_p := valo_private.fn_ensure_account('parent_funding', NULL, r.parent_id, NULL, NULL);

      PERFORM valo_private.fn_post_journal(
        'VAULT_ROLLOVER', 'student_daily_counters', r.student_id,
        r.school_id, p_business_date,
        jsonb_build_array(
          jsonb_build_object('account_id', v_acct_p, 'signed_amount',  v_unused),
          jsonb_build_object('account_id', v_acct_v, 'signed_amount', -v_unused)
        ),
        format('Vault rollover %s', p_business_date));
    END IF;

    UPDATE public.student_daily_counters
       SET rolled_over_at = now(), rolled_over_amount = v_unused
     WHERE student_id = r.student_id AND business_date = p_business_date;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------
-- 17.3 Overdraft Anomaly Sweep & 17.4 Cleanup
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION valo_private.sp_flag_frequent_overdraft(
  p_window_days integer DEFAULT 7
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, valo_private, pg_temp
AS $$
DECLARE v_n integer;
BEGIN
  WITH agg AS (
    SELECT c.student_id, c.school_id, sum(c.overdraft_count) AS n
      FROM public.student_daily_counters c
     WHERE c.business_date > ((now() AT TIME ZONE 'Asia/Jakarta')::date - p_window_days)
       AND c.overdraft_count > 0
     GROUP BY 1, 2
    HAVING sum(c.overdraft_count) > 2
  )
  INSERT INTO public.audit_log (school_id, action, entity_type, entity_id, flag, metadata)
  SELECT agg.school_id, 'OVERDRAFT_WEEKLY_REVIEW', 'students', agg.student_id,
         'FREQUENT_OVERDRAFT',
         jsonb_build_object('window_days', p_window_days, 'overdraft_count', agg.n)
    FROM agg;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

CREATE OR REPLACE FUNCTION valo_private.sp_cleanup_idempotency()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_n integer;
BEGIN
  DELETE FROM public.idempotency_keys
   WHERE expires_at < now() AND status <> 'PROCESSING';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- =====================================================================
-- SECTION 18. SCHEDULED JOBS (pg_cron)
-- =====================================================================

SELECT cron.schedule('valo_vault_rollover',   '59 16 * * *', $cron$SELECT valo_private.sp_rollover_daily_vault();$cron$);
SELECT cron.schedule('valo_overdraft_sweep',  '0 0 * * 1',   $cron$SELECT valo_private.sp_flag_frequent_overdraft(7);$cron$);
SELECT cron.schedule('valo_idem_cleanup',     '0 2 * * *',   $cron$SELECT valo_private.sp_cleanup_idempotency();$cron$);
SELECT cron.schedule('valo_partitions',       '0 3 25 * *',  $cron$
  SELECT valo_private.fn_ensure_month_partitions('public.canteen_transactions'::regclass, 3);
  SELECT valo_private.fn_ensure_month_partitions('public.audit_log'::regclass, 3);
  SELECT valo_private.fn_ensure_month_partitions('public.ai_chat_logs'::regclass, 3);
$cron$);

SELECT cron.schedule('valo_vault_backfill', '30 18 * * *', $cron$
  SELECT valo_private.sp_rollover_daily_vault(d::date)
    FROM generate_series(
      ((now() AT TIME ZONE 'Asia/Jakarta')::date - 3),
      ((now() AT TIME ZONE 'Asia/Jakarta')::date - 1),
      interval '1 day') d;
$cron$);

-- =====================================================================
-- SECTION 19. REPORTING VIEWS
-- =====================================================================

CREATE OR REPLACE VIEW valo_reporting.v_student_pagu_status
WITH (security_invoker = true) AS
SELECT s.id                AS student_id,
       s.school_id,
       s.full_name,
       s.daily_limit,
       coalesce(c.spent_amount, 0)     AS spent_today,
       greatest(s.daily_limit - coalesce(c.spent_amount, 0), 0) AS sisa_pagu,
       coalesce(c.overdraft_count, 0)  AS overdraft_today,
       s.emergency_approve,
       s.emergency_limit
  FROM public.students s
  LEFT JOIN public.student_daily_counters c
    ON c.student_id = s.id
   AND c.business_date = (now() AT TIME ZONE 'Asia/Jakarta')::date;

CREATE OR REPLACE VIEW valo_reporting.v_merchant_daily_sales
WITH (security_invoker = true) AS
SELECT t.merchant_id,
       t.school_id,
       t.business_date,
       count(*)                                   AS txn_count,
       sum(t.amount)                              AS gross_amount,
       sum(t.amount) FILTER (WHERE t.is_emergency) AS emergency_amount,
       count(*) FILTER (WHERE t.status = 'REJECTED_OVERLIMIT') AS rejected_count
  FROM public.canteen_transactions t
 WHERE t.status = 'SETTLED'
 GROUP BY 1, 2, 3;

CREATE OR REPLACE VIEW valo_reporting.v_ledger_balances
WITH (security_invoker = true) AS
SELECT a.id AS account_id,
       a.account_type,
       a.normal_balance,
       a.owner_school_id, a.owner_parent_id, a.owner_student_id, a.owner_merchant_id,
       CASE WHEN a.normal_balance = 'DEBIT' THEN a.balance ELSE -a.balance END AS natural_balance,
       a.last_entry_seq,
       a.updated_at
  FROM public.ledger_accounts a;

GRANT USAGE ON SCHEMA valo_reporting TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA valo_reporting TO authenticated;

-- =====================================================================
-- SECTION 20. INTEGRITY ASSERTIONS FOR CI
-- =====================================================================

CREATE OR REPLACE FUNCTION valo_private.fn_integrity_check()
RETURNS TABLE (check_name text, violations bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT 'ledger_journals_unbalanced',
         count(*) FROM (
           SELECT transaction_id FROM public.ledger_entries
            GROUP BY 1 HAVING sum(signed_amount) <> 0) x
  UNION ALL
  SELECT 'ledger_balance_drift',
         count(*) FROM (
           SELECT e.account_id
             FROM public.ledger_entries e
             JOIN public.ledger_accounts a ON a.id = e.account_id
            GROUP BY e.account_id, a.balance
           HAVING sum(e.signed_amount) <> a.balance) y
  UNION ALL
  SELECT 'counters_vs_transactions_drift',
         count(*) FROM (
           SELECT c.student_id, c.business_date
             FROM public.student_daily_counters c
             LEFT JOIN public.canteen_transactions t
               ON t.student_id = c.student_id
              AND t.business_date = c.business_date
              AND t.status = 'SETTLED'
            GROUP BY c.student_id, c.business_date, c.spent_amount, c.overdraft_amount
           HAVING coalesce(sum(t.amount - t.emergency_amount), 0) <> c.spent_amount) z
  UNION ALL
  SELECT 'students_multiple_primary_guardians',
         count(*) FROM (
           SELECT student_id FROM public.guardian_student_map
            WHERE is_primary_guardian AND status = 'active'
            GROUP BY 1 HAVING count(*) > 1) w
  UNION ALL
  SELECT 'cross_tenant_transactions',
         count(*) FROM public.canteen_transactions t
           JOIN public.students  s ON s.id = t.student_id
           JOIN public.merchants m ON m.id = t.merchant_id
          WHERE s.school_id <> m.school_id
  UNION ALL
  SELECT 'default_partition_not_empty',
         (SELECT count(*) FROM public.canteen_transactions_default);
$$;

COMMIT;