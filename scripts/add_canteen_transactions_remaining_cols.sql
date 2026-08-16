ALTER TABLE public.canteen_transactions ADD COLUMN IF NOT EXISTS client_local_tx_uuid UUID;
ALTER TABLE public.canteen_transactions ADD COLUMN IF NOT EXISTS idempotency_key UUID;
ALTER TABLE public.canteen_transactions ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.canteen_transactions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.canteen_transactions ADD COLUMN IF NOT EXISTS settlement_status VARCHAR DEFAULT 'UNSETTLED';
ALTER TABLE public.canteen_transactions ADD COLUMN IF NOT EXISTS ledger_transaction_id UUID;
