import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ParentRegisterSchema = z.object({
  full_name: z.string().min(2, "Nama lengkap wajib diisi"),
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  phone_number: z.string().min(8, "Nomor HP tidak valid"),
  bni_account_number: z.string().optional(),
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
  const parsed = ParentRegisterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { full_name, email, password, phone_number, bni_account_number } = parsed.data;
  const normPhone = normalizePhone(phone_number);

  // 1. Create auth user using Supabase Admin Auth API
  const { data: authUser, error: authError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role: "parent" },
    app_metadata: { roles: ["parent"] },
  });

  if (authError || !authUser?.user) {
    return NextResponse.json(
      { error: "AUTH_REGISTRATION_FAILED", message: authError?.message || "Gagal membuat akun registrasi." },
      { status: 400 },
    );
  }

  const userId = authUser.user.id;

  // 2. Create or reuse parent record in public.parents
  let parentId: string;
  const { data: existingParent } = await service
    .from("parents")
    .select("id")
    .eq("phone_number", normPhone)
    .maybeSingle();

  if (existingParent) {
    parentId = existingParent.id;
    await service.from("parents").update({
      full_name,
      email,
      bni_account_number: bni_account_number || null,
      bni_link_status: bni_account_number ? "LINKED" : "UNLINKED",
    }).eq("id", parentId);
  } else {
    const { data: newParent, error: parentErr } = await service
      .from("parents")
      .insert({
        full_name,
        phone_number: normPhone,
        email,
        bni_account_number: bni_account_number || null,
        bni_link_status: bni_account_number ? "LINKED" : "UNLINKED",
      })
      .select("id")
      .single();

    if (parentErr || !newParent) {
      return NextResponse.json(
        { error: "PARENT_PROVISIONING_FAILED", message: parentErr?.message || "Gagal membuat data wali." },
        { status: 500 },
      );
    }
    parentId = newParent.id;
  }

  // 3. Upsert into public.profiles
  await service.from("profiles").upsert({
    id: userId,
    display_name: full_name,
    role: "parent",
    parent_id: parentId,
    locale: "id",
    is_active: true,
  });

  // 4. Provision role in public.user_roles
  await service.from("user_roles").upsert({
    user_id: userId,
    role: "parent",
  });

  return NextResponse.json({
    success: true,
    user_id: userId,
    parent_id: parentId,
    message: "Registrasi akun Orang Tua / Wali berhasil! Silakan login.",
  });
}
