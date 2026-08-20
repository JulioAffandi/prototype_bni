import { createServiceClient } from "@/lib/supabase/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";

const RegisterStudentSchema = z.object({
  full_name: z.string().min(2),
  raw_nfc_uid: z.string().min(4),
  nfc_uid_last4: z.string().length(4).optional(),
  student_number: z.string().optional(),
  date_of_birth: z.string().optional(),
  grade_level: z.string().optional(),
  class_name: z.string().optional(),
  class_label: z.string().optional(),
  daily_limit: z.number().positive().optional().default(20000),
  emergency_limit: z.number().nonnegative().optional().default(15000),
  emergency_approve: z.boolean().optional().default(true),
  parent_id: z.string().uuid().optional(),
  parent_phone: z.string().optional(),
  parent_full_name: z.string().optional(),
  parent_email: z.string().optional(),
  relationship: z.enum(["ayah", "ibu", "wali", "kakek_nenek", "saudara", "institusi", "lainnya", "orang_tua"]).default("wali"),
});

/**
 * POST /api/v1/schools/[id]/students
 * Schema v3 Student Enrollment & Auto-Provisioning Pipeline:
 * 1. Inserts student metadata into public.students
 * 2. Provisions card credentials into public.student_cards (uid_hash bytea format)
 * 3. Initializes student vault & double-entry ledger account (public.student_vault & public.ledger_accounts)
 * 4. Onboards parent in public.parents with bni_link_status = 'PENDING_BANK_LINK' (null bni_account_number)
 * 5. Binds guardianship in public.guardian_student_map with explicit capabilities
 * 6. Provisions user role in public.user_roles
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

  // Check authorization via user.app_metadata or user_roles
  const service = createServiceClient();
  
  const appMetadata = user.app_metadata || {};
  const userRoles: string[] = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
  const userSchoolIds: string[] = Array.isArray(appMetadata.school_ids) ? appMetadata.school_ids : [];

  const isSchoolAdmin = userRoles.includes("school_admin") || userRoles.includes("platform_admin");
  const isSchoolScoped = userSchoolIds.includes(schoolId) || userRoles.includes("platform_admin");

  if (!isSchoolAdmin && !isSchoolScoped) {
    // Fallback check against user_roles table
    const { data: roles } = await service
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", user.id)
      .is("revoked_at", null);

    const hasAccess = roles?.some(
      (r) => (r.role === "school_admin" || r.role === "school_treasurer") && r.school_id === schoolId,
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "RLS_FORBIDDEN" }, { status: 403 });
    }
  }

  const body = await request.json() as unknown;
  const parsed = RegisterStudentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { 
        error: "INVALID_PAYLOAD", 
        message: "Data tidak valid: " + Object.entries(parsed.error.flatten().fieldErrors)
          .map(([field, errs]) => `${field} (${errs?.join(", ")})`)
          .join(", "),
        detail: parsed.error.flatten() 
      },
      { status: 400 },
    );
  }

  const {
    full_name,
    raw_nfc_uid,
    nfc_uid_last4,
    student_number,
    date_of_birth,
    grade_level,
    class_name,
    class_label,
    daily_limit,
    emergency_limit,
    emergency_approve,
    parent_id,
    parent_phone,
    parent_full_name,
    parent_email,
    relationship,
  } = parsed.data;

  const parsedGradeLevel = grade_level ? parseInt(grade_level) || grade_level : 7;
  const parsedClassGroup = class_name || class_label || "7A";

  // 1. SHA-256 Card UID Tokenization
  const tenantSalt = process.env.TENANT_SALT_SECRET || "default_tenant_salt";
  const rawHash = createHash("sha256")
    .update(raw_nfc_uid + tenantSalt)
    .digest("hex");
  const byteaHash = `\\x${rawHash.toLowerCase()}`;
  const last4 = nfc_uid_last4 || raw_nfc_uid.slice(-4);

  // Check duplicate card UID in tenant (Precise .length > 0 check to prevent false positive [] truthy checks)
  const { data: existingCards, error: checkErr } = await service
    .from("student_cards")
    .select("id, student_id")
    .eq("school_id", schoolId)
    .or(`uid_hash.eq.${byteaHash},card_uid_hash.eq.${byteaHash}`);

  if (checkErr) {
    console.error("Card check query error:", checkErr);
  }

  if (existingCards && existingCards.length > 0) {
    return NextResponse.json(
      { error: "CARD_ALREADY_REGISTERED", message: "Kartu NFC dengan UID ini sudah digunakan oleh siswa lain." },
      { status: 409 },
    );
  }

  // 2. Insert Student entity (Schema v3)
  const { data: student, error: studentError } = await service
    .from("students")
    .insert({
      school_id: schoolId,
      full_name,
      student_number: student_number || null,
      date_of_birth: date_of_birth || null,
      grade_level: parsedGradeLevel,
      class_group: parsedClassGroup,
      daily_limit: Number(daily_limit) || 20000,
      daily_limit_used: 0,
      emergency_approve: Boolean(emergency_approve),
      emergency_limit: Number(emergency_limit) || 15000,
      card_status: "ACTIVE",
      status: "active",
    } as any)
    .select("id, school_id, full_name, student_number, date_of_birth, grade_level, class_group, daily_limit, emergency_approve, emergency_limit, created_at")
    .single();

  if (studentError || !student) {
    const isNisnConflict =
      studentError?.code === "23505" ||
      studentError?.message?.includes("student_number") ||
      studentError?.message?.includes("uq_students_number_per_school") ||
      studentError?.details?.includes("student_number");

    if (isNisnConflict) {
      return NextResponse.json(
        {
          error: "NISN_ALREADY_EXISTS",
          message: `NISN / No. Induk "${student_number}" sudah terdaftar di sekolah ini.`,
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error: "INSERT_FAILED",
        message: studentError?.message || "Gagal menyimpan data siswa ke database.",
        detail: studentError?.details,
      },
      { status: 400 },
    );
  }

  // 3. Insert Card Credentials into public.student_cards
  const { data: card, error: cardError } = await service
    .from("student_cards")
    .insert({
      student_id: student.id,
      school_id: schoolId,
      uid_hash: byteaHash,
      card_uid_hash: byteaHash,
      uid_last4: last4,
      card_uid_last4: last4,
      status: "active",
      activated_at: new Date().toISOString(),
    } as any)
    .select("id, uid_last4, status")
    .single();

  if (cardError || !card) {
    const isCardConflict =
      cardError?.code === "23505" ||
      cardError?.message?.includes("uid_hash") ||
      cardError?.message?.includes("uq_cards_tenant_uid") ||
      cardError?.details?.includes("uid_hash");

    if (isCardConflict) {
      return NextResponse.json(
        { error: "CARD_ALREADY_REGISTERED", message: "Kartu NFC dengan UID ini sudah digunakan oleh siswa lain." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "CARD_PROVISIONING_FAILED", message: cardError?.message || "Gagal mengaktifkan kartu NFC." },
      { status: 400 },
    );
  }

  // 4. Initialize Vault Ledger Account & Student Vault
  const { data: ledgerAcct, error: ledgerError } = await service
    .from("ledger_accounts")
    .insert({
      account_type: "student_vault",
      normal_balance: "CREDIT",
      currency_code: "IDR",
      owner_student_id: student.id,
      balance: 0,
      last_entry_seq: 0,
    })
    .select("id")
    .single();

  if (!ledgerError && ledgerAcct) {
    await service.from("student_vault").insert({
      student_id: student.id,
      school_id: schoolId,
      ledger_account_id: ledgerAcct.id,
    });
  }

  // 5. Parent Onboarding & Guardianship Relational Binding
  let targetParentId = parent_id || null;
  let parentRecord: { id: string; full_name: string; phone_number: string; email: string | null } | null = null;

  if (!targetParentId && parent_phone?.trim()) {
    const cleanPhone = parent_phone.trim();
    const { data: existingParent } = await service
      .from("parents")
      .select("id, full_name, phone_number, email")
      .eq("phone_number", cleanPhone)
      .maybeSingle();

    if (existingParent) {
      targetParentId = existingParent.id;
      parentRecord = existingParent;
    } else {
      // Create parent record without fake BNI account
      const parentName = parent_full_name?.trim() || `Wali dari ${full_name}`;
      const { data: newParent, error: parentErr } = await service
        .from("parents")
        .insert({
          full_name: parentName,
          phone_number: cleanPhone,
          email: parent_email?.trim() || null,
          bni_account_number: null,
          bni_link_status: "PENDING_BANK_LINK",
        })
        .select("id, full_name, phone_number, email")
        .single();

      if (newParent) {
        targetParentId = newParent.id;
        parentRecord = newParent;
      } else if (parentErr) {
        // Fallback to lookup existing parent on phone unique conflict
        const { data: fallbackParent } = await service
          .from("parents")
          .select("id, full_name, phone_number, email")
          .eq("phone_number", cleanPhone)
          .maybeSingle();

        if (fallbackParent) {
          targetParentId = fallbackParent.id;
          parentRecord = fallbackParent;
        }
      }
    }
  } else if (targetParentId) {
    const { data: existingParent } = await service
      .from("parents")
      .select("id, full_name, phone_number, email")
      .eq("id", targetParentId)
      .maybeSingle();
    if (existingParent) {
      parentRecord = existingParent;
    }
  }

  if (targetParentId) {
    const validRelationship = relationship === "orang_tua" ? "wali" : (relationship as "ayah" | "ibu" | "wali" | "kakek_nenek" | "saudara" | "institusi" | "lainnya");
    
    // Check if mapping already exists
    const { data: existingMap } = await service
      .from("guardian_student_map")
      .select("id")
      .eq("parent_id", targetParentId)
      .eq("student_id", student.id)
      .maybeSingle();

    if (existingMap) {
      await service.from("guardian_student_map").update({
        status: "active",
        relationship: validRelationship,
        is_primary_guardian: true,
        revoked_at: null,
      }).eq("id", existingMap.id);
    } else {
      await service.from("guardian_student_map").insert({
        parent_id: targetParentId,
        student_id: student.id,
        school_id: schoolId,
        relationship: validRelationship,
        is_primary_guardian: true,
        status: "active",
        can_view_activity: true,
        can_manage_pagu: true,
        can_fund: true,
        can_approve_vault: true,
        can_report_card_lost: true,
      });
    }

    // Check profile binding
    const { data: profile } = await service
      .from("profiles")
      .select("id")
      .eq("parent_id", targetParentId)
      .maybeSingle();

    if (profile) {
      await service.from("user_roles").upsert({
        user_id: profile.id,
        role: "parent",
      });
    }
  }

  // 6. Card Lifecycle Event & Audit Log
  await service.from("card_lifecycle_events").insert({
    student_id: student.id,
    card_id: card.id,
    school_id: schoolId,
    event_type: "issued",
    notes: "Kartu NFC diterbitkan saat pendaftaran siswa (Schema v3)",
    actor_user_id: user.id,
    actor_role_snapshot: "school_admin",
  });

  await service.from("audit_log").insert({
    school_id: schoolId,
    actor_user_id: user.id,
    actor_role_snapshot: "school_admin",
    action: "STUDENT_REGISTERED",
    entity_type: "students",
    entity_id: student.id,
    metadata: { school_id: schoolId, card_id: card.id, uid_last4: card.uid_last4, parent_id: targetParentId },
  });

  return NextResponse.json(
    {
      student: {
        ...student,
        card_status: card.status,
        nfc_uid_last4: card.uid_last4,
        parent: parentRecord,
      },
    },
    { status: 201 },
  );
}

/**
 * GET /api/v1/schools/[id]/students
 * Lists all students for a school with active card credentials and primary guardian.
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

  const service = createServiceClient();
  const { data: students, error } = await service
    .from("students")
    .select(`
      id, school_id, full_name, student_number, grade_level, class_group, status,
      daily_limit, emergency_approve, emergency_limit, created_at,
      student_cards ( id, uid_last4, status ),
      guardian_student_map (
        parent_id, relationship, is_primary_guardian,
        parents ( id, full_name, phone_number, email, bni_account_number, bni_link_status )
      )
    `)
    .eq("school_id", schoolId)
    .order("full_name");

  if (error) {
    return NextResponse.json({ error: "FETCH_FAILED", detail: error.message }, { status: 500 });
  }

  const formatted = (students || []).map((s) => {
    const cards = (s.student_cards || []) as Array<{ id: string; uid_last4: string | null; status: string }>;
    const activeCard = cards.find((c) => c.status === "active") || cards[0];
    const maps = (s.guardian_student_map || []) as Array<{
      parent_id: string;
      relationship: string;
      is_primary_guardian: boolean;
      parents: { id: string; full_name: string; phone_number: string; email: string | null; bni_account_number: string | null; bni_link_status: string } | null;
    }>;
    const primaryMap = maps.find((m) => m.is_primary_guardian) || maps[0];
    const parentObj = primaryMap?.parents || null;

    const classLabel = (s as any).grade_level && (s as any).class_group ? `Kelas ${(s as any).grade_level} ${(s as any).class_group}` : (s as any).class_group || null;

    return {
      id: s.id,
      full_name: s.full_name,
      student_number: s.student_number,
      class_label: classLabel,
      nfc_uid_last4: activeCard?.uid_last4 ?? "????",
      card_status: activeCard?.status ?? "pending_activation",
      daily_limit: s.daily_limit,
      daily_limit_used: 0, // Pagu consumption tracked in student_daily_counters
      emergency_approve: s.emergency_approve,
      emergency_limit: s.emergency_limit,
      status: s.status,
      created_at: s.created_at,
      parent: parentObj
        ? {
            id: parentObj.id,
            full_name: parentObj.full_name,
            phone_number: parentObj.phone_number,
            email: parentObj.email,
            bni_account_number: parentObj.bni_account_number,
            bni_link_status: parentObj.bni_link_status,
            relationship: primaryMap?.relationship ?? "wali",
          }
        : null,
    };
  });

  return NextResponse.json({ students: formatted });
}
