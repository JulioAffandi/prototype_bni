ALTER TABLE public.student_cards ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id);
ALTER TABLE public.student_cards ADD COLUMN IF NOT EXISTS uid_hash BYTEA;
ALTER TABLE public.student_cards ADD COLUMN IF NOT EXISTS uid_last4 VARCHAR;

UPDATE public.student_cards
   SET uid_hash = decode(regexp_replace(card_uid_hash, '^\\x', ''), 'hex')
 WHERE uid_hash IS NULL AND card_uid_hash IS NOT NULL AND regexp_replace(card_uid_hash, '^\\x', '') ~ '^[0-9a-fA-F]+$';

UPDATE public.student_cards SET uid_last4 = card_uid_last4 WHERE uid_last4 IS NULL AND card_uid_last4 IS NOT NULL;
