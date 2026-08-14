-- =====================================================================
-- VALO EDUCATION ECOSYSTEM - CORE SCHEMA v3.0
-- Target      : PostgreSQL 15+ / Supabase
-- Supersedes  : schema v2.0 (16 tables, single-entry ledger, mutable pagu)
-- Author      : Principal Database Architecture Review
-- Currency    : IDR only in v3 (multi-currency ready via currency_code)
-- Timezone    : Business day = Asia/Jakarta (WIB, UTC+7)
-- =====================================================================
-- MIGRATION SAFETY NOTE
--   This script is written as a clean-install DDL. For an existing v2
--   database, run it against a new schema and migrate with the backfill
--   statements in section 19, never as an in-place ALTER cascade.
-- =====================================================================

begin;

-- =====================================================================
-- SECTION 0. EXTENSIONS, SCHEMAS, ROLE HARDENING
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_stat_statements;
create extension if not exists pg_trgm;
create extension if not exists btree_gist;
create extension if not exists pg_cron;

-- Private schema: NOT exposed by PostgREST. Helper functions, ledger
-- internals and anything that must never be reachable from a client key.
create schema if not exists valo_private;
revoke all on schema valo_private from public, anon, authenticated;

-- Audit/reporting schema for read-only analytical views.
create schema if not exists valo_reporting;

comment on schema valo_private is
  'Internal helpers and privileged routines. Never added to PostgREST db-schemas.';

-- =====================================================================
-- SECTION 1. ENUM TYPES AND DOMAINS
--   Rationale: native enums allow ALTER TYPE ... ADD VALUE without a full
--   table rewrite. CHECK-based pseudo-enums in v2 required an ACCESS
--   EXCLUSIVE lock and a full validation scan on every new status.
-- =====================================================================

create type public.user_role_t as enum (
  'parent', 'school_admin', 'school_treasurer', 'merchant_owner',
  'merchant_staff', 'platform_admin', 'platform_support'
);

create type public.school_status_t   as enum ('active','suspended','offboarded');
create type public.merchant_status_t as enum ('pending','active','suspended','terminated');

create type public.student_status_t as enum (
  'active','suspended','graduated','transferred_out','archived'
);

create type public.card_status_t as enum (
  'pending_activation','active','lost_reported','blocked','replaced','retired'
);

create type public.guardian_relationship_t as enum (
  'ayah','ibu','wali','kakek_nenek','saudara','institusi','lainnya'
);

create type public.guardian_link_status_t as enum ('pending','active','revoked');

create type public.txn_status_t as enum (
  'PENDING','SETTLED','REJECTED_OVERLIMIT','REJECTED_CARD_BLOCKED',
  'REJECTED_POST_HOC','REVERSED'
);

create type public.settlement_status_t as enum (
  'UNSETTLED','BATCHED','DISBURSED','FAILED'
);

create type public.txn_channel_t as enum ('ONLINE_TAP','OFFLINE_SYNC','MANUAL_ADJUSTMENT');

create type public.invoice_status_t as enum (
  'DRAFT','UNPAID','PROCESSING','PAID','FAILED','OVERDUE','WAIVED','CANCELLED'
);

create type public.ledger_account_t as enum (
  'parent_funding',      -- source of funds held at BNI, mirrored internally
  'student_pagu',        -- allowance control account per student
  'student_vault',       -- savings vault per student
  'student_advance',     -- receivable created by emergency overdraft
  'merchant_payable',    -- amount owed to a canteen merchant
  'school_escrow',       -- SPP collected, pending disbursement to Giro
  'platform_clearing',   -- suspense account for in-flight H2H movements
  'platform_revenue'
);

create type public.ledger_normal_balance_t as enum ('DEBIT','CREDIT');

create type public.ledger_source_t as enum (
  'CANTEEN_TAP','CANTEEN_REVERSAL','SPP_DEBIT','VAULT_ROLLOVER',
  'VAULT_WITHDRAWAL','ADVANCE_REPAYMENT','MERCHANT_DISBURSEMENT',
  'TOPUP','MANUAL_ADJUSTMENT','OFFBOARDING_PAYOUT'
);

create type public.card_event_t as enum (
  'issued','activated','lost_reported','blocked','unblocked','reissued','retired','offboarded'
);

create type public.consent_type_t as enum (
  'DATA_PROCESSING_MINOR','MARKETING','AI_ANALYTICS','BIOMETRIC_NONE'
);

create type public.sync_status_t as enum ('PENDING','SYNCED','CONFLICT','DISCARDED');

create type public.idempotency_status_t as enum ('PROCESSING','COMPLETED','FAILED');

create type public.ai_persona_t as enum ('merchant_ai','school_treasury_ai','parent_ai');

-- Monetary domains.
--   money_amt  : per-transaction values. NUMERIC(14,2) caps at ~999 miliar.
--   ledger_amt : aggregate balances. NUMERIC(18,2) caps at ~9,99 kuadriliun,
--                required because school_escrow accumulates across periods.
create domain public.money_amt  as numeric(14,2);
create domain public.ledger_amt as numeric(18,2);

-- IDR has no circulating sub-unit. Reject fractional rupiah at the type
-- boundary rather than discovering rounding drift during reconciliation.
create domain public.idr_amt as numeric(14,2)
  check (value = round(value, 0));

