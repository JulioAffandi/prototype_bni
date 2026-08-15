-- =============================================================
-- VALO — MIGRATION v2.1: STUDENT ONBOARDING & CARD LIFECYCLE & PARENT LINKAGE
-- =============================================================

-- 1.1 STUDENTS — Add PPDB fields & partial unique NISN index
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS student_number VARCHAR,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS grade_level VARCHAR,
  ADD COLUMN IF NOT EXISTS class_group VARCHAR;

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_nisn_unique
  ON public.students(student_number)
  WHERE student_number IS NOT NULL;

-- 1.2 STUDENT_CARDS — Ensure status constraints and card uniqueness invariant
ALTER TABLE public.student_cards
  ADD COLUMN IF NOT EXISTS card_uid_hash VARCHAR,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS issued_by_profile_id UUID REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_student_cards_student ON public.student_cards(student_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_cards_one_active
  ON public.student_cards(student_id)
  WHERE status = 'active';

-- 1.3 CARD_LIFECYCLE_EVENTS — Canonicalize event types
ALTER TABLE public.card_lifecycle_events
  ADD COLUMN IF NOT EXISTS card_id UUID REFERENCES public.student_cards(id);

-- 1.4 STUDENT_DAILY_COUNTERS — Daily pagu counter table
CREATE TABLE IF NOT EXISTS public.student_daily_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  counter_date DATE NOT NULL DEFAULT CURRENT_DATE,
  daily_limit NUMERIC(12,2) NOT NULL,
  amount_spent NUMERIC(12,2) NOT NULL DEFAULT 0,
  emergency_used BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, counter_date)
);

-- 1.5 GUARDIAN_STUDENT_MAP — Add linkage state tracking columns
ALTER TABLE public.guardian_student_map
  ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS linked_via VARCHAR NOT NULL DEFAULT 'self_claim',
  ADD COLUMN IF NOT EXISTS linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 1.6 PARENTS — Support pre-binding before signup
ALTER TABLE public.parents
  ADD COLUMN IF NOT EXISTS account_status VARCHAR NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS invited_by_school_id UUID REFERENCES public.schools(id);

-- 1.7 GUARDIAN_CLAIM_ATTEMPTS — Mitigate brute-force NISN+DOB claims
CREATE TABLE IF NOT EXISTS public.guardian_claim_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.parents(id) ON DELETE CASCADE,
  ip_address INET,
  attempted_npsn VARCHAR,
  attempted_nisn VARCHAR,
  success BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claim_attempts_parent_time ON public.guardian_claim_attempts(parent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_claim_attempts_ip_time ON public.guardian_claim_attempts(ip_address, created_at);

-- RLS POLICIES FOR GUARDIAN_CLAIM_ATTEMPTS
ALTER TABLE public.guardian_claim_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS claim_attempts_parent_read ON public.guardian_claim_attempts;
CREATE POLICY claim_attempts_parent_read ON public.guardian_claim_attempts
  FOR SELECT TO authenticated
  USING (parent_id IN (SELECT id FROM public.parents WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS claim_attempts_service_insert ON public.guardian_claim_attempts;
CREATE POLICY claim_attempts_service_insert ON public.guardian_claim_attempts
  FOR INSERT TO service_role
  WITH CHECK (true);
