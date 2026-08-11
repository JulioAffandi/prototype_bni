-- =============================================================
-- VALO EDUCATION ECOSYSTEM — CORE SCHEMA v2.0
-- Target: Supabase PostgreSQL 15+
-- Reference: PRODUCT_SPECIFICATION_v2.md §6.2
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
