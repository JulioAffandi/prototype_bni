-- ============================================================================
-- VALO Education Ecosystem — Schema v3 Complete Demo Seeder SQL Script
-- Run this in Supabase SQL Editor or via psql / migrations
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Grant service_role permissions on public tables just in case
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

DO $$
DECLARE
  v_school_id UUID := '11111111-1111-4111-a111-111111111111';
  v_merchant_id UUID := '22222222-2222-4222-a222-222222222222';
  v_parent_id UUID := '33333333-3333-4333-a333-333333333333';
  
  v_admin_user_id UUID := 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  v_merchant_user_id UUID := 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
  v_parent_user_id UUID := 'cccccccc-cccc-4ccc-cccc-cccccccccccc';

  v_student_1_id UUID := '44444444-4444-4444-a444-444444444441';
  v_student_2_id UUID := '44444444-4444-4444-a444-444444444442';

  v_ledger_vault_1 UUID := '55555555-5555-4555-a555-555555555551';
  v_ledger_vault_2 UUID := '55555555-5555-4555-a555-555555555552';
  
  v_encrypted_password TEXT;
  v_today DATE := CURRENT_DATE;
  v_period VARCHAR(7) := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
BEGIN
  -- Password hash for 'Demo1234!'
  v_encrypted_password := crypt('Demo1234!', gen_salt('bf', 10));

  -- 1. SCHOOL
  INSERT INTO public.schools (id, name, npsn, bni_giro_account, status)
  VALUES (v_school_id, 'SMA BNI Harapan Bangsa', '12345678', '009876543210', 'active')
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    bni_giro_account = EXCLUDED.bni_giro_account,
    status = EXCLUDED.status;

  -- 2. MERCHANT
  INSERT INTO public.merchants (id, school_id, name, pic_name, bni_merchant_account, status)
  VALUES (v_merchant_id, v_school_id, 'Kantin Bu Nur (Stall #03)', 'Ibu Nur Hasanah', '009876543211', 'active')
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    pic_name = EXCLUDED.pic_name,
    bni_merchant_account = EXCLUDED.bni_merchant_account,
    status = EXCLUDED.status;

  -- 3. PARENT RECORD
  INSERT INTO public.parents (id, full_name, phone_number, email, bni_account_number, bni_link_status)
  VALUES (v_parent_id, 'Hendra Wijaya', '+6281234567890', 'parent.demo@gmail.com', '009876543212', 'LINKED')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    bni_account_number = EXCLUDED.bni_account_number,
    bni_link_status = EXCLUDED.bni_link_status;

  -- 4. AUTH USERS (School Admin, Merchant, Parent)
  -- A. School Admin
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    v_admin_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'admin.demo@sekolah.sch.id', v_encrypted_password, NOW(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'roles', jsonb_build_array('school_admin', 'school_treasurer'), 'school_ids', jsonb_build_array(v_school_id)),
    jsonb_build_object('full_name', 'Bambang Sudirjo, M.Pd', 'role', 'school_admin'),
    NOW(), NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    encrypted_password = EXCLUDED.encrypted_password,
    raw_app_meta_data = EXCLUDED.raw_app_meta_data,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  -- B. Merchant User
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    v_merchant_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'kantin.demo@merchant.valo.id', v_encrypted_password, NOW(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'roles', jsonb_build_array('merchant_staff', 'merchant_owner'), 'merchant_ids', jsonb_build_array(v_merchant_id)),
    jsonb_build_object('full_name', 'Ibu Nur Hasanah', 'role', 'merchant_staff'),
    NOW(), NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    encrypted_password = EXCLUDED.encrypted_password,
    raw_app_meta_data = EXCLUDED.raw_app_meta_data,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  -- C. Parent User
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    v_parent_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'parent.demo@gmail.com', v_encrypted_password, NOW(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'roles', jsonb_build_array('parent'), 'parent_id', v_parent_id),
    jsonb_build_object('full_name', 'Hendra Wijaya', 'role', 'parent'),
    NOW(), NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    encrypted_password = EXCLUDED.encrypted_password,
    raw_app_meta_data = EXCLUDED.raw_app_meta_data,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data;

  -- 5. PROFILES & USER ROLES
  -- School Admin Profile & Roles
  INSERT INTO public.profiles (id, display_name, is_active)
  VALUES (v_admin_user_id, 'Bambang Sudirjo, M.Pd', true)
  ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

  INSERT INTO public.user_roles (user_id, role, school_id)
  VALUES (v_admin_user_id, 'school_admin', v_school_id),
         (v_admin_user_id, 'school_treasurer', v_school_id)
  ON CONFLICT DO NOTHING;

  -- Merchant Profile & Roles
  INSERT INTO public.profiles (id, display_name, is_active)
  VALUES (v_merchant_user_id, 'Ibu Nur Hasanah', true)
  ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

  INSERT INTO public.user_roles (user_id, role, merchant_id)
  VALUES (v_merchant_user_id, 'merchant_staff', v_merchant_id),
         (v_merchant_user_id, 'merchant_owner', v_merchant_id)
  ON CONFLICT DO NOTHING;

  -- Parent Profile & Roles
  INSERT INTO public.profiles (id, display_name, parent_id, is_active)
  VALUES (v_parent_user_id, 'Hendra Wijaya', v_parent_id, true)
  ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, parent_id = EXCLUDED.parent_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_parent_user_id, 'parent')
  ON CONFLICT DO NOTHING;

  -- 6. STUDENTS (Kenzo & Alya)
  INSERT INTO public.students (id, school_id, full_name, student_number, class_label, status, daily_limit, emergency_approve, emergency_limit)
  VALUES (v_student_1_id, v_school_id, 'Kenzo Wijaya', '20261001', '10-A', 'active', 25000, true, 15000),
         (v_student_2_id, v_school_id, 'Alya Wijaya', '20261002', '12-IPA-1', 'active', 30000, false, 0)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    class_label = EXCLUDED.class_label,
    daily_limit = EXCLUDED.daily_limit,
    emergency_approve = EXCLUDED.emergency_approve,
    emergency_limit = EXCLUDED.emergency_limit;

  -- 7. STUDENT CARDS (BYTEA UID Hash)
  INSERT INTO public.student_cards (student_id, school_id, uid_hash, uid_last4, status)
  VALUES (v_student_1_id, v_school_id, decode(encode(digest('NFC_CARD_KENZO_A1B2', 'sha256'), 'hex'), 'hex'), 'A1B2', 'active'),
         (v_student_2_id, v_school_id, decode(encode(digest('NFC_CARD_ALYA_C3D4', 'sha256'), 'hex'), 'hex'), 'C3D4', 'active')
  ON CONFLICT DO NOTHING;

  -- 8. LEDGER ACCOUNTS & STUDENT VAULT
  INSERT INTO public.ledger_accounts (id, account_type, normal_balance, currency_code, owner_student_id, balance, is_active)
  VALUES (v_ledger_vault_1, 'student_vault', 'CREDIT', 'IDR', v_student_1_id, 150000, true),
         (v_ledger_vault_2, 'student_vault', 'CREDIT', 'IDR', v_student_2_id, 85000, true)
  ON CONFLICT (id) DO UPDATE SET balance = EXCLUDED.balance;

  INSERT INTO public.student_vault (student_id, school_id, ledger_account_id, savings_goal_name, savings_goal_target)
  VALUES (v_student_1_id, v_school_id, v_ledger_vault_1, 'Sepatu Futsal Baru', 350000),
         (v_student_2_id, v_school_id, v_ledger_vault_2, 'Buku SBMPTN 2026', 200000)
  ON CONFLICT (student_id) DO UPDATE SET
    savings_goal_name = EXCLUDED.savings_goal_name,
    savings_goal_target = EXCLUDED.savings_goal_target;

  -- 9. GUARDIAN STUDENT MAP
  INSERT INTO public.guardian_student_map (parent_id, student_id, school_id, relationship, is_primary_guardian, status, can_view_activity, can_manage_pagu, can_fund, can_approve_vault, can_report_card_lost)
  VALUES (v_parent_id, v_student_1_id, v_school_id, 'ayah', true, 'active', true, true, true, true, true),
         (v_parent_id, v_student_2_id, v_school_id, 'ayah', true, 'active', true, true, true, true, true)
  ON CONFLICT (parent_id, student_id) DO UPDATE SET status = 'active';

  -- 10. STUDENT DAILY COUNTERS (Today)
  INSERT INTO public.student_daily_counters (student_id, school_id, business_date, limit_snapshot, spent_amount, txn_count)
  VALUES (v_student_1_id, v_school_id, v_today, 25000, 5000, 1),
         (v_student_2_id, v_school_id, v_today, 30000, 12000, 2)
  ON CONFLICT (student_id, business_date) DO UPDATE SET spent_amount = EXCLUDED.spent_amount;

  -- 11. SPP INVOICES
  INSERT INTO public.spp_invoices (school_id, student_id, billed_parent_id, period, period_start, amount, amount_paid, status, due_date, paid_at)
  VALUES (v_school_id, v_student_1_id, v_parent_id, v_period, (v_period || '-01')::DATE, 500000, 500000, 'PAID', (v_period || '-10')::DATE, NOW()),
         (v_school_id, v_student_2_id, v_parent_id, v_period, (v_period || '-01')::DATE, 500000, 500000, 'PAID', (v_period || '-10')::DATE, NOW())
  ON CONFLICT (school_id, student_id, period) DO UPDATE SET status = EXCLUDED.status;

END $$;
