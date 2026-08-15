-- migrations/20260815_0001_ai_assistant_prereq.sql
-- Prasyarat Fase 0 untuk layanan valo-ai-copilot.
-- Idempoten. Aman dijalankan ulang.

BEGIN;

-- -----------------------------------------------------------------
-- 2.2.1 Dimensi kelas pada students (B-05)
-- -----------------------------------------------------------------
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS grade_level smallint CHECK (grade_level BETWEEN 1 AND 13),
  ADD COLUMN IF NOT EXISTS class_name  varchar(16);

CREATE INDEX IF NOT EXISTS idx_students_school_class
  ON public.students (school_id, grade_level, class_name);

COMMENT ON COLUMN public.students.grade_level IS
  'Tingkat kelas numerik. 1-6 SD, 7-9 SMP, 10-12 SMA, 13 cadangan program lanjutan.';

-- -----------------------------------------------------------------
-- 2.2.2 Katalog menu merchant (B-02)
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.menu_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name        varchar(120) NOT NULL,
  category    varchar(32)  NOT NULL CHECK (category IN (
                'makanan_berat','makanan_ringan','gorengan',
                'minuman_manis','minuman_sehat','buah','lainnya')),
  unit_price  numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  unit_cost   numeric(12,2)          CHECK (unit_cost >= 0),
  stock_qty   integer       NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  is_active   boolean       NOT NULL DEFAULT true,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_menu_merchant_active
  ON public.menu_items (merchant_id) WHERE is_active;

-- -----------------------------------------------------------------
-- 2.2.3 Line item transaksi kantin (B-01)
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.canteen_transaction_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id      uuid NOT NULL,
  menu_item_id        uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  item_name_snapshot  varchar(120)  NOT NULL,
  category_snapshot   varchar(32)   NOT NULL,
  qty                 integer       NOT NULL CHECK (qty > 0),
  unit_price_snapshot numeric(12,2) NOT NULL CHECK (unit_price_snapshot >= 0),
  unit_cost_snapshot  numeric(12,2),
  line_total          numeric(12,2) NOT NULL CHECK (line_total >= 0),
  created_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cti_transaction ON public.canteen_transaction_items (transaction_id);
CREATE INDEX IF NOT EXISTS idx_cti_menu_item   ON public.canteen_transaction_items (menu_item_id);
CREATE INDEX IF NOT EXISTS idx_cti_category    ON public.canteen_transaction_items (category_snapshot, created_at);

-- -----------------------------------------------------------------
-- 2.2.4 Settlement batch (B-03)
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settlement_batches (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id           uuid NOT NULL REFERENCES public.merchants(id),
  business_date         date NOT NULL,
  gross_amount          numeric(14,2) NOT NULL DEFAULT 0,
  platform_fee          numeric(14,2) NOT NULL DEFAULT 0,
  net_amount            numeric(14,2) NOT NULL DEFAULT 0,
  transaction_count     integer       NOT NULL DEFAULT 0,
  status                varchar(16)   NOT NULL DEFAULT 'PENDING'
                          CHECK (status IN ('PENDING','SUBMITTED','CONFIRMED','FAILED')),
  bni_reference         varchar(64),
  failure_reason        varchar(255),
  scheduled_disburse_at timestamptz,
  disbursed_at          timestamptz,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, business_date)
);

CREATE INDEX IF NOT EXISTS idx_sb_merchant_date
  ON public.settlement_batches (merchant_id, business_date DESC);

-- -----------------------------------------------------------------
-- 2.2.5 Snapshot saldo Giro sekolah
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_giro_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  giro_balance  numeric(16,2) NOT NULL,
  source        varchar(16) NOT NULL DEFAULT 'BNI_H2H'
                  CHECK (source IN ('BNI_H2H','MANUAL_ENTRY')),
  fetched_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_giro_school_date
  ON public.school_giro_snapshots (school_id, snapshot_date DESC);

-- -----------------------------------------------------------------
-- 2.2.6 Hardening ai_chat_logs (B-06)
-- -----------------------------------------------------------------
ALTER TABLE public.ai_chat_logs
  ADD COLUMN IF NOT EXISTS actor_profile_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS session_id       uuid,
  ADD COLUMN IF NOT EXISTS model_id         varchar(64),
  ADD COLUMN IF NOT EXISTS input_tokens     integer,
  ADD COLUMN IF NOT EXISTS output_tokens    integer,
  ADD COLUMN IF NOT EXISTS total_tokens     integer,
  ADD COLUMN IF NOT EXISTS tools_invoked    text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS step_count       smallint,
  ADD COLUMN IF NOT EXISTS finish_reason    varchar(32),
  ADD COLUMN IF NOT EXISTS latency_ms       integer,
  ADD COLUMN IF NOT EXISTS error_code       varchar(64),
  ADD COLUMN IF NOT EXISTS scope_snapshot   jsonb;

ALTER TABLE public.ai_chat_logs ALTER COLUMN response DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_logs_actor_time
  ON public.ai_chat_logs (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_persona_time
  ON public.ai_chat_logs (persona_type, created_at DESC);

-- -----------------------------------------------------------------
-- 2.2.7 Rate limit counter AI
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_rate_limit_counters (
  actor_profile_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  window_start     timestamptz NOT NULL,
  request_count    integer     NOT NULL DEFAULT 0,
  token_count      integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (actor_profile_id, window_start)
);

-- -----------------------------------------------------------------
-- 2.2.8 Context helper aliases (Kompatibel dengan Schema v3)
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.valo_current_role()
RETURNS varchar LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role::varchar FROM public.user_roles WHERE user_id = auth.uid() AND revoked_at IS NULL LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_school_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (public.auth_school_ids())[1];
$$;

CREATE OR REPLACE FUNCTION public.current_merchant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (public.auth_merchant_ids())[1];
$$;

CREATE OR REPLACE FUNCTION public.current_parent_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.auth_parent_id();
$$;

COMMIT;