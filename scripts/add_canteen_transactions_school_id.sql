ALTER TABLE public.canteen_transactions ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id);
