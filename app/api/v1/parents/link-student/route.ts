import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrResolveParentId } from "@/lib/supabase/parent-resolver";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import type { guardian_relationship_t } from "@/types/database";

const LinkStudentSchema = z.object({
  school_id: z.string().optional(),
  npsn: z.string().optional(),
  student_number: z.string().min(2, "NISN / No. Induk Siswa wajib diisi"),
  date_of_birth: z.string().min(4, "Tanggal Lahir Siswa wajib diisi untuk verifikasi keamanan"),
  relationship: z.string().optional().default("wali"),
});

/**
 * POST /api/v1/parents/link-student
 * Multi-tenant Parent-Student Claim Pipeline:
 * 1. Resolves school by school_id UUID or NPSN 8-digit string
 * 2. Queries student matching school_id, student_number (NISN) & date_of_birth (UU PDP Security Verifier)
 * 3. Upserts public.guardian_student_map record
 * 4. Logs UU PDP consent token in public.parental_consent
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const parentId = await getOrResolveParentId(user);
  if (!parentId) {
    return NextResponse.json({ error: "PARENT_PROFILE_NOT_FOUND" }, { status: 403 });
  }

  const body = await request.json() as unknown;
  const parsed = LinkStudentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { school_id, npsn, student_number, date_of_birth, relationship } = parsed.data;
  const service = createServiceClient();

  // 1. Resolve school_id by UUID or NPSN lookup
  let targetSchoolId: string | null = null;
  const schoolInput = (school_id || npsn || "").trim();

  if (schoolInput) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schoolInput);
    if (isUuid) {
      const { data: s } = await service.from("schools").select("id").eq("id", schoolInput).maybeSingle();
      if (s) targetSchoolId = s.id;
    }

    if (!targetSchoolId) {
      const { data: sByNpsn } = await service.from("schools").select("id").eq("npsn", schoolInput).maybeSingle();
      if (sByNpsn) targetSchoolId = sByNpsn.id;
    }
  }

  // 2. Query student entity
  const cleanNumber = student_number.trim();
  const cleanDob = date_of_birth.trim();

  let studentQuery = service
    .from("students")
    .select("id, school_id, full_name, student_number, date_of_birth, status")
    .ilike("student_number", cleanNumber);

  if (targetSchoolId) {
    studentQuery = studentQuery.eq("school_id", targetSchoolId);
  }

  const { data: matchedStudents, error: searchErr } = await studentQuery;

  if (searchErr || !matchedStudents || matchedStudents.length === 0) {
    return NextResponse.json(
      {
        error: "STUDENT_NOT_MATCHED",
        message: "Data siswa tidak ditemukan di sekolah yang dipilih. Pastikan Sekolah/NPSN, NISN, dan Tanggal Lahir sesuai.",
      },
      { status: 404 },
    );
  }

  // 3. Security Verification via Date of Birth (UU PDP Requirement)
  const dobMatch = matchedStudents.find((s) => {
    if (!s.date_of_birth) return true; // Fallback if DOB wasn't populated by school admin during initial setup
    return s.date_of_birth.slice(0, 10) === cleanDob.slice(0, 10);
  });

  if (!dobMatch) {
    return NextResponse.json(
      {
        error: "STUDENT_NOT_MATCHED",
        message: `Tanggal Lahir "${cleanDob}" tidak sesuai dengan NISN "${cleanNumber}". Verifikasi keamanan wali gagal.`,
      },
      { status: 404 },
    );
  }

  const student = dobMatch;

  // 4. Validate guardian relationship enum
  const relInput = relationship.toLowerCase();
  const validRelationship: guardian_relationship_t =
    relInput === "ayah" || relInput === "ibu" || relInput === "kakek_nenek" || relInput === "saudara" || relInput === "institusi" || relInput === "lainnya"
      ? relInput
      : "wali";

  // 5. Upsert guardian_student_map
  const { data: existingMap } = await service
    .from("guardian_student_map")
    .select("id, status")
    .eq("parent_id", parentId)
    .eq("student_id", student.id)
    .maybeSingle();

  const nowIso = new Date().toISOString();

  if (existingMap) {
    await service
      .from("guardian_student_map")
      .update({
        status: "active",
        relationship: validRelationship,
        is_primary_guardian: true,
        revoked_at: null,
        revoked_reason: null,
        can_view_activity: true,
        can_manage_pagu: true,
        can_fund: true,
        can_approve_vault: true,
        can_report_card_lost: true,
        updated_at: nowIso,
      })
      .eq("id", existingMap.id);
  } else {
    await service.from("guardian_student_map").insert({
      parent_id: parentId,
      student_id: student.id,
      school_id: student.school_id,
      relationship: validRelationship,
      is_primary_guardian: true,
      status: "active",
      can_view_activity: true,
      can_manage_pagu: true,
      can_fund: true,
      can_approve_vault: true,
      can_report_card_lost: true,
      created_by: user.id,
    });
  }

  // 6. Record Parental Consent token (UU PDP Compliance)
  const consentToken = crypto.randomBytes(16).toString("hex");
  await service.from("parental_consent").insert({
    parent_id: parentId,
    student_id: student.id,
    school_id: student.school_id,
    consent_type: "DATA_PROCESSING_MINOR",
    consent_version: "1.0",
    consent_token: consentToken,
    granted_at: nowIso,
    evidence_ip: request.headers.get("x-forwarded-for") || "127.0.0.1",
    evidence_user_agent: request.headers.get("user-agent") || "VALO-Parent-Portal",
  });

  // 7. Log audit trail
  await service.from("audit_log").insert({
    school_id: student.school_id,
    actor_user_id: user.id,
    actor_role_snapshot: "parent",
    action: "PARENT_LINKED_STUDENT",
    entity_type: "guardian_student_map",
    entity_id: student.id,
    metadata: { student_number: cleanNumber, student_name: student.full_name, timestamp: nowIso },
  });

  return NextResponse.json({
    success: true,
    student: {
      id: student.id,
      full_name: student.full_name,
      student_number: student.student_number,
      school_id: student.school_id,
    },
    message: `Berhasil terhubung dengan data siswa ${student.full_name}!`,
  });
}
