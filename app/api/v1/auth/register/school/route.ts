import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const SchoolRegisterSchema = z.object({
  school_id: z.string().optional(),
  school_name: z.string().optional(),
  npsn: z.string().optional(),
  school_type: z.string().optional().default("SMA"),
  pic_name: z.string().min(2, "Nama PIC Admin wajib diisi"),
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  phone_number: z.string().min(8, "Nomor HP tidak valid"),
  giro_account: z.string().optional(),
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
  const parsed = SchoolRegisterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { school_id, school_name, npsn, pic_name, email, password, phone_number, giro_account } = parsed.data;
  const normPhone = normalizePhone(phone_number);

  // 1. Resolve school_id
  let schoolId: string | null = school_id || null;

  if (!schoolId && npsn?.trim()) {
    const { data: s } = await service
      .from("schools")
      .select("id")
      .eq("npsn", npsn.trim())
      .maybeSingle();
    if (s) schoolId = s.id;
  }

  if (!schoolId && school_name?.trim() && npsn?.trim()) {
    const { data: newSchool, error: schoolErr } = await service
      .from("schools")
      .insert({
        name: school_name.trim(),
        npsn: npsn.trim(),
        bni_giro_account: giro_account?.trim() || "88800001111",
        status: "active",
      })
      .select("id")
      .single();

    if (schoolErr || !newSchool) {
      return NextResponse.json(
        { error: "SCHOOL_PROVISIONING_FAILED", message: schoolErr?.message || "Gagal mendaftarkan data sekolah." },
        { status: 500 },
      );
    }
    schoolId = newSchool.id;
  }

  if (!schoolId) {
    return NextResponse.json(
      { error: "SCHOOL_NOT_FOUND", message: "Sekolah tidak ditemukan. Pilih sekolah terdaftar atau daftarkan entitas sekolah baru." },
      { status: 400 },
    );
  }

  // 2. Create auth user using Supabase Admin Auth API
  const { data: authUser, error: authError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: pic_name, role: "school_admin" },
  });

  if (authError || !authUser?.user) {
    return NextResponse.json(
      { error: "AUTH_REGISTRATION_FAILED", message: authError?.message || "Gagal membuat akun registrasi admin sekolah." },
      { status: 400 },
    );
  }

  const userId = authUser.user.id;

  // Update auth metadata with school_id
  await service.auth.admin.updateUserById(userId, {
    app_metadata: { roles: ["school_admin"], school_ids: [schoolId] },
  });

  // 3. Upsert into public.profiles
  await service.from("profiles").upsert({
    id: userId,
    display_name: pic_name,
    role: "school_admin",
    school_id: schoolId,
    locale: "id",
    is_active: true,
  });

  // 4. Provision role in public.user_roles
  await service.from("user_roles").upsert({
    user_id: userId,
    role: "school_admin",
    school_id: schoolId,
  });

  return NextResponse.json({
    success: true,
    user_id: userId,
    school_id: schoolId,
    message: "Registrasi Sekolah & PIC Admin berhasil! Silakan login.",
  });
}