create domain public.period_ym as text
  check (value ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

create domain public.phone_e164 as text
  check (value ~ '^\+[1-9][0-9]{7,14}$');

-- =====================================================================
-- SECTION 2. TENANT ROOT AND IDENTITY
-- =====================================================================

create table public.schools (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (length(btrim(name)) between 3 and 200),
  npsn              text unique check (npsn ~ '^[0-9]{8}$'),
  bni_giro_account  text not null,
  address           text,
  timezone          text not null default 'Asia/Jakarta',
  default_daily_limit    public.idr_amt not null default 20000,
  default_emergency_limit public.idr_amt not null default 15000,
  status            public.school_status_t not null default 'active',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

comment on column public.schools.timezone is
  'Per-tenant business day boundary. Schools outside WIB (WITA/WIT) get correct pagu windows.';

create table public.merchants (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id) on delete restrict,
  name                  text not null,
  pic_name              text,
  bni_merchant_account  text not null,
  status                public.merchant_status_t not null default 'pending',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  -- Required target for the composite same-tenant FK on transactions.
  constraint uq_merchants_id_school unique (id, school_id)
);

create table public.parents (
  id                  uuid primary key default gen_random_uuid(),
  full_name           text not null,
  phone_number        public.phone_e164 not null unique,
  phone_verified_at   timestamptz,
  email               text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  bni_account_number  text,
  bni_link_status     text not null default 'PENDING_BANK_LINK'
                      check (bni_link_status in ('PENDING_BANK_LINK','LINKED','FAILED','REVOKED')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

comment on table public.parents is
  'v3 CHANGE: auth_user_id removed. The single binding between auth.users and a '
  'parent record now lives exclusively in public.profiles.parent_id, eliminating '
  'the v2 dual-path drift where profiles and parents could disagree on identity.';

comment on column public.parents.bni_account_number is
  'v3 CHANGE: nullable. v2 forced NOT NULL, which pushed the student-registration '
  'route to synthesise fake account numbers (888xxxxxxxxx) to satisfy the constraint. '
  'A NULL account with bni_link_status = PENDING_BANK_LINK is the honest state.';

-- Identity binding. One row per auth.users row.
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete restrict,
  display_name  text not null,
  parent_id     uuid references public.parents(id) on delete restrict,
  locale        text not null default 'id-ID',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint uq_profiles_parent unique (parent_id)
);

comment on table public.profiles is
  'v3 CHANGE: role/school_id/merchant_id moved out to public.user_roles. v2 forced '
  'one role per human, which cannot represent a canteen owner who is also a parent '
  'at the same school, and had no constraint preventing a parent row from carrying '
  'a merchant_id.';

comment on column public.profiles.id is
  'ON DELETE RESTRICT, not CASCADE. Deleting an auth user must not silently erase a '
  'profile referenced by immutable audit rows. Deactivate via is_active instead.';

-- Multi-role, scope-aware RBAC.
create table public.user_roles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         public.user_role_t not null,
  school_id    uuid references public.schools(id)   on delete cascade,
  merchant_id  uuid references public.merchants(id) on delete cascade,
  granted_by   uuid references public.profiles(id)  on delete set null,
  granted_at   timestamptz not null default now(),
  revoked_at   timestamptz,

  -- Scope exclusivity. This is the invariant v2 expressed nowhere.
  constraint ck_user_roles_scope check (
    case role
      when 'parent'            then school_id is null and merchant_id is null
      when 'platform_admin'    then school_id is null and merchant_id is null
      when 'platform_support'  then school_id is null and merchant_id is null
      when 'school_admin'      then school_id is not null and merchant_id is null
      when 'school_treasurer'  then school_id is not null and merchant_id is null
      when 'merchant_owner'    then merchant_id is not null
      when 'merchant_staff'    then merchant_id is not null
    end
  )
);

-- One active grant per (user, role, scope). Revoked rows remain for audit.
create unique index uq_user_roles_active
  on public.user_roles (user_id, role, coalesce(school_id, merchant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where revoked_at is null;

create index idx_user_roles_user_active on public.user_roles (user_id) where revoked_at is null;

-- =====================================================================
-- SECTION 3. STUDENTS AND CARD CREDENTIALS
-- =====================================================================

create table public.students (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete restrict,
  full_name     text not null,
  student_number text,
  class_label   text,
  date_of_birth date,
  status        public.student_status_t not null default 'active',

  -- Policy fields only. Consumption counters live in student_daily_counters.
  daily_limit       public.idr_amt not null default 20000 check (daily_limit >= 0),
  emergency_approve boolean not null default true,
  emergency_limit   public.idr_amt not null default 15000 check (emergency_limit >= 0),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  offboarded_at timestamptz,

  constraint uq_students_id_school unique (id, school_id),
  constraint uq_students_number_per_school unique (school_id, student_number)
);

comment on table public.students is
  'v3 CHANGE: daily_limit_used, daily_limit_reset_at, emergency_used_today and '
  'emergency_overdraft_count_7d removed. Those were mutable denormalised aggregates '
  'on the single hottest row in the system: they served as the lock hotspot for every '
  'NFC tap, could drift from canteen_transactions with no way to detect it, and could '
  'not be reconstructed for any past date. See public.student_daily_counters.';

-- Card credentials separated from the student. v2 stored nfc_uid_hash directly
-- on students with a global UNIQUE, which makes card reissue impossible without
-- destroying the audit history of the previous UID.
create table public.student_cards (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students(id) on delete restrict,
  school_id     uuid not null references public.schools(id)  on delete restrict,
  uid_hash      bytea not null,               -- sha256(raw_uid || tenant_salt), 32 bytes
  uid_last4     text check (uid_last4 ~ '^[0-9A-Fa-f]{4}$'),
  status        public.card_status_t not null default 'pending_activation',
  issued_at     timestamptz not null default now(),
  activated_at  timestamptz,
  retired_at    timestamptz,
  replaced_by_card_id uuid references public.student_cards(id) on delete set null,
  created_at    timestamptz not null default now(),

  constraint ck_card_hash_len check (octet_length(uid_hash) = 32),
  constraint fk_cards_student_tenant
    foreign key (student_id, school_id) references public.students(id, school_id)
);

comment on column public.student_cards.uid_hash is
  'v3 CHANGE: bytea (32 bytes) instead of varchar hex (64 bytes). Halves the size of '
  'the single most frequently probed index in the system and removes hex-case ambiguity.';

-- UID uniqueness is tenant-scoped, not global. Two schools salt independently,
-- so a global unique is both unnecessary and a cross-tenant information leak
-- (a collision error would confirm a card exists in another school).
create unique index uq_cards_tenant_uid on public.student_cards (school_id, uid_hash);

-- Exactly one active card per student, enforced by the database.
create unique index uq_cards_one_active
  on public.student_cards (student_id)
  where status in ('active','pending_activation');

-- The hot path. Partial index keeps only live cards resident in cache.
create index idx_cards_uid_active
  on public.student_cards (uid_hash)
  where status = 'active';

-- =====================================================================
-- SECTION 4. GUARDIANSHIP
-- =====================================================================

create table public.guardian_student_map (
  id                uuid primary key default gen_random_uuid(),
  parent_id         uuid not null references public.parents(id)  on delete restrict,
  student_id        uuid not null references public.students(id) on delete restrict,
  school_id         uuid not null references public.schools(id)  on delete restrict,
  relationship      public.guardian_relationship_t not null default 'wali',
  is_primary_guardian boolean not null default false,
  status            public.guardian_link_status_t not null default 'pending',

  -- Granular capability grants. v2 gave every linked guardian identical full
  -- control, which cannot express separated or divorced households, a
  -- non-paying guardian, or a school-appointed institutional guardian.
  can_view_activity     boolean not null default true,
  can_manage_pagu       boolean not null default false,
  can_fund              boolean not null default false,
  can_approve_vault     boolean not null default false,
  can_report_card_lost  boolean not null default true,

  valid_from  timestamptz not null default now(),
  valid_until timestamptz,
  revoked_at  timestamptz,
  revoked_reason text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint uq_gsm_pair unique (parent_id, student_id),
  constraint ck_gsm_validity check (valid_until is null or valid_until > valid_from),
  constraint ck_gsm_revoked  check (
    (status = 'revoked') = (revoked_at is not null)
  ),
  constraint fk_gsm_student_tenant
    foreign key (student_id, school_id) references public.students(id, school_id)
);

comment on table public.guardian_student_map is
  'v3 CHANGE: ON DELETE CASCADE replaced with RESTRICT plus soft revocation. In v2, '
  'deleting a parent row silently destroyed the guardianship record that authorised '
  'every historical transaction. In a regulated ledger the authorisation chain must '
  'outlive the party.';

-- Exactly one primary guardian per student. v2 defaulted is_primary_guardian to
-- true with no exclusion index, so a father-and-mother pair produced two primaries.
create unique index uq_gsm_one_primary
  on public.guardian_student_map (student_id)
  where is_primary_guardian and status = 'active';

-- Directional lookups for RLS subplans.
create index idx_gsm_parent_active
  on public.guardian_student_map (parent_id, student_id)
  where status = 'active';

create index idx_gsm_student_active
  on public.guardian_student_map (student_id, parent_id)
  where status = 'active';

-- =====================================================================
-- SECTION 5. DAILY PAGU COUNTERS  (replaces mutable state on students)
-- =====================================================================

create table public.student_daily_counters (
  student_id        uuid not null references public.students(id) on delete restrict,
  business_date     date not null,
  school_id         uuid not null references public.schools(id)  on delete restrict,
  limit_snapshot    public.idr_amt not null,      -- daily_limit as at the first tap
  spent_amount      public.idr_amt not null default 0 check (spent_amount >= 0),
  overdraft_amount  public.idr_amt not null default 0 check (overdraft_amount >= 0),
  overdraft_count   smallint not null default 0 check (overdraft_count >= 0),
  txn_count         integer not null default 0,
  rolled_over_at    timestamptz,
  rolled_over_amount public.idr_amt,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (student_id, business_date)
);

comment on table public.student_daily_counters is
  'One row per student per business day (Asia/Jakarta). The day boundary is implicit '
  'in the primary key, so pagu reset requires no cron job and cannot fail. v2 depended '
  'on sp_rollover_daily_vault() firing exactly once: its WHERE daily_limit_reset_at = '
  'current_date predicate meant a single missed run left students permanently unable '
  'to reset, because the following night the predicate no longer matched.';

-- Weekly overdraft anomaly detection reads this, not a full transaction scan.
create index idx_sdc_overdraft
  on public.student_daily_counters (student_id, business_date desc)
  where overdraft_count > 0;

create index idx_sdc_pending_rollover
  on public.student_daily_counters (business_date)
  where rolled_over_at is null;

-- =====================================================================
-- SECTION 6. DOUBLE-ENTRY LEDGER  (replaces single-table wallet_ledger)
-- =====================================================================
-- v2's wallet_ledger was not double-entry. It recorded one row per money
-- movement with an entry_type flag and no journal grouping column, so the
-- fundamental invariant of a ledger, that debits equal credits within a
-- posting, was structurally unprovable. account_ref_id was a polymorphic
-- uuid with no foreign key, and balance_after was written without any
-- serialisation guarantee, so two concurrent postings against one account
-- would both compute the same balance_after.
-- =====================================================================

create table public.ledger_accounts (
  id             uuid primary key default gen_random_uuid(),
  account_type   public.ledger_account_t not null,
  normal_balance public.ledger_normal_balance_t not null,
  currency_code  char(3) not null default 'IDR',

  owner_school_id   uuid references public.schools(id)   on delete restrict,
  owner_parent_id   uuid references public.parents(id)   on delete restrict,
  owner_student_id  uuid references public.students(id)  on delete restrict,
  owner_merchant_id uuid references public.merchants(id) on delete restrict,

  -- Denormalised running balance, mutated only by valo_private.fn_post_journal
  -- under an explicit row lock. entry_seq is the serialisation token.
  balance        public.ledger_amt not null default 0,
  last_entry_seq bigint not null default 0,

  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Exactly one owner column populated, and it must match account_type.
  constraint ck_ledger_owner_shape check (
    num_nonnulls(owner_school_id, owner_parent_id, owner_student_id, owner_merchant_id)
      = case when account_type in ('platform_clearing','platform_revenue') then 0 else 1 end
  ),
  constraint ck_ledger_owner_matches_type check (
    case account_type
      when 'parent_funding'    then owner_parent_id   is not null
      when 'student_pagu'      then owner_student_id  is not null
      when 'student_vault'     then owner_student_id  is not null
      when 'student_advance'   then owner_student_id  is not null
      when 'merchant_payable'  then owner_merchant_id is not null
      when 'school_escrow'     then owner_school_id   is not null
      else true
    end
  )
);

create unique index uq_ledger_acct_parent on public.ledger_accounts (account_type, owner_parent_id)   where owner_parent_id   is not null;
create unique index uq_ledger_acct_student on public.ledger_accounts (account_type, owner_student_id) where owner_student_id  is not null;
create unique index uq_ledger_acct_merchant on public.ledger_accounts (account_type, owner_merchant_id) where owner_merchant_id is not null;
create unique index uq_ledger_acct_school on public.ledger_accounts (account_type, owner_school_id)   where owner_school_id   is not null;
create unique index uq_ledger_acct_platform on public.ledger_accounts (account_type, currency_code)
  where account_type in ('platform_clearing','platform_revenue');

-- Journal header. One row per balanced posting.
create table public.ledger_transactions (
  id             uuid primary key default gen_random_uuid(),
  source         public.ledger_source_t not null,
  source_table   text not null,
  source_id      uuid not null,
  school_id      uuid references public.schools(id) on delete restrict,
  business_date  date not null,
  currency_code  char(3) not null default 'IDR',
  description    text,
  reverses_id    uuid references public.ledger_transactions(id) on delete restrict,
  posted_by      uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

-- A given business event posts exactly once. This is the ledger-level
-- idempotency guarantee, independent of the HTTP idempotency key.
create unique index uq_ledger_txn_source
  on public.ledger_transactions (source, source_table, source_id)
  where reverses_id is null;

create index idx_ledger_txn_school_date on public.ledger_transactions (school_id, business_date desc);

-- Journal lines. signed_amount: DEBIT positive, CREDIT negative.
create table public.ledger_entries (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.ledger_transactions(id) on delete restrict,
  account_id     uuid not null references public.ledger_accounts(id)     on delete restrict,
  signed_amount  public.ledger_amt not null check (signed_amount <> 0),
  entry_seq      bigint not null,
  balance_after  public.ledger_amt not null,
  created_at     timestamptz not null default now(),
  constraint uq_ledger_entry_seq unique (account_id, entry_seq)
);

comment on constraint uq_ledger_entry_seq on public.ledger_entries is
  'Serialisation token. Makes a lost update on balance_after a constraint violation '
  'rather than silent corruption, which is what v2 permitted.';

create index idx_ledger_entries_txn     on public.ledger_entries (transaction_id);
create index idx_ledger_entries_account on public.ledger_entries (account_id, entry_seq desc);

-- Balanced-journal enforcement, deferred to commit so a multi-statement
-- posting can build the journal incrementally.
create or replace function valo_private.trg_assert_journal_balanced()
returns trigger
language plpgsql
as $$
declare
  v_sum public.ledger_amt;
  v_cnt integer;
  v_txn uuid;
begin
  if tg_op = 'DELETE' then v_txn := old.transaction_id; else v_txn := new.transaction_id; end if;

  select coalesce(sum(signed_amount), 0), count(*)
    into v_sum, v_cnt
    from public.ledger_entries
   where transaction_id = v_txn;

  if v_cnt = 0 then
    return null;                       -- whole journal removed in the same statement
  end if;

  if v_cnt < 2 then
    raise exception 'LEDGER_UNBALANCED: journal % has % entry line(s), minimum is 2', v_txn, v_cnt
      using errcode = '23514';
  end if;

  if v_sum <> 0 then
    raise exception 'LEDGER_UNBALANCED: journal % sums to %, expected 0', v_txn, v_sum
      using errcode = '23514';
  end if;

  return null;
end;
$$;

create constraint trigger ct_ledger_entries_balanced
  after insert or update or delete on public.ledger_entries
  deferrable initially deferred
  for each row execute function valo_private.trg_assert_journal_balanced();

-- =====================================================================
-- SECTION 7. IMMUTABILITY ENFORCEMENT
-- =====================================================================
-- RLS does not protect the ledger. service_role bypasses RLS entirely, and
-- every financial write in the current codebase runs as service_role. Only
-- triggers and revoked table privileges bind that role.
-- =====================================================================

create or replace function valo_private.trg_forbid_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'IMMUTABLE_RECORD: % on %.% is not permitted',
    tg_op, tg_table_schema, tg_table_name
    using errcode = '42501',
          hint = 'Post a compensating reversal entry instead of mutating history.';
end;
$$;

create trigger tg_ledger_txn_immutable
  before update or delete on public.ledger_transactions
  for each row execute function valo_private.trg_forbid_mutation();

create trigger tg_ledger_entries_immutable
  before update or delete on public.ledger_entries
  for each row execute function valo_private.trg_forbid_mutation();

revoke update, delete, truncate on public.ledger_transactions from public, anon, authenticated;
revoke update, delete, truncate on public.ledger_entries      from public, anon, authenticated;

-- =====================================================================
-- SECTION 8. CANTEEN TRANSACTIONS  (range-partitioned by month)
-- =====================================================================
-- Sizing basis: 500 active students per school, ~2 taps per school day,
-- ~220 school days per year = ~220.000 rows per school per year.
--   10 schools  ->  2,2 juta rows/year   : partitioning not yet warranted
--   50 schools  -> 11 juta rows/year     : partition
--  200 schools  -> 44 juta rows/year     : partition plus monthly detach
-- Partitioning is declared here because retrofitting it onto a populated
-- table requires a full rewrite under an exclusive lock.
-- =====================================================================

create table public.canteen_transactions (
  id                   uuid not null default gen_random_uuid(),
  school_id            uuid not null,
  student_id           uuid not null,
  merchant_id          uuid not null,
  card_id              uuid,
  amount               public.idr_amt not null check (amount > 0),
  status               public.txn_status_t not null default 'PENDING',
  settlement_status    public.settlement_status_t not null default 'UNSETTLED',
  channel              public.txn_channel_t not null default 'ONLINE_TAP',
  is_emergency         boolean not null default false,
  emergency_amount     public.idr_amt not null default 0 check (emergency_amount >= 0),
  idempotency_key      uuid not null,
  client_local_tx_uuid uuid,
  settlement_batch_id  uuid,
  ledger_transaction_id uuid,
  reversal_of_id       uuid,
  items                jsonb not null default '[]'::jsonb,
  rejection_reason     text,
  created_at           timestamptz not null default now(),
  -- Business date is derived, never supplied by the client.
  business_date        date not null
    generated always as (((created_at at time zone 'Asia/Jakarta'))::date) stored,

  constraint pk_canteen_transactions primary key (id, created_at),
  constraint ck_ctx_emergency_amount check (
    (is_emergency and emergency_amount > 0) or (not is_emergency and emergency_amount = 0)
  ),
  constraint ck_ctx_items_array check (jsonb_typeof(items) = 'array'),
  constraint fk_ctx_student_tenant
    foreign key (student_id, school_id) references public.students(id, school_id) on delete restrict,
  constraint fk_ctx_merchant_tenant
    foreign key (merchant_id, school_id) references public.merchants(id, school_id) on delete restrict
) partition by range (created_at);

comment on constraint fk_ctx_student_tenant on public.canteen_transactions is
  'Composite tenant FK. v2 referenced students(id) and merchants(id) independently, '
  'so nothing at the database level prevented a student of school A from being charged '
  'at a merchant of school B. This constraint makes cross-tenant settlement impossible.';

comment on column public.canteen_transactions.school_id is
  'Denormalised tenant key. Present so RLS policies compare one indexed column against '
  'an InitPlan constant instead of running a correlated subquery over students per row.';

comment on column public.canteen_transactions.business_date is
  'v3 ADDITION. v2 aggregated daily reports on created_at, which is UTC. A school day '
  'in WIB spans two UTC dates, so every daily sales figure crossing 07:00 WIB was '
  'attributed to the wrong day.';

-- Uniqueness on a partitioned table must include the partition key, so the
-- global idempotency guarantee cannot live here. It lives in
-- public.idempotency_keys, which is deliberately left unpartitioned.
create index idx_ctx_idem on public.canteen_transactions (idempotency_key);

create index idx_ctx_student_time
  on public.canteen_transactions (student_id, created_at desc);

create index idx_ctx_merchant_bdate
  on public.canteen_transactions (merchant_id, business_date desc, status);

create index idx_ctx_school_bdate
  on public.canteen_transactions (school_id, business_date desc);

create index idx_ctx_settlement
  on public.canteen_transactions (settlement_batch_id)
  where settlement_status in ('BATCHED','FAILED');

create index idx_ctx_unsettled
  on public.canteen_transactions (merchant_id, created_at)
  where settlement_status = 'UNSETTLED' and status = 'SETTLED';

-- Non-unique: PostgreSQL forbids partial UNIQUE indexes on partitioned tables.
-- Offline replay dedupe is enforced by uq_osq_local on offline_sync_queue, which
-- is unpartitioned and therefore able to carry a real uniqueness guarantee.
create index uq_ctx_local_tx
  on public.canteen_transactions (merchant_id, client_local_tx_uuid)
  where client_local_tx_uuid is not null;

-- Menu-level analytics for the Merchant AI persona.
create index idx_ctx_items_gin
  on public.canteen_transactions using gin (items jsonb_path_ops);

-- Append-only time column: BRIN is roughly 1/1000 the size of a btree here.
create index idx_ctx_created_brin
  on public.canteen_transactions using brin (created_at) with (pages_per_range = 32);

-- Restricted mutation: only settlement and reversal fields may change.
create or replace function valo_private.trg_ctx_guard_immutable_cols()
returns trigger
language plpgsql
as $$
begin
  if (new.id, new.student_id, new.merchant_id, new.school_id, new.amount,
      new.idempotency_key, new.is_emergency, new.created_at)
     is distinct from
     (old.id, old.student_id, old.merchant_id, old.school_id, old.amount,
      old.idempotency_key, old.is_emergency, old.created_at)
  then
    raise exception 'IMMUTABLE_FIELD: financial fields of canteen_transactions are append-only'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger tg_ctx_guard_cols
  before update on public.canteen_transactions
  for each row execute function valo_private.trg_ctx_guard_immutable_cols();

create trigger tg_ctx_no_delete
  before delete on public.canteen_transactions
  for each row execute function valo_private.trg_forbid_mutation();

-- =====================================================================
-- SECTION 9. SPP INVOICES
-- =====================================================================

create table public.spp_invoices (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete restrict,
  student_id       uuid not null references public.students(id) on delete restrict,
  billed_parent_id uuid references public.parents(id) on delete restrict,
  period           public.period_ym not null,
  period_start     date generated always as (make_date(left(period,4)::int, right(period,2)::int, 1)) stored,
  amount           public.idr_amt not null check (amount > 0),
  amount_paid      public.idr_amt not null default 0 check (amount_paid >= 0),
  status           public.invoice_status_t not null default 'UNPAID',
  retry_count      smallint not null default 0 check (retry_count between 0 and 10),
  next_retry_at    timestamptz,
  due_date         date not null,
  paid_at          timestamptz,
  bni_h2h_reference text,
  ledger_transaction_id uuid references public.ledger_transactions(id) on delete restrict,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint uq_spp_student_period unique (student_id, period),
  constraint ck_spp_paid_consistency check (
    (status = 'PAID') = (paid_at is not null)
  ),
  constraint ck_spp_overpay check (amount_paid <= amount),
  constraint fk_spp_student_tenant
    foreign key (student_id, school_id) references public.students(id, school_id)
);

create unique index uq_spp_h2h_ref
  on public.spp_invoices (bni_h2h_reference)
  where bni_h2h_reference is not null;

create index idx_spp_school_period on public.spp_invoices (school_id, period, status);

-- Retry sweeper reads only this index, never a full table scan.
create index idx_spp_retry_due
  on public.spp_invoices (next_retry_at)
  where status in ('UNPAID','FAILED');

create index idx_spp_overdue
  on public.spp_invoices (school_id, due_date)
  where status in ('UNPAID','FAILED','OVERDUE');

-- =====================================================================
-- SECTION 10. STUDENT VAULT AND OVERDRAFT ADVANCES
-- =====================================================================

create table public.student_vault (
  student_id         uuid primary key references public.students(id) on delete restrict,
  school_id          uuid not null references public.schools(id) on delete restrict,
  ledger_account_id  uuid not null references public.ledger_accounts(id) on delete restrict,
  savings_goal_name  text,
  savings_goal_target public.idr_amt check (savings_goal_target is null or savings_goal_target > 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint fk_vault_student_tenant
    foreign key (student_id, school_id) references public.students(id, school_id)
);

comment on table public.student_vault is
  'v3 CHANGE: vault_balance column removed. The balance is the ledger account balance. '
  'v2 kept a second authoritative copy of the same number in two places with no '
  'reconciliation path between them.';

create table public.vault_withdrawal_requests (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students(id) on delete restrict,
  requested_by  uuid not null references public.parents(id)  on delete restrict,
  approved_by   uuid references public.parents(id) on delete restrict,
  amount        public.idr_amt not null check (amount > 0),
  status        text not null default 'PENDING_CONFIRM'
                check (status in ('PENDING_CONFIRM','APPROVED','REJECTED','DISBURSED','EXPIRED')),
  destination_account text,
  ledger_transaction_id uuid references public.ledger_transactions(id) on delete restrict,
  requested_at  timestamptz not null default now(),
  resolved_at   timestamptz,
  expires_at    timestamptz not null default (now() + interval '7 days')
);

-- Dual control: the approving guardian must not be the requesting guardian.
alter table public.vault_withdrawal_requests
  add constraint ck_vault_dual_control
  check (approved_by is null or approved_by <> requested_by);

create index idx_vault_wd_pending
  on public.vault_withdrawal_requests (student_id, requested_at desc)
  where status = 'PENDING_CONFIRM';

-- Emergency overdraft is a receivable, per spec 2.4, not a free grant.
create table public.student_advances (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references public.students(id) on delete restrict,
  school_id          uuid not null references public.schools(id)  on delete restrict,
  origin_txn_id      uuid not null,
  principal_amount   public.idr_amt not null check (principal_amount > 0),
  outstanding_amount public.idr_amt not null check (outstanding_amount >= 0),
  status             text not null default 'OUTSTANDING'
                     check (status in ('OUTSTANDING','PARTIALLY_REPAID','REPAID','WRITTEN_OFF')),
  incurred_on        date not null,
  repaid_at          timestamptz,
  created_at         timestamptz not null default now(),
  constraint ck_advance_outstanding check (outstanding_amount <= principal_amount),
  constraint fk_advance_student_tenant
    foreign key (student_id, school_id) references public.students(id, school_id)
);

create index idx_advances_outstanding
  on public.student_advances (student_id, incurred_on)
  where status in ('OUTSTANDING','PARTIALLY_REPAID');

-- =====================================================================
-- SECTION 11. IDEMPOTENCY  (unpartitioned, globally unique)
-- =====================================================================

create table public.idempotency_keys (
  key                 uuid not null,
  endpoint            text not null,
  actor_user_id       uuid references public.profiles(id) on delete set null,
  request_fingerprint text not null,
  response_snapshot   jsonb,
  response_status     smallint,
  status              public.idempotency_status_t not null default 'PROCESSING',
  created_at          timestamptz not null default now(),
  completed_at        timestamptz,
  expires_at          timestamptz not null default (now() + interval '48 hours'),
  constraint pk_idempotency primary key (endpoint, key)
);

comment on column public.idempotency_keys.request_fingerprint is
  'sha256 of the canonical request body. v2 keyed only on the UUID, so replaying the '
  'same key with a different amount returned the cached response for the original '
  'amount, silently discarding a real transaction. A fingerprint mismatch must now '
  'return 422 IDEMPOTENCY_KEY_REUSE.';

comment on constraint pk_idempotency on public.idempotency_keys is
  'Scoped per endpoint. A global UUID unique in v2 meant a key generated for one '
  'endpoint would collide against an unrelated endpoint.';

create index idx_idem_expiry on public.idempotency_keys (expires_at);

-- =====================================================================
-- SECTION 12. OFFLINE SYNC QUEUE
-- =====================================================================

create table public.offline_sync_queue (
  id            uuid primary key default gen_random_uuid(),
  merchant_id   uuid not null references public.merchants(id) on delete restrict,
  school_id     uuid not null references public.schools(id)   on delete restrict,
  local_tx_uuid uuid not null,
  payload       jsonb not null,
  sync_status   public.sync_status_t not null default 'PENDING',
  conflict_reason text,
  resulting_txn_id uuid,
  device_captured_at timestamptz not null,
  received_at   timestamptz not null default now(),
  synced_at     timestamptz,
  constraint uq_osq_local unique (merchant_id, local_tx_uuid),
  constraint fk_osq_merchant_tenant
    foreign key (merchant_id, school_id) references public.merchants(id, school_id)
);

create index idx_osq_pending
  on public.offline_sync_queue (merchant_id, device_captured_at)
  where sync_status = 'PENDING';

-- =====================================================================
-- SECTION 13. COMPLIANCE, LIFECYCLE AND AUDIT
-- =====================================================================

create table public.card_lifecycle_events (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students(id) on delete restrict,
  card_id       uuid references public.student_cards(id) on delete restrict,
  school_id     uuid not null references public.schools(id) on delete restrict,
  event_type    public.card_event_t not null,
  notes         text,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_role_snapshot public.user_role_t,
  created_at    timestamptz not null default now(),
  constraint fk_cle_student_tenant
    foreign key (student_id, school_id) references public.students(id, school_id)
);

create index idx_cle_student on public.card_lifecycle_events (student_id, created_at desc);

create trigger tg_cle_immutable
  before update or delete on public.card_lifecycle_events
  for each row execute function valo_private.trg_forbid_mutation();

create table public.parental_consent (
  id            uuid primary key default gen_random_uuid(),
  parent_id     uuid not null references public.parents(id)  on delete restrict,
  student_id    uuid not null references public.students(id) on delete restrict,
  school_id     uuid not null references public.schools(id)  on delete restrict,
  consent_type  public.consent_type_t not null default 'DATA_PROCESSING_MINOR',
  consent_version text not null default 'v1.0',
  consent_token text not null,
  granted_at    timestamptz,
  revoked_at    timestamptz,
  evidence_ip   inet,
  evidence_user_agent text,
  created_at    timestamptz not null default now(),
  constraint fk_consent_student_tenant
    foreign key (student_id, school_id) references public.students(id, school_id)
);

-- At most one live consent per (student, type). v2 permitted unlimited
-- duplicate rows with no way to derive the current consent state.
create unique index uq_consent_active
  on public.parental_consent (student_id, consent_type)
  where revoked_at is null and granted_at is not null;

create index idx_consent_parent on public.parental_consent (parent_id, student_id);

-- Audit log, range-partitioned. Highest write volume of any compliance table.
create table public.audit_log (
  id            uuid not null default gen_random_uuid(),
  school_id     uuid,
  actor_user_id uuid,
  actor_role_snapshot public.user_role_t,
  action        text not null,
  entity_type   text not null,
  entity_id     uuid,
  metadata      jsonb not null default '{}'::jsonb,
  flag          text,
  ip_address    inet,
  request_id    text,
  created_at    timestamptz not null default now(),
  constraint pk_audit_log primary key (id, created_at)
) partition by range (created_at);

comment on column public.audit_log.actor_user_id is
  'Deliberately NOT a foreign key. v2 declared actor_profile_id -> profiles(id) while '
  'profiles cascaded from auth.users, so deleting an auth user either blocked on the '
  'audit FK or would have erased the audit trail. An audit record must survive the '
  'deletion of its actor. actor_role_snapshot preserves the authority context.';

create index idx_audit_entity  on public.audit_log (entity_type, entity_id, created_at desc);
create index idx_audit_actor   on public.audit_log (actor_user_id, created_at desc);
create index idx_audit_school  on public.audit_log (school_id, created_at desc);
create index idx_audit_flag    on public.audit_log (flag, created_at desc) where flag is not null;
create index idx_audit_meta    on public.audit_log using gin (metadata jsonb_path_ops);
create index idx_audit_brin    on public.audit_log using brin (created_at) with (pages_per_range = 32);

create trigger tg_audit_immutable
  before update or delete on public.audit_log
  for each row execute function valo_private.trg_forbid_mutation();

create table public.ai_chat_logs (
  id            uuid not null default gen_random_uuid(),
  persona_type  public.ai_persona_t not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  school_id     uuid,
  prompt        text not null,
  response      text not null,
  function_calls jsonb,
  model         text,
  latency_ms    integer,
  created_at    timestamptz not null default now(),
  constraint pk_ai_chat_logs primary key (id, created_at)
) partition by range (created_at);

create index idx_ai_actor on public.ai_chat_logs (actor_user_id, created_at desc);

-- =====================================================================
-- SECTION 14. PARTITION MANAGEMENT
-- =====================================================================

create or replace function valo_private.fn_ensure_month_partitions(
  p_parent regclass,
  p_months_ahead integer default 3
) returns integer
language plpgsql
security definer
set search_path = public, valo_private, pg_temp
as $$
declare
  v_i integer;
  v_start date;
  v_end   date;
  v_name  text;
  v_made  integer := 0;
  v_base  text := replace(p_parent::text, 'public.', '');
begin
  for v_i in 0 .. p_months_ahead loop
    v_start := date_trunc('month', (now() at time zone 'UTC')::date)::date + (v_i || ' month')::interval;
    v_end   := (v_start + interval '1 month')::date;
    v_name  := format('%s_p%s', v_base, to_char(v_start, 'YYYYMM'));

    if not exists (select 1 from pg_class where relname = v_name) then
      execute format(
        'create table public.%I partition of %s for values from (%L) to (%L)',
        v_name, p_parent::text, v_start, v_end
      );
      v_made := v_made + 1;
    end if;
  end loop;

  -- Catch-all so an unexpected out-of-range insert errors loudly rather than
  -- silently disappearing. DEFAULT partitions must stay empty in steady state.
  v_name := format('%s_default', v_base);
  if not exists (select 1 from pg_class where relname = v_name) then
    execute format('create table public.%I partition of %s default', v_name, p_parent::text);
  end if;

  return v_made;
end;
$$;

select valo_private.fn_ensure_month_partitions('public.canteen_transactions'::regclass, 3);
select valo_private.fn_ensure_month_partitions('public.audit_log'::regclass, 3);
select valo_private.fn_ensure_month_partitions('public.ai_chat_logs'::regclass, 3);

-- =====================================================================
-- SECTION 15. RLS CONTEXT HELPERS
-- =====================================================================
-- Design: claims are injected into the JWT by a Supabase custom access token
-- hook at sign-in, so the common path performs zero table reads. The table
-- fallback keeps the system correct before the hook is deployed and for
-- sessions issued prior to a role change.
--
-- Naming note: v2 defined public.current_role(), which collides with the SQL
-- standard reserved function current_role. Every helper is prefixed auth_ in v3.
-- =====================================================================

create or replace function valo_private.jwt_app_meta()
returns jsonb
language sql
stable
parallel safe
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata',
    '{}'::jsonb
  );
$$;

create or replace function public.auth_parent_id()
returns uuid
language plpgsql
stable
security definer
parallel safe
set search_path = public, valo_private, pg_temp
as $$
declare v_id uuid;
begin
  v_id := nullif(valo_private.jwt_app_meta() ->> 'parent_id', '')::uuid;
  if v_id is not null then return v_id; end if;
  select p.parent_id into v_id from public.profiles p where p.id = auth.uid();
  return v_id;
end;
$$;

create or replace function public.auth_school_ids()
returns uuid[]
language plpgsql
stable
security definer
parallel safe
set search_path = public, valo_private, pg_temp
as $$
declare v_ids uuid[];
begin
  select array(select jsonb_array_elements_text(
           coalesce(valo_private.jwt_app_meta() -> 'school_ids', '[]'::jsonb))::uuid)
    into v_ids;
  if array_length(v_ids, 1) is not null then return v_ids; end if;
  select array_agg(distinct ur.school_id)
    into v_ids
    from public.user_roles ur
   where ur.user_id = auth.uid()
     and ur.revoked_at is null
     and ur.school_id is not null;
  return coalesce(v_ids, '{}'::uuid[]);
end;
$$;

create or replace function public.auth_merchant_ids()
returns uuid[]
language plpgsql
stable
security definer
parallel safe
set search_path = public, valo_private, pg_temp
as $$
declare v_ids uuid[];
begin
  select array(select jsonb_array_elements_text(
           coalesce(valo_private.jwt_app_meta() -> 'merchant_ids', '[]'::jsonb))::uuid)
    into v_ids;
  if array_length(v_ids, 1) is not null then return v_ids; end if;
  select array_agg(distinct ur.merchant_id)
    into v_ids
    from public.user_roles ur
   where ur.user_id = auth.uid()
     and ur.revoked_at is null
     and ur.merchant_id is not null;
  return coalesce(v_ids, '{}'::uuid[]);
end;
$$;

create or replace function public.auth_has_role(p_role public.user_role_t)
returns boolean
language plpgsql
stable
security definer
parallel safe
set search_path = public, valo_private, pg_temp
as $$
declare v_roles jsonb;
begin
  v_roles := coalesce(valo_private.jwt_app_meta() -> 'roles', '[]'::jsonb);
  if jsonb_array_length(v_roles) > 0 then
    return v_roles ? p_role::text;
  end if;
  return exists (
    select 1 from public.user_roles ur
     where ur.user_id = auth.uid() and ur.role = p_role and ur.revoked_at is null
  );
end;
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
parallel safe
as $$ select public.auth_has_role('platform_admin'::public.user_role_t); $$;

-- Students the caller may see as a guardian. Returned as an array so the
-- policy evaluates one InitPlan per statement instead of a correlated
-- subquery per candidate row.
create or replace function public.auth_ward_ids()
returns uuid[]
language sql
stable
security definer
parallel safe
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(g.student_id), '{}'::uuid[])
    from public.guardian_student_map g
   where g.parent_id = public.auth_parent_id()
     and g.status = 'active'
     and (g.valid_until is null or g.valid_until > now());
$$;

revoke execute on function valo_private.jwt_app_meta() from public, anon;
grant execute on function
  public.auth_parent_id(), public.auth_school_ids(), public.auth_merchant_ids(),
  public.auth_has_role(public.user_role_t), public.is_platform_admin(), public.auth_ward_ids()
  to authenticated;

-- =====================================================================
-- SECTION 16. ROW LEVEL SECURITY
-- =====================================================================
-- Two rules applied throughout:
--   1. Every policy carries TO authenticated. v2 policies defaulted to PUBLIC,
--      so the planner evaluated them for anon and service contexts as well.
--   2. Every helper call is wrapped in (select ...). Without the wrapper
--      PostgreSQL treats the call as a correlated expression and re-executes it
--      once per candidate row, which is the dominant cost during a POS scan.
-- =====================================================================

alter table public.schools                 enable row level security;
alter table public.merchants               enable row level security;
alter table public.parents                 enable row level security;
alter table public.profiles                enable row level security;
alter table public.user_roles              enable row level security;
alter table public.students                enable row level security;
alter table public.student_cards           enable row level security;
alter table public.guardian_student_map    enable row level security;
alter table public.student_daily_counters  enable row level security;
alter table public.ledger_accounts         enable row level security;
alter table public.ledger_transactions     enable row level security;
alter table public.ledger_entries          enable row level security;
alter table public.canteen_transactions    enable row level security;
alter table public.spp_invoices            enable row level security;
alter table public.student_vault           enable row level security;
alter table public.vault_withdrawal_requests enable row level security;
alter table public.student_advances        enable row level security;
alter table public.idempotency_keys        enable row level security;
alter table public.offline_sync_queue      enable row level security;
alter table public.card_lifecycle_events   enable row level security;
alter table public.parental_consent        enable row level security;
alter table public.audit_log               enable row level security;
alter table public.ai_chat_logs            enable row level security;

-- Force RLS even for the table owner, so a misconfigured migration role
-- cannot read across tenants.
alter table public.students             force row level security;
alter table public.canteen_transactions force row level security;
alter table public.ledger_entries       force row level security;

-- ---------- profiles / roles ----------
create policy profiles_self_read on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_platform_admin()));

create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy user_roles_self_read on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_platform_admin()));

