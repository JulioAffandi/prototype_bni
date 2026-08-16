-- Migration: 20260816_educonnect_dashboard_rpcs.sql
-- Description: Enums, institution_budgets table, RLS policies, daily cashflow RPC, tuition aging RPC, and demo seed data.

-- 0. Ensure amount_paid column exists on spp_invoices
ALTER TABLE public.spp_invoices ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0;
UPDATE public.spp_invoices SET amount_paid = amount WHERE status = 'PAID' AND (amount_paid IS NULL OR amount_paid = 0);

-- 1. Create budget_unit_t enum
DO $$ 
BEGIN
  CREATE TYPE public.budget_unit_t AS ENUM (
    'ACADEMIC',
    'OPERATIONS',
    'HR_PAYROLL',
    'IT',
    'FACILITIES',
    'STUDENT_ACTIVITIES'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create institution_budgets table
CREATE TABLE IF NOT EXISTS public.institution_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  fiscal_year text NOT NULL, -- e.g. '2024/2025'
  unit public.budget_unit_t NOT NULL,
  budget_amount numeric NOT NULL CHECK (budget_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_budget_school_year_unit UNIQUE (school_id, fiscal_year, unit)
);

-- Enable RLS
ALTER TABLE public.institution_budgets ENABLE ROW LEVEL SECURITY;

-- Policies for institution_budgets
DO $$ BEGIN
  CREATE POLICY "allow_school_budgets_read" ON public.institution_budgets
    FOR SELECT TO authenticated USING (school_id = ANY (public.auth_school_ids()) OR (SELECT public.is_platform_admin()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "allow_school_budgets_write" ON public.institution_budgets
    FOR ALL TO authenticated
    USING (school_id = ANY (public.auth_school_ids()) AND (SELECT public.auth_has_role('school_admin') OR public.auth_has_role('school_treasurer')))
    WITH CHECK (school_id = ANY (public.auth_school_ids()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. fn_school_cashflow_daily RPC
CREATE OR REPLACE FUNCTION public.fn_school_cashflow_daily(
  p_school_id uuid,
  p_from      date,
  p_to        date
) RETURNS TABLE (
  bucket_date date,
  inflow      numeric,
  outflow     numeric,
  net_flow    numeric,
  closing_balance numeric
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  WITH acct AS (
    SELECT id FROM public.ledger_accounts
    WHERE owner_school_id = p_school_id
      AND account_type = 'school_escrow'
      AND is_active
  ),
  daily_flows AS (
    SELECT
      t.business_date,
      COALESCE(SUM(e.signed_amount) FILTER (WHERE e.signed_amount > 0), 0) AS inflow,
      COALESCE(-SUM(e.signed_amount) FILTER (WHERE e.signed_amount < 0), 0) AS outflow,
      COALESCE(SUM(e.signed_amount), 0) AS net_flow
    FROM public.ledger_entries e
    JOIN public.ledger_transactions t ON t.id = e.transaction_id
    WHERE e.account_id IN (SELECT id FROM acct)
      AND t.business_date BETWEEN p_from AND p_to
    GROUP BY t.business_date
  )
  SELECT
    d::date AS bucket_date,
    COALESCE(df.inflow, 0) AS inflow,
    COALESCE(df.outflow, 0) AS outflow,
    COALESCE(df.net_flow, 0) AS net_flow,
    COALESCE(
      (
        SELECT e2.balance_after
        FROM public.ledger_entries e2
        JOIN public.ledger_transactions t2 ON t2.id = e2.transaction_id
        WHERE e2.account_id IN (SELECT id FROM acct)
          AND t2.business_date <= d::date
        ORDER BY t2.business_date DESC, e2.entry_seq DESC
        LIMIT 1
      ),
      (
        SELECT balance 
        FROM public.ledger_accounts 
        WHERE owner_school_id = p_school_id AND account_type = 'school_escrow' AND is_active 
        LIMIT 1
      ),
      0
    ) AS closing_balance
  FROM generate_series(p_from, p_to, interval '1 day') d
  LEFT JOIN daily_flows df ON df.business_date = d::date
  ORDER BY d;
$$;

-- 4. fn_school_tuition_aging RPC
CREATE OR REPLACE FUNCTION public.fn_school_tuition_aging(
  p_school_id uuid,
  p_as_of     date DEFAULT current_date
) RETURNS TABLE (bucket text, amount numeric, invoice_count integer)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT CASE
           WHEN due_date >= p_as_of THEN 'current'
           WHEN p_as_of - due_date BETWEEN 1  AND 30 THEN 'd1_30'
           WHEN p_as_of - due_date BETWEEN 31 AND 60 THEN 'd31_60'
           WHEN p_as_of - due_date BETWEEN 61 AND 90 THEN 'd61_90'
           ELSE 'd90_plus'
         END AS bucket,
         COALESCE(SUM(amount - COALESCE(amount_paid, 0)), 0) AS amount,
         COUNT(*)::int AS invoice_count
  FROM public.spp_invoices
  WHERE school_id = p_school_id
    AND status IN ('UNPAID','FAILED','OVERDUE')
  GROUP BY 1;
$$;

-- 5. Seed Demo Budgets Data
INSERT INTO public.institution_budgets (school_id, fiscal_year, unit, budget_amount)
SELECT id, '2024/2025', u.unit, u.amount
FROM public.schools
CROSS JOIN (
  VALUES 
    ('ACADEMIC'::public.budget_unit_t, 3200000000::numeric),
    ('OPERATIONS'::public.budget_unit_t, 1800000000::numeric),
    ('HR_PAYROLL'::public.budget_unit_t, 2400000000::numeric),
    ('IT'::public.budget_unit_t, 1200000000::numeric),
    ('FACILITIES'::public.budget_unit_t, 1500000000::numeric),
    ('STUDENT_ACTIVITIES'::public.budget_unit_t, 600000000::numeric)
) AS u(unit, amount)
ON CONFLICT (school_id, fiscal_year, unit) 
DO UPDATE SET budget_amount = EXCLUDED.budget_amount, updated_at = now();
