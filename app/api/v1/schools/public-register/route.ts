import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const PublicSchoolRegisterSchema = z.object({
  name: z.string().min(3, "Nama institusi sekolah wajib diisi (minimal 3 karakter)"),
  npsn: z.string().length(8, "NPSN harus 8 digit angka"),
  bni_giro_account: z.string().min(6, "No. Rekening Giro BNI wajib diisi"),
  address: z.string().optional(),
});

/**
 * POST /api/v1/schools/public-register
 * Public registration of new school entity into public.schools.
 */
export async function POST(request: NextRequest) {
  const service = createServiceClient();
  const body = await request.json() as unknown;
  const parsed = PublicSchoolRegisterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, npsn, bni_giro_account, address } = parsed.data;

  // 1. Check duplicate NPSN
  const { data: existingSchool } = await service
    .from("schools")
    .select("id, name, npsn")
    .eq("npsn", npsn.trim())
    .maybeSingle();

  if (existingSchool) {
    return NextResponse.json(
      {
        error: "SCHOOL_EXISTS",
        message: `Sekolah dengan NPSN ${npsn} sudah terdaftar (${existingSchool.name}). Anda dapat langsung memilih sekolah ini di tab Admin Sekolah.`,
        school_id: existingSchool.id,
      },
      { status: 409 },
    );
  }

  // 2. Insert new school entity
  const { data: newSchool, error: insertError } = await service
    .from("schools")
    .insert({
      name: name.trim(),
      npsn: npsn.trim(),
      bni_giro_account: bni_giro_account.trim(),
      address: address?.trim() || null,
      status: "active",
    })
    .select("id, name, npsn, bni_giro_account, address, created_at")
    .single();

  if (insertError || !newSchool) {
    return NextResponse.json(
      { error: "INSERT_FAILED", message: insertError?.message || "Gagal menyimpan data sekolah ke database." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      success: true,
      school: newSchool,
      message: "Institusi sekolah berhasil didaftarkan! Silakan buat akun Admin Sekolah Anda.",
    },
    { status: 201 },
  );
}
