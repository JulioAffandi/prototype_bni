import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { guardian_relationship_t } from "@/types/database";

const LinkParentSchema = z.object({
  parent_id: z.string().optional(),
  parent_phone: z.string().optional(),
  parent_name: z.string().optional(),
  parent_bni_account: z.string().optional(),
  relationship: z.string().optional().default("wali"),
});

function normalizePhoneE164(phone: string): string {
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

/**
 * POST /api/v1/schools/[id]/students/[sid]/link-parent
 * School Admin links a parent account (existing or newly provisioned) to a student (Schema v3).
 * Gracefully handles phone normalization and guardian_student_map conflict updates.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> },
) {
  const { id: schoolId, sid: studentId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const service = createServiceClient();
  const body = await request.json() as unknown;
  const parsed = LinkParentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { parent_id, parent_phone, parent_name, parent_bni_account, relationship } = parsed.data;
  let targetParentId: string | null = parent_id || null;

  // If parent_phone is provided, normalize and find/provision parent record
  if (parent_phone && parent_phone.trim().length >= 8) {
    const normPhone = normalizePhoneE164(parent_phone.trim());

    // Search existing parent by normalized phone or raw phone
    const { data: existingParents } = await service
      .from("parents")
      .select("id, full_name, phone_number")
      .or(`phone_number.eq.${normPhone},phone_number.eq.${parent_phone.trim()}`)
      .limit(1);

    if (existingParents && existingParents.length > 0) {
      targetParentId = existingParents[0].id;
    } else {
      // Provision new parent in public.parents
      const { data: newParent, error: createParentErr } = await service
        .from("parents")
        .insert({
          full_name: parent_name?.trim() || `Orang Tua (${normPhone})`,
          phone_number: normPhone,
          bni_account_number: parent_bni_account?.trim() || null,
          bni_link_status: parent_bni_account ? "LINKED" : "UNLINKED",
        })
        .select("id")
        .single();

      if (createParentErr || !newParent) {
        return NextResponse.json(
          { error: "CREATE_PARENT_FAILED", detail: createParentErr?.message },
          { status: 500 },
        );
      }
      targetParentId = newParent.id;
    }
  }

  if (!targetParentId) {
    return NextResponse.json(
      { error: "INVALID_PARENT", message: "ID orang tua atau Nomor HP wajib diisi." },
      { status: 400 },
    );
  }

  // Determine valid relationship enum
  const relInput = relationship.toLowerCase();
  const validRel: guardian_relationship_t =
    relInput === "ayah" || relInput === "ibu" || relInput === "kakek_nenek" || relInput === "saudara" || relInput === "institusi" || relInput === "lainnya"
      ? relInput
      : "wali";

  // Upsert into public.guardian_student_map
  const { data: existingMap } = await service
    .from("guardian_student_map")
    .select("id, status")
    .eq("parent_id", targetParentId)
    .eq("student_id", studentId)
    .maybeSingle();

  const nowIso = new Date().toISOString();

  if (existingMap) {
    await service
      .from("guardian_student_map")
      .update({
        status: "active",
        relationship: validRel,
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
      parent_id: targetParentId,
      student_id: studentId,
      school_id: schoolId,
      relationship: validRel,
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

  // Audit Log
  await service.from("audit_log").insert({
    school_id: schoolId,
    actor_user_id: user.id,
    actor_role_snapshot: "school_admin",
    action: "SCHOOL_ADMIN_LINKED_PARENT",
    entity_type: "guardian_student_map",
    entity_id: studentId,
    metadata: { parent_id: targetParentId, student_id: studentId, relationship: validRel, timestamp: nowIso },
  });

  return NextResponse.json({
    success: true,
    parent_id: targetParentId,
    student_id: studentId,
    message: "Berhasil menautkan akun orang tua ke data siswa!",
  });
}