-- ---------- schools ----------
create policy schools_scoped_read on public.schools
  for select to authenticated
  using (id = any (select public.auth_school_ids()) or (select public.is_platform_admin()));

create policy schools_admin_update on public.schools
  for update to authenticated
  using (id = any (select public.auth_school_ids())
         and (select public.auth_has_role('school_admin')))
  with check (id = any (select public.auth_school_ids()));

-- ---------- merchants ----------
create policy merchants_scoped_read on public.merchants
  for select to authenticated
  using (
    id        = any (select public.auth_merchant_ids())
    or school_id = any (select public.auth_school_ids())
    or (select public.is_platform_admin())
  );

-- ---------- parents ----------
create policy parents_self_read on public.parents
  for select to authenticated
  using (id = (select public.auth_parent_id()) or (select public.is_platform_admin()));

create policy parents_self_update on public.parents
  for update to authenticated
  using (id = (select public.auth_parent_id()))
  with check (id = (select public.auth_parent_id()));

-- RLS controls rows, not columns. The funding account and phone number are
-- the two fields whose silent modification enables account takeover, so they
-- are withheld at the privilege layer and can only change through an RPC that
-- performs dual-channel OTP verification per spec 12.2.
-- Order matters. Revoking a column privilege while the table-level UPDATE grant
-- is still held is a no-op in PostgreSQL, so the table-level grant is dropped
-- first and re-issued only for the columns a client may legitimately change.
revoke update on public.parents from authenticated;
grant  update (full_name, email) on public.parents to authenticated;

