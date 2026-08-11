import { createServiceClient } from "@/lib/supabase/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const RegisterStudentSchema = z.object({
  full_name: z.string().min(2),
  raw_nfc_uid: z.string().min(4),
  nfc_uid_last4: z.string().length(4).optional(),
  parent_id: z.string().uuid().optional(),
  parent_phone: z.string().optional(),
  parent_full_name: z.string().optional(),
  parent_bni_account: z.string().optional(),
  relationship: z.string().default("orang_tua"),
});

/**
 * POST /api/v1/schools/[id]/students
 * Registers a new student and tokenizes their NFC UID.
 * Auto-provisions parent guardian link if parent details/phone are provided.
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

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .single();

  const profile = profileData as { role?: string; school_id?: string | null } | null;

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

  const {
    full_name,
    raw_nfc_uid,
    nfc_uid_last4,
    parent_id,
    parent_phone,
    parent_full_name,
    parent_bni_account,
    relationship,
  } = parsed.data;

  // ── NFC UID Tokenization (§11.2) ────────────────────────────
  const tenantSalt = process.env.TENANT_SALT_SECRET;
  if (!tenantSalt) {
    return NextResponse.json({ error: "SERVER_CONFIG_ERROR" }, { status: 500 });
  }

  const { createHash } = await import("crypto");
  const nfcUidHash = createHash("sha256")
    .update(raw_nfc_uid + tenantSalt + schoolId)
    .digest("hex");

  const service = createServiceClient();

  // Check for duplicate UID
  const { data: existing } = await service
    .from("students")
    .select("id")
    .eq("nfc_uid_hash", nfcUidHash)
    .maybeSingle();

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
    .select("id, full_name, nfc_uid_last4, card_status, daily_limit, daily_limit_used, emergency_approve, emergency_overdraft_count_7d, created_at")
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

  // Handle Parent Relational Binding
  let boundParent: { id: string; full_name: string; phone_number: string } | null = null;
  let targetParentId = parent_id;

  if (!targetParentId && parent_phone?.trim()) {
    const cleanPhone = parent_phone.trim();
    const { data: existingParent } = await service
      .from("parents")
      .select("id, full_name, phone_number")
      .eq("phone_number", cleanPhone)
      .maybeSingle();

    if (existingParent) {
      targetParentId = existingParent.id;
      boundParent = existingParent;
    } else {
      // Auto-provision parent record
      const defaultBniAcc = parent_bni_account?.trim() || `888${Math.floor(100000000 + Math.random() * 900000000)}`;
      const parentName = parent_full_name?.trim() || `Wali dari ${full_name}`;

      const { data: newParent } = await service
        .from("parents")
        .insert({
          full_name: parentName,
          phone_number: cleanPhone,
          phone_verified: true,
          bni_account_number: defaultBniAcc,
        })
        .select("id, full_name, phone_number")
        .single();

      if (newParent) {
        targetParentId = newParent.id;
        boundParent = newParent;
      }
    }
  } else if (targetParentId) {
    const { data: parentObj } = await service
      .from("parents")
      .select("id, full_name, phone_number")
      .eq("id", targetParentId)
      .maybeSingle();
    if (parentObj) {
      boundParent = parentObj;
    }
  }

  if (targetParentId) {
    await service.from("guardian_student_map").insert({
      parent_id: targetParentId,
      student_id: student.id,
      relationship: relationship || "orang_tua",
      is_primary_guardian: true,
    });
  }

  await service.from("audit_log").insert({
    actor_profile_id: user.id,
    action: "STUDENT_REGISTERED",
    entity_type: "students",
    entity_id: student.id,
    metadata: { school_id: schoolId, uid_last4: student.nfc_uid_last4, parent_id: targetParentId },
  });

  return NextResponse.json({
    student: {
      ...student,
      parent: boundParent,
    },
  }, { status: 201 });
}

/**
 * GET /api/v1/schools/[id]/students
 * Lists all students belonging to this school with guardian parent details.
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

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .single();

  const profile = profileData as { role?: string; school_id?: string | null } | null;

  if (!profile || profile.role !== "school_admin" || profile.school_id !== schoolId) {
    return NextResponse.json({ error: "RLS_FORBIDDEN" }, { status: 403 });
  }

  const service = createServiceClient();
  const { data: students, error } = await service
    .from("students")
    .select(`
      id, full_name, nfc_uid_last4, card_status, daily_limit, daily_limit_used,
      emergency_approve, emergency_overdraft_count_7d, created_at,
      guardian_student_map (
        parent_id, relationship, is_primary_guardian,
        parents ( id, full_name, phone_number, email, bni_account_number )
      )
    `)
    .eq("school_id", schoolId)
    .order("full_name");

  if (error) {
    return NextResponse.json({ error: "FETCH_FAILED", detail: error.message }, { status: 500 });
  }

  const rawList = (students ?? []) as unknown as Array<{
    id: string;
    full_name: string;
    nfc_uid_last4: string | null;
    card_status: string;
    daily_limit: number;
    daily_limit_used: number;
    emergency_approve: boolean;
    emergency_overdraft_count_7d: number;
    created_at: string;
    guardian_student_map?: Array<{
      parent_id: string;
      relationship: string;
      is_primary_guardian: boolean;
      parents: { id: string; full_name: string; phone_number: string; email?: string; bni_account_number: string } | null;
    }>;
  }>;

  const formatted = rawList.map((s) => {
    const maps = s.guardian_student_map;
    const primaryMap = maps?.[0];
    const parentObj = primaryMap?.parents ?? null;

    return {
      id: s.id,
      full_name: s.full_name,
      nfc_uid_last4: s.nfc_uid_last4 ?? "????",
      card_status: s.card_status,
      daily_limit: s.daily_limit,
      daily_limit_used: s.daily_limit_used,
      emergency_approve: s.emergency_approve,
      emergency_overdraft_count_7d: s.emergency_overdraft_count_7d,
      created_at: s.created_at,
      parent: parentObj
        ? {
            id: parentObj.id,
            full_name: parentObj.full_name,
            phone_number: parentObj.phone_number,
            relationship: primaryMap?.relationship ?? "orang_tua",
          }
        : null,
    };
  });

  return NextResponse.json({ students: formatted });
}
