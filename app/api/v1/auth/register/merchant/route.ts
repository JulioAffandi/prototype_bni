import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const MerchantRegisterSchema = z.object({
  stall_name: z.string().min(3, "Nama stand / kantin wajib diisi"),
  school_id: z.string().min(1, "Sekolah tempat kantin berada wajib dipilih"),
  pic_name: z.string().min(2, "Nama PIC / Kasir wajib diisi"),
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  phone_number: z.string().min(8, "Nomor HP tidak valid"),
  bni_payout_account: z.string().optional(),
});

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "+62" + cleaned.slice(1);
  } else if (cleaned.startsWith("62")) {
    cleaned = "+" + cleaned;
  } else if (!cleaned.startsWith("+")) {
    cleaned = "+62" + cleaned;
  }
  return cleaned;
}

export async function POST(request: NextRequest) {
  const service = createServiceClient();
  const body = await request.json() as unknown;
  const parsed = MerchantRegisterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { stall_name, school_id, pic_name, email, password, phone_number, bni_payout_account } = parsed.data;

  // 1. Create auth user using Supabase Admin Auth API
  const { data: authUser, error: authError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: pic_name, role: "merchant_staff" },
  });

  if (authError || !authUser?.user) {
    return NextResponse.json(
      { error: "AUTH_REGISTRATION_FAILED", message: authError?.message || "Gagal membuat akun registrasi merchant." },
      { status: 400 },
    );
  }

  const userId = authUser.user.id;

  // 2. Create merchant record in public.merchants
  const { data: newMerchant, error: merchantErr } = await service
    .from("merchants")
    .insert({
      school_id,
      name: stall_name.trim(),
      pic_name: pic_name.trim(),
      bni_merchant_account: bni_payout_account?.trim() || "88800002222",
      status: "active",
    })
    .select("id")
    .single();

  if (merchantErr || !newMerchant) {
    return NextResponse.json(
      { error: "MERCHANT_PROVISIONING_FAILED", message: merchantErr?.message || "Gagal mendaftarkan merchant kantin." },
      { status: 500 },
    );
  }

  const merchantId = newMerchant.id;

  // Update auth app_metadata
  await service.auth.admin.updateUserById(userId, {
    app_metadata: { roles: ["merchant_staff"], school_ids: [school_id], merchant_ids: [merchantId] },
  });

  // 3. Upsert into public.profiles
  await service.from("profiles").upsert({
    id: userId,
    display_name: pic_name,
    role: "merchant_staff",
    school_id,
    merchant_id: merchantId,
    locale: "id",
    is_active: true,
  });

  // 4. Provision role in public.user_roles
  await service.from("user_roles").upsert({
    user_id: userId,
    role: "merchant_staff",
    school_id,
    merchant_id: merchantId,
  });

  return NextResponse.json({
    success: true,
    user_id: userId,
    merchant_id: merchantId,
    message: "Registrasi Merchant Kantin & PIC berhasil! Silakan login.",
  });
}