-- ---------- students ----------
create policy students_school_read on public.students
  for select to authenticated
  using (school_id = any (select public.auth_school_ids()));

create policy students_guardian_read on public.students
  for select to authenticated
  using (id = any (select public.auth_ward_ids()));

create policy students_platform_all on public.students
  for all to authenticated
  using ((select public.is_platform_admin()))
  with check ((select public.is_platform_admin()));

-- Guardians may change policy fields only, and only where the guardianship
-- grant carries can_manage_pagu. Consumption counters are not on this table
-- at all in v3, so there is nothing for a client to tamper with.
create policy students_guardian_update_policy_fields on public.students
  for update to authenticated
  using (
    id = any (
      select g.student_id from public.guardian_student_map g
       where g.parent_id = (select public.auth_parent_id())
         and g.status = 'active' and g.can_manage_pagu
    )
  )
  with check (
    id = any (
      select g.student_id from public.guardian_student_map g
       where g.parent_id = (select public.auth_parent_id())
         and g.status = 'active' and g.can_manage_pagu
    )
  );

revoke update on public.students from authenticated;
grant  update (daily_limit, emergency_approve, emergency_limit) on public.students to authenticated;

-- Merchants deliberately receive NO select policy on students. A cashier does
-- not need to browse the student roster, and v2's students_merchant_select
-- exposed every name, daily_limit and overdraft count in the school to every
-- POS terminal, which is a data minimisation failure under UU PDP. Card
-- resolution happens inside fn_process_canteen_tap, which returns only a
-- masked display name and a decision.

