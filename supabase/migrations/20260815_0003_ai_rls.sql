-- migrations/20260815_0003_ai_rls.sql
BEGIN;

ALTER TABLE public.menu_items                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canteen_transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_batches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_giro_snapshots     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_rate_limit_counters    ENABLE ROW LEVEL SECURITY;

-- Clean existing policies if re-run
DROP POLICY IF EXISTS "menu_merchant_all" ON public.menu_items;
DROP POLICY IF EXISTS "menu_school_admin_select" ON public.menu_items;
DROP POLICY IF EXISTS "cti_merchant_select" ON public.canteen_transaction_items;
DROP POLICY IF EXISTS "cti_parent_select" ON public.canteen_transaction_items;
DROP POLICY IF EXISTS "cti_school_admin_select" ON public.canteen_transaction_items;
DROP POLICY IF EXISTS "sb_merchant_select" ON public.settlement_batches;
DROP POLICY IF EXISTS "sb_school_admin_select" ON public.settlement_batches;
DROP POLICY IF EXISTS "giro_school_admin_select" ON public.school_giro_snapshots;

CREATE POLICY "menu_merchant_all" ON public.menu_items
  FOR ALL TO authenticated
  USING      (merchant_id = ANY (public.auth_merchant_ids()))
  WITH CHECK (merchant_id = ANY (public.auth_merchant_ids()));

CREATE POLICY "menu_school_admin_select" ON public.menu_items
  FOR SELECT TO authenticated
  USING (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE school_id = ANY (public.auth_school_ids())
    )
  );

CREATE POLICY "cti_merchant_select" ON public.canteen_transaction_items
  FOR SELECT TO authenticated
  USING (
    transaction_id IN (
      SELECT id FROM public.canteen_transactions WHERE merchant_id = ANY (public.auth_merchant_ids())
    )
  );

CREATE POLICY "cti_parent_select" ON public.canteen_transaction_items
  FOR SELECT TO authenticated
  USING (
    transaction_id IN (
      SELECT id FROM public.canteen_transactions WHERE student_id = ANY (public.auth_ward_ids())
    )
  );

CREATE POLICY "cti_school_admin_select" ON public.canteen_transaction_items
  FOR SELECT TO authenticated
  USING (
    transaction_id IN (
      SELECT id FROM public.canteen_transactions WHERE school_id = ANY (public.auth_school_ids())
    )
  );

CREATE POLICY "sb_merchant_select" ON public.settlement_batches
  FOR SELECT TO authenticated
  USING (merchant_id = ANY (public.auth_merchant_ids()));

CREATE POLICY "sb_school_admin_select" ON public.settlement_batches
  FOR SELECT TO authenticated
  USING (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE school_id = ANY (public.auth_school_ids())
    )
  );

CREATE POLICY "giro_school_admin_select" ON public.school_giro_snapshots
  FOR SELECT TO authenticated
  USING (school_id = ANY (public.auth_school_ids()));

COMMIT;