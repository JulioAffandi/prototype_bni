-- Add telegram_chat_id columns for Telegram notification linking
ALTER TABLE public.parents   ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT NULL;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT NULL;
ALTER TABLE public.schools   ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT NULL;

-- Basic format guard at the DB layer (defense in depth on top of app-level validation)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_parents_chat_id_format') THEN
    ALTER TABLE public.parents ADD CONSTRAINT chk_parents_chat_id_format CHECK (telegram_chat_id IS NULL OR telegram_chat_id ~ '^-?\d{5,15}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_merchants_chat_id_format') THEN
    ALTER TABLE public.merchants ADD CONSTRAINT chk_merchants_chat_id_format CHECK (telegram_chat_id IS NULL OR telegram_chat_id ~ '^-?\d{5,15}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_schools_chat_id_format') THEN
    ALTER TABLE public.schools ADD CONSTRAINT chk_schools_chat_id_format CHECK (telegram_chat_id IS NULL OR telegram_chat_id ~ '^-?\d{5,15}$');
  END IF;
END $$;