-- ---------- student_cards ----------
create policy cards_school_read on public.student_cards
  for select to authenticated
  using (school_id = any (select public.auth_school_ids()));

create policy cards_guardian_read on public.student_cards
  for select to authenticated
  using (student_id = any (select public.auth_ward_ids()));

-- ---------- guardianship ----------
create policy gsm_parent_read on public.guardian_student_map
  for select to authenticated
  using (parent_id = (select public.auth_parent_id()));

create policy gsm_school_read on public.guardian_student_map
  for select to authenticated
  using (school_id = any (select public.auth_school_ids()));

-- ---------- daily counters ----------
create policy sdc_guardian_read on public.student_daily_counters
  for select to authenticated
  using (student_id = any (select public.auth_ward_ids()));

create policy sdc_school_read on public.student_daily_counters
  for select to authenticated
  using (school_id = any (select public.auth_school_ids()));

-- ---------- canteen transactions ----------
-- Tenant key comparison against an InitPlan constant. No subquery over
-- students, which is what made the v2 school-admin policy scale with roster size.
create policy ctx_merchant_read on public.canteen_transactions
  for select to authenticated
  using (merchant_id = any (select public.auth_merchant_ids()));

create policy ctx_school_read on public.canteen_transactions
  for select to authenticated
  using (school_id = any (select public.auth_school_ids()));

