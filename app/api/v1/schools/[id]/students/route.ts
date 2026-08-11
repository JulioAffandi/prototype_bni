import { createServiceClient } from "@/lib/supabase/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const RegisterStudentSchema = z.object({
  full_name: z.string().min(2),
  raw_nfc_uid: z.string().min(4),
  nfc_uid_last4: z.string().length(4).optional(),
});

/**
 * POST /api/v1/schools/[id]/students
 * Registers a new student and tokenizes their NFC UID.
 * UID tokenization: SHA-256(raw_uid || tenant_salt) per §11.2.
 * Reference: PRODUCT_SPECIFICATION_v2.md §9.2, §11.2
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: schoolId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "school_admin" || profile.school_id !== schoolId) {
    return NextResponse.json({ error: "RLS_FORBIDDEN" }, { status: 403 });
  }

  const body = await request.json() as unknown;
  const parsed = RegisterStudentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { full_name, raw_nfc_uid, nfc_uid_last4 } = parsed.data;

  // ── NFC UID Tokenization (§11.2) ────────────────────────────
  // raw_nfc_uid + per-tenant TENANT_SALT_SECRET → SHA-256 hash
  // The raw UID is never persisted — only the hash.
  const tenantSalt = process.env.TENANT_SALT_SECRET;
  if (!tenantSalt) {
    return NextResponse.json({ error: "SERVER_CONFIG_ERROR" }, { status: 500 });
  }

  const { createHash } = await import("crypto");
  const nfcUidHash = createHash("sha256")
    .update(raw_nfc_uid + tenantSalt + schoolId) // schoolId acts as per-tenant differentiator
    .digest("hex");

  const service = createServiceClient();

  // Check for duplicate UID
  const { data: existing } = await service
    .from("students")
    .select("id")
    .eq("nfc_uid_hash", nfcUidHash)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", message: "UID kartu ini sudah terdaftar untuk siswa lain." },
      { status: 409 },
    );
  }

  // Create student
  const { data: student, error: insertError } = await service
    .from("students")
    .insert({
      full_name,
      school_id: schoolId,
      nfc_uid_hash: nfcUidHash,
      nfc_uid_last4: nfc_uid_last4 ?? raw_nfc_uid.slice(-4),
    })
    .select("id, full_name, card_status, created_at")
    .single();

  if (insertError) {
    return NextResponse.json({ error: "INSERT_FAILED", detail: insertError.message }, { status: 500 });
  }

  // Create vault record
  await service.from("student_vault").insert({
    student_id: student.id,
  });

  // Lifecycle event
  await service.from("card_lifecycle_events").insert({
    student_id: student.id,
    event_type: "issued",
    notes: `Kartu NFC diterbitkan saat pendaftaran oleh sekolah`,
    actor_profile_id: user.id,
  });

  await service.from("audit_log").insert({
    actor_profile_id: user.id,
    action: "STUDENT_REGISTERED",
    entity_type: "students",
    entity_id: student.id,
    metadata: { school_id: schoolId, uid_last4: student.id.slice(-4) },
  });

  return NextResponse.json({ student }, { status: 201 });
}

/**
 * GET /api/v1/schools/[id]/students
 * Lists all students belonging to this school.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: schoolId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "school_admin" || profile.school_id !== schoolId) {
    return NextResponse.json({ error: "RLS_FORBIDDEN" }, { status: 403 });
  }

  const { data: students, error } = await supabase
    .from("students")
    .select("id, full_name, nfc_uid_last4, card_status, daily_limit, created_at")
    .eq("school_id", schoolId)
    .order("full_name");

  if (error) {
    return NextResponse.json({ error: "FETCH_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ students });
}
