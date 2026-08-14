import { createServiceClient } from "@/lib/supabase/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { guardian_relationship_t } from "@/types/database";

const LinkParentSchema = z.object({
  parent_id: z.string().uuid().optional(),
  parent_phone: z.string().optional(),
  parent_full_name: z.string().optional(),
  parent_email: z.string().email().optional(),
  relationship: z.enum(["ayah", "ibu", "wali", "kakek_nenek", "saudara", "institusi", "lainnya"]).default("wali"),
});

/**
 * POST /api/v1/schools/[id]/students/[sid]/link-parent
 * Binds or re-assigns a parent guardian to a student (Schema v3).
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

  const appMetadata = user.app_metadata || {};
  const userRoles: string[] = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
  const userSchoolIds: string[] = Array.isArray(appMetadata.school_ids) ? appMetadata.school_ids : [];

  const isSchoolAdmin = (userRoles.includes("school_admin") || userRoles.includes("platform_admin")) &&
    (userSchoolIds.includes(schoolId) || userRoles.includes("platform_admin"));

  const service = createServiceClient();

  if (!isSchoolAdmin) {
    const { data: roles } = await service
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", user.id)
      .is("revoked_at", null);

    const hasAccess = roles?.some(
      (r) => r.role === "school_admin" && r.school_id === schoolId,
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "RLS_FORBIDDEN" }, { status: 403 });
    }
  }

  const body = await request.json() as unknown;
  const parsed = LinkParentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_PAYLOAD", detail: parsed.error.flatten() }, { status: 400 });
  }

  const { parent_id, parent_phone, parent_full_name, parent_email, relationship } = parsed.data;

  // Verify student exists in this school
  const { data: student } = await service
    .from("students")
    .select("id, full_name")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .single();

  if (!student) {
    return NextResponse.json({ error: "STUDENT_NOT_FOUND" }, { status: 404 });
  }

  let targetParentId = parent_id;

  if (!targetParentId) {
    if (!parent_phone || !parent_phone.trim()) {
      return NextResponse.json({ error: "INVALID_PAYLOAD", message: "Pilih Orang Tua atau masukkan No. HP Orang Tua." }, { status: 400 });
    }

    const cleanPhone = parent_phone.trim();
    const { data: existingParent } = await service
      .from("parents")
      .select("id")
      .eq("phone_number", cleanPhone)
      .maybeSingle();

    if (existingParent) {
      targetParentId = existingParent.id;
    } else {
      const parentName = parent_full_name?.trim() || `Wali dari ${student.full_name}`;

      const { data: newParent, error: parentErr } = await service
        .from("parents")
        .insert({
          full_name: parentName,
          phone_number: cleanPhone,
          email: parent_email?.trim() || null,
          bni_account_number: null,
          bni_link_status: "PENDING_BANK_LINK",
        })
        .select("id, full_name, phone_number")
        .single();

      if (parentErr) {
        return NextResponse.json({ error: "PARENT_CREATE_FAILED", detail: parentErr.message }, { status: 500 });
      }

      targetParentId = newParent.id;
    }
  }

  // Update existing mappings for this student to revoked
  const now = new Date().toISOString();
  await service
    .from("guardian_student_map")
    .update({ status: "revoked", revoked_at: now, revoked_reason: "Reassigned by school admin" })
    .eq("student_id", studentId);

  // Insert active guardian_student_map
  const rel = relationship as guardian_relationship_t;
  const { data: mapResult, error: mapError } = await service
    .from("guardian_student_map")
    .insert({
      parent_id: targetParentId,
      student_id: studentId,
      school_id: schoolId,
      relationship: rel,
      is_primary_guardian: true,
      status: "active",
      can_view_activity: true,
      can_manage_pagu: true,
      can_fund: true,
      can_approve_vault: true,
      can_report_card_lost: true,
    })
    .select("id, parent_id, student_id, relationship, is_primary_guardian")
    .single();

  if (mapError) {
    return NextResponse.json({ error: "LINK_FAILED", detail: mapError.message }, { status: 500 });
  }

  const { data: parentObj } = await service
    .from("parents")
    .select("id, full_name, phone_number, email, bni_account_number, bni_link_status")
    .eq("id", targetParentId)
    .single();

  await service.from("audit_log").insert({
    school_id: schoolId,
    actor_user_id: user.id,
    actor_role_snapshot: "school_admin",
    action: "STUDENT_PARENT_LINKED",
    entity_type: "guardian_student_map",
    entity_id: mapResult.id,
    metadata: { school_id: schoolId, student_id: studentId, parent_id: targetParentId },
  });

  return NextResponse.json({
    success: true,
    parent: parentObj,
    mapping: mapResult,
  });
}

/**
 * DELETE /api/v1/schools/[id]/students/[sid]/link-parent
 * Unbinds a parent from a student (Schema v3 soft revocation).
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
  const now = new Date().toISOString();

  const { error } = await service
    .from("guardian_student_map")
    .update({ status: "revoked", revoked_at: now, revoked_reason: "Unlinked by school admin" })
    .eq("student_id", studentId)
    .eq("school_id", schoolId);

  if (error) {
    return NextResponse.json({ error: "UNLINK_FAILED", detail: error.message }, { status: 500 });
  }

  await service.from("audit_log").insert({
    school_id: schoolId,
    actor_user_id: user.id,
    actor_role_snapshot: "school_admin",
    action: "STUDENT_PARENT_UNLINKED",
    entity_type: "students",
    entity_id: studentId,
    metadata: { school_id: schoolId },
  });

  return NextResponse.json({ success: true });
}