create policy ctx_guardian_read on public.canteen_transactions
  for select to authenticated
  using (student_id = any (select public.auth_ward_ids()));

-- No INSERT or UPDATE policy exists. Writes occur exclusively through
-- public.fn_process_canteen_tap, which is SECURITY DEFINER and performs its
-- own authorisation. v2 granted merchants a direct INSERT policy, which let a
-- compromised POS token write arbitrary amounts with any status it chose.

-- ---------- spp invoices ----------
create policy spp_school_read on public.spp_invoices
  for select to authenticated
  using (school_id = any (select public.auth_school_ids()));

create policy spp_guardian_read on public.spp_invoices
  for select to authenticated
  using (student_id = any (select public.auth_ward_ids()));

-- ---------- vault ----------
create policy vault_guardian_read on public.student_vault
  for select to authenticated
  using (student_id = any (select public.auth_ward_ids()));

create policy vault_guardian_update on public.student_vault
  for update to authenticated
  using (student_id = any (select public.auth_ward_ids()))
  with check (student_id = any (select public.auth_ward_ids()));

revoke update on public.student_vault from authenticated;
grant  update (savings_goal_name, savings_goal_target) on public.student_vault to authenticated;

create policy vault_wd_guardian_read on public.vault_withdrawal_requests
  for select to authenticated
  using (student_id = any (select public.auth_ward_ids()));

create policy advances_guardian_read on public.student_advances
  for select to authenticated
  using (student_id = any (select public.auth_ward_ids()));

create policy advances_school_read on public.student_advances
  for select to authenticated
  using (school_id = any (select public.auth_school_ids()));

-- ---------- ledger ----------
-- No policy grants authenticated any access to ledger tables. Balances reach
-- clients only through valo_reporting views and RPCs. This is intentional:
-- raw journal lines expose counterparty accounts across tenants.
create policy ledger_accounts_platform on public.ledger_accounts
  for select to authenticated using ((select public.is_platform_admin()));

create policy ledger_txn_platform on public.ledger_transactions
  for select to authenticated using ((select public.is_platform_admin()));

create policy ledger_entries_platform on public.ledger_entries
  for select to authenticated using ((select public.is_platform_admin()));

-- ---------- offline queue ----------
create policy osq_merchant_rw on public.offline_sync_queue
  for select to authenticated
  using (merchant_id = any (select public.auth_merchant_ids()));

-- ---------- compliance ----------
create policy cle_guardian_read on public.card_lifecycle_events
  for select to authenticated
  using (student_id = any (select public.auth_ward_ids()));

create policy cle_school_read on public.card_lifecycle_events
  for select to authenticated
  using (school_id = any (select public.auth_school_ids()));

create policy consent_parent_read on public.parental_consent
  for select to authenticated
  using (parent_id = (select public.auth_parent_id()));

create policy consent_school_read on public.parental_consent
  for select to authenticated
  using (school_id = any (select public.auth_school_ids()));

create policy audit_platform_read on public.audit_log
  for select to authenticated
  using ((select public.is_platform_admin()));

create policy audit_school_read on public.audit_log
  for select to authenticated
  using (school_id = any (select public.auth_school_ids())
         and (select public.auth_has_role('school_admin')));

create policy ai_logs_self_read on public.ai_chat_logs
  for select to authenticated
  using (actor_user_id = (select auth.uid()) or (select public.is_platform_admin()));

-- Idempotency records are server-side infrastructure. No client policy.

-- =====================================================================
-- SECTION 17. PRIVILEGED ROUTINES
-- =====================================================================
-- Sign convention: signed_amount and ledger_accounts.balance are DEBIT
-- positive, CREDIT negative. A credit-normal account such as
-- merchant_payable therefore carries a negative balance, meaning the
-- platform owes that amount. valo_reporting.v_ledger_balances presents the
-- natural-sign figure for humans.
-- =====================================================================

create or replace function valo_private.jwt_role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', 'anon');
$$;

