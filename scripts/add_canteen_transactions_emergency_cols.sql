ALTER TABLE public.canteen_transactions ADD COLUMN IF NOT EXISTS emergency_amount NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE public.canteen_transactions ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN DEFAULT FALSE;
