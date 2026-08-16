-- =============================================================
-- Migration: 20260816_parent_wallet.sql
-- Description: Parent Wallet Balance, BNI Account Details & Instant Top-Up System
-- Compatible with Supabase RLS & Schema Reload
-- =============================================================

-- 1. Add wallet balance & BNI Account columns to public.parents
ALTER TABLE public.parents 
  ADD COLUMN IF NOT EXISTS wallet_balance numeric NOT NULL DEFAULT 1500000 CHECK (wallet_balance >= 0),
  ADD COLUMN IF NOT EXISTS bni_account_number text DEFAULT '0987654321',
  ADD COLUMN IF NOT EXISTS bni_account_name text DEFAULT 'Wali Siswa';

-- Backfill default values for existing parent records if any nulls
UPDATE public.parents
SET 
  wallet_balance = COALESCE(wallet_balance, 1500000),
  bni_account_number = COALESCE(bni_account_number, '0987654321'),
  bni_account_name = COALESCE(bni_account_name, 'Wali Siswa')
WHERE wallet_balance IS NULL OR bni_account_number IS NULL OR bni_account_name IS NULL;

-- 2. Create Parent Wallet Transactions table
CREATE TABLE IF NOT EXISTS public.parent_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'TOPUP', 'SPP_PAYMENT', 'VAULT_TRANSFER', 'CANTEEN_DEDUCTION'
  amount numeric NOT NULL CHECK (amount > 0),
  description text NOT NULL,
  payment_channel text DEFAULT 'BNI_VA_INSTANT', -- 'BNI_VA_INSTANT', 'BNI_MOBILE'
  bni_reference text,
  status text NOT NULL DEFAULT 'SUCCESS',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast user transaction history retrieval
CREATE INDEX IF NOT EXISTS idx_parent_wallet_tx_parent_id 
  ON public.parent_wallet_transactions(parent_id, created_at DESC);

-- 3. Row Level Security Policies
ALTER TABLE public.parent_wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parents_manage_wallet_tx" ON public.parent_wallet_transactions;
CREATE POLICY "parents_manage_wallet_tx" ON public.parent_wallet_transactions
  FOR ALL TO authenticated
  USING (parent_id IN (SELECT id FROM public.parents WHERE auth_user_id = auth.uid() OR id = auth.uid()))
  WITH CHECK (parent_id IN (SELECT id FROM public.parents WHERE auth_user_id = auth.uid() OR id = auth.uid()));

-- 4. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