create or replace function valo_private.fn_ensure_account(
  p_type      public.ledger_account_t,
  p_school    uuid default null,
  p_parent    uuid default null,
  p_student   uuid default null,
  p_merchant  uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public, valo_private, pg_temp
as $$
declare
  v_id uuid;
  v_normal public.ledger_normal_balance_t;
begin
  select id into v_id
    from public.ledger_accounts
   where account_type = p_type
     and owner_school_id   is not distinct from p_school
     and owner_parent_id   is not distinct from p_parent
     and owner_student_id  is not distinct from p_student
     and owner_merchant_id is not distinct from p_merchant;

  if v_id is not null then return v_id; end if;

  v_normal := case p_type
    when 'student_pagu'    then 'DEBIT'
    when 'student_advance' then 'DEBIT'
    when 'platform_clearing' then 'DEBIT'
    else 'CREDIT'
  end::public.ledger_normal_balance_t;

  insert into public.ledger_accounts
    (account_type, normal_balance, owner_school_id, owner_parent_id, owner_student_id, owner_merchant_id)
  values
    (p_type, v_normal, p_school, p_parent, p_student, p_merchant)
  returning id into v_id;

  return v_id;
end;
$$;

-- Posts one balanced journal. Locks each touched account in a deterministic
-- order to make deadlocks between concurrent postings impossible.
create or replace function valo_private.fn_post_journal(
  p_source       public.ledger_source_t,
  p_source_table text,
  p_source_id    uuid,
  p_school_id    uuid,
  p_business_date date,
  p_lines        jsonb,          -- [{"account_id": uuid, "signed_amount": numeric}, ...]
  p_description  text default null,
  p_posted_by    uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public, valo_private, pg_temp
as $$
declare
  v_txn_id uuid;
  v_line   record;
  v_seq    bigint;
  v_bal    public.ledger_amt;
  v_total  public.ledger_amt := 0;
begin
  select coalesce(sum((l ->> 'signed_amount')::numeric), 0)
    into v_total
    from jsonb_array_elements(p_lines) l;

  if v_total <> 0 then
    raise exception 'LEDGER_UNBALANCED: supplied lines sum to %', v_total using errcode = '23514';
  end if;

  insert into public.ledger_transactions
    (source, source_table, source_id, school_id, business_date, description, posted_by)
  values
    (p_source, p_source_table, p_source_id, p_school_id, p_business_date, p_description, p_posted_by)
  returning id into v_txn_id;

  for v_line in
    select (l ->> 'account_id')::uuid as account_id,
           (l ->> 'signed_amount')::numeric as signed_amount
      from jsonb_array_elements(p_lines) l
     order by 1                      -- deterministic lock order
  loop
    update public.ledger_accounts
       set last_entry_seq = last_entry_seq + 1,
           balance        = balance + v_line.signed_amount,
           updated_at     = now()
     where id = v_line.account_id
    returning last_entry_seq, balance into v_seq, v_bal;

    if not found then
      raise exception 'LEDGER_ACCOUNT_NOT_FOUND: %', v_line.account_id using errcode = '23503';
    end if;

    insert into public.ledger_entries
      (transaction_id, account_id, signed_amount, entry_seq, balance_after)
    values
      (v_txn_id, v_line.account_id, v_line.signed_amount, v_seq, v_bal);
  end loop;

  return v_txn_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 17.1 THE NFC TAP.  Single round trip, single transaction.
-- ---------------------------------------------------------------------
-- v2 executed this flow as eight sequential PostgREST calls from the API
-- route. PostgREST cannot issue SELECT ... FOR UPDATE, so the pessimistic
-- lock the specification claims in section 7.2 was never actually taken:
-- two simultaneous taps could both read the same daily_limit_used and both
-- succeed. The idempotency check and the student update also sat in separate
-- transactions, so a crash between them left the key marked PROCESSING with
-- the pagu already consumed and no transaction row written.
-- ---------------------------------------------------------------------

-- Re-create fungsi public.fn_process_canteen_tap dengan perbaikan perbandingan ANY
create or replace function public.fn_process_canteen_tap(
  p_idempotency_key uuid,
  p_card_uid_hash   bytea,
  p_merchant_id     uuid,
  p_amount          numeric,
  p_items           jsonb default '[]'::jsonb,
  p_client_local_tx_uuid uuid default null,
  p_channel         public.txn_channel_t default 'ONLINE_TAP',
  p_occurred_at     timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = public, valo_private, pg_temp
as $$
declare
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
begin
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 0) then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;

  v_fingerprint := encode(digest(
    p_card_uid_hash::text || '|' || p_merchant_id::text || '|' || p_amount::text, 'sha256'), 'hex');

  -- 1. Idempotency
  insert into public.idempotency_keys
    (key, endpoint, actor_user_id, request_fingerprint, status)
  values
    (p_idempotency_key, 'fn_process_canteen_tap', v_caller, v_fingerprint, 'PROCESSING')
  on conflict (endpoint, key) do nothing;

  if not found then
    select * into v_idem
      from public.idempotency_keys
     where endpoint = 'fn_process_canteen_tap' and key = p_idempotency_key
     for update;

    if v_idem.request_fingerprint <> v_fingerprint then
      return jsonb_build_object('error','IDEMPOTENCY_KEY_REUSE','http_status',422);
    elsif v_idem.status = 'COMPLETED' then
      return v_idem.response_snapshot || jsonb_build_object('replayed', true);
    else
      return jsonb_build_object('error','REQUEST_IN_PROGRESS','http_status',409);
    end if;
  end if;

  -- 2. Authorisation
  select * into v_merchant from public.merchants where id = p_merchant_id and deleted_at is null;
  if not found or v_merchant.status <> 'active' then
    return jsonb_build_object('error','MERCHANT_INACTIVE','http_status',403);
  end if;

  if v_role <> 'service_role' then
    -- PERBAIKAN UTAMA: Menggunakan = ANY (...) dengan klausa NOT
    if v_caller is null or p_merchant_id <> all (public.auth_merchant_ids()) then
      raise exception 'RLS_FORBIDDEN' using errcode = '42501';
    end if;
  end if;

  -- 3. Card resolution
  select * into v_card
    from public.student_cards
   where school_id = v_merchant.school_id
     and uid_hash  = p_card_uid_hash;

  if not found then
    return jsonb_build_object('error','STUDENT_NOT_FOUND','http_status',404);
  end if;

  if v_card.status <> 'active' then
    insert into public.canteen_transactions
      (id, school_id, student_id, merchant_id, card_id, amount, status, channel,
       idempotency_key, client_local_tx_uuid, items, rejection_reason, created_at)
    values
      (v_txn_id, v_merchant.school_id, v_card.student_id, p_merchant_id, v_card.id, p_amount,
       'REJECTED_CARD_BLOCKED', p_channel, p_idempotency_key, p_client_local_tx_uuid, p_items,
       'card_status=' || v_card.status, p_occurred_at);

    v_result := jsonb_build_object('error','CARD_BLOCKED','transaction_id',v_txn_id,'http_status',423);
    update public.idempotency_keys
       set status='COMPLETED', response_snapshot=v_result, response_status=423, completed_at=now()
     where endpoint='fn_process_canteen_tap' and key=p_idempotency_key;
    return v_result;
  end if;

  -- 4. Student & counter
  select * into v_student from public.students where id = v_card.student_id;
  if v_student.status <> 'active' then
    return jsonb_build_object('error','STUDENT_INACTIVE','http_status',423);
  end if;

  v_bdate := (p_occurred_at at time zone 'Asia/Jakarta')::date;

  insert into public.student_daily_counters
    (student_id, business_date, school_id, limit_snapshot)
  values
    (v_student.id, v_bdate, v_student.school_id, v_student.daily_limit)
  on conflict (student_id, business_date)
    do update set updated_at = now()
  returning * into v_ctr;

  -- 5. Pagu rules engine
  v_remaining := greatest(v_ctr.limit_snapshot - v_ctr.spent_amount, 0);

  if p_amount <= v_remaining then
    v_from_pagu := p_amount;
    v_shortfall := 0;
    v_status    := 'SETTLED';
  else
    v_from_pagu := v_remaining;
    v_shortfall := p_amount - v_remaining;

    if v_student.emergency_approve
       and v_shortfall <= v_student.emergency_limit
       and v_ctr.overdraft_count = 0
    then
      v_status := 'SETTLED';
      v_is_emergency := true;
    else
      insert into public.canteen_transactions
        (id, school_id, student_id, merchant_id, card_id, amount, status, channel,
         idempotency_key, client_local_tx_uuid, items, rejection_reason, created_at)
      values
        (v_txn_id, v_merchant.school_id, v_student.id, p_merchant_id, v_card.id, p_amount,
         'REJECTED_OVERLIMIT', p_channel, p_idempotency_key, p_client_local_tx_uuid, p_items,
         case when not v_student.emergency_approve then 'emergency_disabled'
              when v_ctr.overdraft_count > 0       then 'overdraft_rate_limit'
              else 'exceeds_emergency_limit' end,
         p_occurred_at);

      v_result := jsonb_build_object(
        'error','PAGU_EXCEEDED','transaction_id',v_txn_id,
        'sisa_pagu', v_remaining, 'http_status', 402);

      update public.idempotency_keys
         set status='COMPLETED', response_snapshot=v_result, response_status=402, completed_at=now()
       where endpoint='fn_process_canteen_tap' and key=p_idempotency_key;
      return v_result;
    end if;
  end if;

  -- 6. Persist transaction
  insert into public.canteen_transactions
    (id, school_id, student_id, merchant_id, card_id, amount, status, channel,
     is_emergency, emergency_amount, idempotency_key, client_local_tx_uuid, items,
     created_at)
  values
    (v_txn_id, v_merchant.school_id, v_student.id, p_merchant_id, v_card.id, p_amount,
     v_status, p_channel, v_is_emergency, v_shortfall, p_idempotency_key,
     p_client_local_tx_uuid, p_items, p_occurred_at);

  update public.student_daily_counters
     set spent_amount     = spent_amount + v_from_pagu,
         overdraft_amount = overdraft_amount + v_shortfall,
         overdraft_count  = overdraft_count + (case when v_is_emergency then 1 else 0 end),
         txn_count        = txn_count + 1,
         updated_at       = now()
   where student_id = v_student.id and business_date = v_bdate;

  -- 7. Double-entry posting
  v_acct_pagu  := valo_private.fn_ensure_account('student_pagu',     null, null, v_student.id, null);
  v_acct_merch := valo_private.fn_ensure_account('merchant_payable', null, null, null, p_merchant_id);

  v_lines := jsonb_build_array(
    jsonb_build_object('account_id', v_acct_merch, 'signed_amount', -p_amount)
  );

  if v_from_pagu > 0 then
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_id', v_acct_pagu, 'signed_amount', v_from_pagu));
  end if;

  if v_shortfall > 0 then
    v_acct_adv := valo_private.fn_ensure_account('student_advance', null, null, v_student.id, null);
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_id', v_acct_adv, 'signed_amount', v_shortfall));

    insert into public.student_advances
      (student_id, school_id, origin_txn_id, principal_amount, outstanding_amount, incurred_on)
    values
      (v_student.id, v_student.school_id, v_txn_id, v_shortfall, v_shortfall, v_bdate);
  end if;

  v_ledger_id := valo_private.fn_post_journal(
    'CANTEEN_TAP', 'canteen_transactions', v_txn_id,
    v_merchant.school_id, v_bdate, v_lines,
    'Canteen tap', v_caller);

  update public.canteen_transactions
     set ledger_transaction_id = v_ledger_id
   where id = v_txn_id and created_at = p_occurred_at;

  -- 8. Anomaly flag
  if v_is_emergency then
    if (select count(*) from public.student_daily_counters
         where student_id = v_student.id
           and business_date > v_bdate - 7
           and overdraft_count > 0) > 2
    then
      insert into public.audit_log
        (school_id, actor_user_id, action, entity_type, entity_id, flag, metadata)
      values
        (v_student.school_id, v_caller, 'OVERDRAFT_ANOMALY', 'students', v_student.id,
         'FREQUENT_OVERDRAFT',
         jsonb_build_object('transaction_id', v_txn_id, 'merchant_id', p_merchant_id));
    end if;
  end if;

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

  update public.idempotency_keys
     set status='COMPLETED', response_snapshot=v_result, response_status=200, completed_at=now()
   where endpoint='fn_process_canteen_tap' and key=p_idempotency_key;

  return v_result;
end;
$$;

revoke execute on function public.fn_process_canteen_tap(uuid,bytea,uuid,numeric,jsonb,uuid,public.txn_channel_t,timestamptz) from public, anon;
grant   execute on function public.fn_process_canteen_tap(uuid,bytea,uuid,numeric,jsonb,uuid,public.txn_channel_t,timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 17.2 VAULT ROLL-OVER.  Idempotent by construction.
-- ---------------------------------------------------------------------

create or replace function valo_private.sp_rollover_daily_vault(
  p_business_date date default ((now() at time zone 'Asia/Jakarta')::date)
) returns integer
language plpgsql
security definer
set search_path = public, valo_private, pg_temp
as $$
declare
  r        record;
  v_acct_v uuid;
  v_acct_p uuid;
  v_count  integer := 0;
  v_unused numeric;
begin
  for r in
    select c.student_id, c.school_id, c.limit_snapshot, c.spent_amount, g.parent_id
      from public.student_daily_counters c
      join public.students s on s.id = c.student_id
      left join lateral (
        select gm.parent_id from public.guardian_student_map gm
         where gm.student_id = c.student_id and gm.status = 'active' and gm.can_fund
         order by gm.is_primary_guardian desc limit 1
      ) g on true
     where c.business_date = p_business_date
       and c.rolled_over_at is null          -- the idempotency guard
       and s.status = 'active'
     for update of c skip locked
  loop
    v_unused := greatest(r.limit_snapshot - r.spent_amount, 0);

    if v_unused > 0 and r.parent_id is not null then
      v_acct_v := valo_private.fn_ensure_account('student_vault',  null, null, r.student_id, null);
      v_acct_p := valo_private.fn_ensure_account('parent_funding', null, r.parent_id, null, null);

      perform valo_private.fn_post_journal(
        'VAULT_ROLLOVER', 'student_daily_counters', r.student_id,
        r.school_id, p_business_date,
        jsonb_build_array(
          jsonb_build_object('account_id', v_acct_p, 'signed_amount',  v_unused),
          jsonb_build_object('account_id', v_acct_v, 'signed_amount', -v_unused)
        ),
        format('Vault rollover %s', p_business_date));
    end if;

    update public.student_daily_counters
       set rolled_over_at = now(), rolled_over_amount = v_unused
     where student_id = r.student_id and business_date = p_business_date;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function valo_private.sp_rollover_daily_vault(date) is
  'Idempotent through rolled_over_at IS NULL rather than through a date-equality '
  'predicate. Re-running it is a no-op, and a missed night is recoverable by '
  'passing the past business date explicitly, neither of which v2 supported.';

-- ---------------------------------------------------------------------
-- 17.3 Weekly overdraft anomaly sweep
-- ---------------------------------------------------------------------

create or replace function valo_private.sp_flag_frequent_overdraft(
  p_window_days integer default 7
) returns integer
language plpgsql
security definer
set search_path = public, valo_private, pg_temp
as $$
declare v_n integer;
begin
  with agg as (
    select c.student_id, c.school_id, sum(c.overdraft_count) as n
      from public.student_daily_counters c
     where c.business_date > ((now() at time zone 'Asia/Jakarta')::date - p_window_days)
       and c.overdraft_count > 0
     group by 1, 2
    having sum(c.overdraft_count) > 2
  )
  insert into public.audit_log (school_id, action, entity_type, entity_id, flag, metadata)
  select agg.school_id, 'OVERDRAFT_WEEKLY_REVIEW', 'students', agg.student_id,
         'FREQUENT_OVERDRAFT',
         jsonb_build_object('window_days', p_window_days, 'overdraft_count', agg.n)
    from agg;

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------
-- 17.4 Idempotency reaper and partition maintenance
-- ---------------------------------------------------------------------

create or replace function valo_private.sp_cleanup_idempotency()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_n integer;
begin
  delete from public.idempotency_keys
   where expires_at < now() and status <> 'PROCESSING';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- =====================================================================
-- SECTION 18. SCHEDULED JOBS (pg_cron)
--   All expressions are UTC. WIB is UTC+7.
-- =====================================================================

select cron.schedule('valo_vault_rollover',   '59 16 * * *', $cron$select valo_private.sp_rollover_daily_vault();$cron$);
select cron.schedule('valo_overdraft_sweep',  '0 0 * * 1',   $cron$select valo_private.sp_flag_frequent_overdraft(7);$cron$);
select cron.schedule('valo_idem_cleanup',     '0 2 * * *',   $cron$select valo_private.sp_cleanup_idempotency();$cron$);
select cron.schedule('valo_partitions',       '0 3 25 * *',  $cron$
  select valo_private.fn_ensure_month_partitions('public.canteen_transactions'::regclass, 3);
  select valo_private.fn_ensure_month_partitions('public.audit_log'::regclass, 3);
  select valo_private.fn_ensure_month_partitions('public.ai_chat_logs'::regclass, 3);
$cron$);

-- Safety net: catch any business date left unrolled by a missed run.
select cron.schedule('valo_vault_backfill', '30 18 * * *', $cron$
  select valo_private.sp_rollover_daily_vault(d::date)
    from generate_series(
      ((now() at time zone 'Asia/Jakarta')::date - 3),
      ((now() at time zone 'Asia/Jakarta')::date - 1),
      interval '1 day') d;
$cron$);

-- =====================================================================
-- SECTION 19. REPORTING VIEWS
--   security_invoker so the caller's RLS applies to the underlying tables.
-- =====================================================================

create or replace view valo_reporting.v_student_pagu_status
with (security_invoker = true) as
select s.id                as student_id,
       s.school_id,
       s.full_name,
       s.daily_limit,
       coalesce(c.spent_amount, 0)     as spent_today,
       greatest(s.daily_limit - coalesce(c.spent_amount, 0), 0) as sisa_pagu,
       coalesce(c.overdraft_count, 0)  as overdraft_today,
       s.emergency_approve,
       s.emergency_limit
  from public.students s
  left join public.student_daily_counters c
    on c.student_id = s.id
   and c.business_date = (now() at time zone 'Asia/Jakarta')::date;

create or replace view valo_reporting.v_merchant_daily_sales
with (security_invoker = true) as
select t.merchant_id,
       t.school_id,
       t.business_date,
       count(*)                                   as txn_count,
       sum(t.amount)                              as gross_amount,
       sum(t.amount) filter (where t.is_emergency) as emergency_amount,
       count(*) filter (where t.status = 'REJECTED_OVERLIMIT') as rejected_count
  from public.canteen_transactions t
 where t.status = 'SETTLED'
 group by 1, 2, 3;

create or replace view valo_reporting.v_ledger_balances
with (security_invoker = true) as
select a.id as account_id,
       a.account_type,
       a.normal_balance,
       a.owner_school_id, a.owner_parent_id, a.owner_student_id, a.owner_merchant_id,
       case when a.normal_balance = 'DEBIT' then a.balance else -a.balance end as natural_balance,
       a.last_entry_seq,
       a.updated_at
  from public.ledger_accounts a;

grant usage on schema valo_reporting to authenticated;
grant select on all tables in schema valo_reporting to authenticated;

-- =====================================================================
-- SECTION 20. INTEGRITY ASSERTIONS FOR CI
--   Run in staging after every migration. Any non-zero result is a defect.
-- =====================================================================

create or replace function valo_private.fn_integrity_check()
returns table (check_name text, violations bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select 'ledger_journals_unbalanced',
         count(*) from (
           select transaction_id from public.ledger_entries
            group by 1 having sum(signed_amount) <> 0) x
  union all
  select 'ledger_balance_drift',
         count(*) from (
           select e.account_id
             from public.ledger_entries e
             join public.ledger_accounts a on a.id = e.account_id
            group by e.account_id, a.balance
           having sum(e.signed_amount) <> a.balance) y
  union all
  select 'counters_vs_transactions_drift',
         count(*) from (
           select c.student_id, c.business_date
             from public.student_daily_counters c
             left join public.canteen_transactions t
               on t.student_id = c.student_id
              and t.business_date = c.business_date
              and t.status = 'SETTLED'
            group by c.student_id, c.business_date, c.spent_amount, c.overdraft_amount
           having coalesce(sum(t.amount - t.emergency_amount), 0) <> c.spent_amount) z
  union all
  select 'students_multiple_primary_guardians',
         count(*) from (
           select student_id from public.guardian_student_map
            where is_primary_guardian and status = 'active'
            group by 1 having count(*) > 1) w
  union all
  select 'cross_tenant_transactions',
         count(*) from public.canteen_transactions t
           join public.students  s on s.id = t.student_id
           join public.merchants m on m.id = t.merchant_id
          where s.school_id <> m.school_id
  union all
  select 'default_partition_not_empty',
         (select count(*) from public.canteen_transactions_default);
$$;

commit;

-- =====================================================================
-- SECTION 21. MIGRATION FROM v2 (execute after review, not blindly)
-- =====================================================================
-- 1. profiles.role/school_id/merchant_id  ->  user_roles
--    insert into public.user_roles (user_id, role, school_id, merchant_id)
--    select id, role::public.user_role_t, school_id, merchant_id from v2.profiles;
--
-- 2. parents.auth_user_id  ->  profiles.parent_id
--    update public.profiles p set parent_id = v.id
--      from v2.parents v where v.auth_user_id = p.id;
--    Reconcile conflicts first: rows where v2.profiles.parent_id already points
--    at a different parent are exactly the drift this refactor removes.
--
-- 3. students.nfc_uid_hash (varchar hex) -> student_cards.uid_hash (bytea)
--    insert into public.student_cards (student_id, school_id, uid_hash, uid_last4, status, activated_at)
--    select id, school_id, decode(nfc_uid_hash, 'hex'), nfc_uid_last4, 'active', created_at
--      from v2.students;
--    Verify every hash is 64 hex characters before decoding.
--
-- 4. students.daily_limit_used -> student_daily_counters for today only.
--    Historical daily usage is unrecoverable from v2 because the column was
--    overwritten in place. This is the cost of the v2 design, and it is the
--    reason the refactor is worth doing now rather than after pilot scale-up.
--
-- 5. wallet_ledger -> ledger_transactions + ledger_entries.
--    v2 rows cannot be paired into balanced journals automatically because no
--    grouping key exists. Load them into a single opening-balance journal per
--    account with a contra entry against platform_clearing, then freeze.
-- =====================================================================
