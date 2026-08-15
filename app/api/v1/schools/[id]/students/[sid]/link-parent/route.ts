import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { guardian_relationship_t } from "@/types/database";

const LinkParentSchema = z.object({
  parent_id: z.string().optional(),
  parent_phone: z.string().optional(),
  parent_full_name: z.string().optional(),
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
 * School Admin Pre-Binding Workflow (SPEC v2.1 §4.4 & §3B):
 * 1. Normalizes phone number to E.164 (+62...)
 * 2. Searches or auto-provisions parent record with account_status = 'invited_pending_signup'
 * 3. Upserts guardian_student_map with status = 'pending_activation' & linked_via = 'school_admin_prebind'
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

  const { parent_id, parent_phone, parent_full_name, parent_name, parent_bni_account, relationship } = parsed.data;
  let targetParentId: string | null = parent_id || null;
  let parentAccountStatus = "active";

  const rawPhone = parent_phone?.trim();
  const nameToUse = parent_full_name?.trim() || parent_name?.trim();

  if (rawPhone && rawPhone.length >= 8) {
    const normPhone = normalizePhoneE164(rawPhone);

    // Find existing parent by E.164 phone or raw phone
    const { data: existingParents } = await service
      .from("parents")
      .select("id, full_name, phone_number, account_status")
      .or(`phone_number.eq.${normPhone},phone_number.eq.${rawPhone}`)
      .limit(1);

    if (existingParents && existingParents.length > 0) {
      targetParentId = existingParents[0].id;
      parentAccountStatus = existingParents[0].account_status ?? "active";
    } else {
      // Auto-provision parent record in public.parents
      parentAccountStatus = "invited_pending_signup";
      const { data: newParent, error: createParentErr } = await service
        .from("parents")
        .insert({
          full_name: nameToUse || `Orang Tua (${normPhone})`,
          phone_number: normPhone,
          bni_account_number: parent_bni_account?.trim() || null,
          bni_link_status: parent_bni_account ? "LINKED" : "UNLINKED",
          account_status: "invited_pending_signup",
          invited_by_school_id: schoolId,
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

  const relInput = relationship.toLowerCase();
  const validRel: guardian_relationship_t =
    relInput === "ayah" || relInput === "ibu" || relInput === "kakek_nenek" || relInput === "saudara" || relInput === "institusi" || relInput === "lainnya"
      ? relInput
      : "wali";

  const { data: existingMap } = await service
    .from("guardian_student_map")
    .select("id, status")
    .eq("parent_id", targetParentId)
    .eq("student_id", studentId)
    .maybeSingle();

  const nowIso = new Date().toISOString();
  const linkStatus = parentAccountStatus === "invited_pending_signup" ? "pending_activation" : "active";

  if (existingMap) {
    await service
      .from("guardian_student_map")
      .update({
        status: linkStatus,
        relationship: validRel,
        linked_via: "school_admin_prebind",
        linked_at: nowIso,
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
      status: linkStatus,
      linked_via: "school_admin_prebind",
      linked_at: nowIso,
      can_view_activity: true,
      can_manage_pagu: true,
      can_fund: true,
      can_approve_vault: true,
      can_report_card_lost: true,
      created_by: user.id,
    });
  }

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
    guardian_relationship_status: linkStatus,
    parent_account_status: parentAccountStatus,
    invite_channel: "whatsapp_otp",
    parent_id: targetParentId,
    student_id: studentId,
    message: "Berhasil menautkan akun orang tua ke data siswa!",
  });
}

/**
 * DELETE /api/v1/schools/[id]/students/[sid]/link-parent
 * Unlinks parent from student by soft-revoking relationship in guardian_student_map.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> },
) {
  const { id: schoolId, sid: studentId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const service = createServiceClient();
  const nowIso = new Date().toISOString();

  await service
    .from("guardian_student_map")
    .update({
      status: "revoked",
      revoked_at: nowIso,
      revoked_reason: "Dibatalkan oleh School Admin",
      updated_at: nowIso,
    })
    .eq("school_id", schoolId)
    .eq("student_id", studentId);

  return NextResponse.json({ success: true, message: "Relasi orang tua berhasil dihapus." });
}
