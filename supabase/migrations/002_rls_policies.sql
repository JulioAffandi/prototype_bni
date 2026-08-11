-- =============================================================
-- VALO EDUCATION ECOSYSTEM — RLS POLICIES v2.0
-- Reference: PRODUCT_SPECIFICATION_v2.md §6.3
-- =============================================================

-- =============================================================
-- HELPER FUNCTIONS (SECURITY DEFINER — bypass RLS for 1 self-lookup)
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
-- ENABLE RLS ON ALL TABLES
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

-- =============================================================
-- POLICIES: PROFILES — each user sees only their own row
-- =============================================================
CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_platform_admin());

-- =============================================================
-- POLICIES: SCHOOLS
-- =============================================================
CREATE POLICY "schools_admin_select" ON public.schools
  FOR SELECT USING (id = public.current_school_id() OR public.is_platform_admin());

-- =============================================================
-- POLICIES: STUDENTS — core multi-tenant isolation
-- =============================================================
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

-- Merchant staff can validate UID hash during transaction, not browse all students
CREATE POLICY "students_merchant_select" ON public.students
  FOR SELECT USING (
    public.current_role() = 'merchant_staff'
    AND school_id = (
      SELECT school_id FROM public.merchants WHERE id = public.current_merchant_id()
    )
  );

CREATE POLICY "students_platform_admin_all" ON public.students
  FOR ALL USING (public.is_platform_admin());

-- =============================================================
-- POLICIES: STUDENT_VAULT — parent read/update, school admin read-only
-- =============================================================
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

-- =============================================================
-- POLICIES: CANTEEN_TRANSACTIONS
-- =============================================================
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

-- =============================================================
-- POLICIES: SPP_INVOICES
-- =============================================================
CREATE POLICY "spp_parent_select" ON public.spp_invoices
  FOR SELECT USING (
    student_id IN (
      SELECT student_id FROM public.guardian_student_map
      WHERE parent_id = public.current_parent_id()
    )
  );

CREATE POLICY "spp_school_admin_all" ON public.spp_invoices
  FOR SELECT USING (school_id = public.current_school_id());

-- =============================================================
-- POLICIES: WALLET_LEDGER — NO direct client access
-- Only service_role (backend) & platform_admin read.
-- All financial writes go through service_role in Edge Functions.
-- =============================================================
CREATE POLICY "ledger_platform_admin_only" ON public.wallet_ledger
  FOR SELECT USING (public.is_platform_admin());

-- =============================================================
-- POLICIES: OFFLINE_SYNC_QUEUE — merchant own data
-- =============================================================
CREATE POLICY "osq_merchant_own" ON public.offline_sync_queue
  FOR ALL USING (merchant_id = public.current_merchant_id())
  WITH CHECK (merchant_id = public.current_merchant_id());

-- =============================================================
-- POLICIES: CARD_LIFECYCLE_EVENTS & PARENTAL_CONSENT
-- =============================================================
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

-- =============================================================
-- POLICIES: AUDIT_LOG & AI_CHAT_LOGS
-- =============================================================
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

-- =============================================================
-- POLICIES: GUARDIAN_STUDENT_MAP
-- =============================================================
CREATE POLICY "gsm_parent_select" ON public.guardian_student_map
  FOR SELECT USING (parent_id = public.current_parent_id());

CREATE POLICY "gsm_school_admin_select" ON public.guardian_student_map
  FOR SELECT USING (
    student_id IN (
      SELECT id FROM public.students WHERE school_id = public.current_school_id()
    )
  );

-- =============================================================
-- POLICIES: PARENTS
-- =============================================================
CREATE POLICY "parents_self_select" ON public.parents
  FOR SELECT USING (id = public.current_parent_id() OR public.is_platform_admin());

CREATE POLICY "parents_self_update" ON public.parents
  FOR UPDATE USING (id = public.current_parent_id())
  WITH CHECK (id = public.current_parent_id());

-- =============================================================
-- POLICIES: MERCHANTS
-- =============================================================
CREATE POLICY "merchants_staff_select" ON public.merchants
  FOR SELECT USING (
    id = public.current_merchant_id()
    OR school_id = public.current_school_id()
    OR public.is_platform_admin()
  );

-- =============================================================
-- POLICIES: IDEMPOTENCY_KEYS — service_role only (no client access)
-- =============================================================
-- No policy for authenticated role — only service_role bypasses RLS
-- to read/write idempotency_keys during financial transactions.
