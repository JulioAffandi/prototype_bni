-- Migration: Ensure telegram_chat_id column exists on public.parents table
ALTER TABLE public.parents ADD COLUMN IF NOT EXISTS telegram_chat_id text;
