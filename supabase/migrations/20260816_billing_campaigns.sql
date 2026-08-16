-- =============================================================
-- Migration: 20260816_billing_campaigns.sql
-- Description: Ad-Hoc Event Billing Campaigns, Invoices, and Parent In-App Notifications
-- Compatible with Supabase RLS & PostgREST Schema Cache Reload
-- =============================================================

-- 1. Campaign / Event Table
CREATE TABLE IF NOT EXISTS public.school_billing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL, -- e.g. "Iuran Peringatan HUT RI ke-81", "Paket Buku Semester Ganjil"
  category text NOT NULL DEFAULT 'KEGIATAN', -- 'KEGIATAN', 'BUKU', 'SERAGAM', 'LAINNYA'
  amount numeric NOT NULL CHECK (amount > 0),
  due_date date NOT NULL,
  target_scope text NOT NULL DEFAULT 'ALL', -- 'ALL', 'GRADE_LEVEL', 'CLASS_GROUP'
  target_filter jsonb DEFAULT '{}', -- e.g. {"grade_level": 9} or {"class_group": "9A"}
  description text,
  is_mandatory boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'CLOSED'
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Campaign Student Invoices Table
CREATE TABLE IF NOT EXISTS public.campaign_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.school_billing_campaigns(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'UNPAID', -- 'UNPAID', 'PAID', 'CANCELLED'
  paid_at timestamptz,
  paid_by_parent_id uuid REFERENCES public.parents(id) ON DELETE SET NULL,
  bni_h2h_reference text,
  receipt_qr_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_campaign_student UNIQUE (campaign_id, student_id)
);

-- 3. In-App Notifications Table
CREATE TABLE IF NOT EXISTS public.portal_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid, -- target auth user
  parent_id uuid REFERENCES public.parents(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'BILLING_ALERT', -- 'BILLING_ALERT', 'PAYMENT_SUCCESS', 'GENERAL'
  action_url text DEFAULT '/spp',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_invoices_student ON public.campaign_invoices(student_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_invoices_campaign ON public.campaign_invoices(campaign_id);
CREATE INDEX IF NOT EXISTS idx_portal_notifs_parent ON public.portal_notifications(parent_id, is_read, created_at DESC);

-- RLS Configuration
ALTER TABLE public.school_billing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_school_manage_campaigns" ON public.school_billing_campaigns;
CREATE POLICY "allow_school_manage_campaigns" ON public.school_billing_campaigns 
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_campaign_invoices" ON public.campaign_invoices;
CREATE POLICY "allow_all_campaign_invoices" ON public.campaign_invoices 
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_parent_notifications" ON public.portal_notifications;
CREATE POLICY "allow_parent_notifications" ON public.portal_notifications 
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
