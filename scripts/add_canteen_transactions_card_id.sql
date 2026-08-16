ALTER TABLE public.canteen_transactions ADD COLUMN IF NOT EXISTS card_id UUID REFERENCES public.student_cards(id);
