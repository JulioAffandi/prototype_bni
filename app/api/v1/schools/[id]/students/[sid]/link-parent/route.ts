import { createServiceClient } from "@/lib/supabase/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const LinkParentSchema = z.object({
  parent_id: z.string().uuid().optional(),
  parent_phone: z.string().optional(),
  parent_full_name: z.string().optional(),
  parent_bni_account: z.string().optional(),
  relationship: z.string().default("orang_tua"),
});

/**
 * POST /api/v1/schools/[id]/students/[sid]/link-parent
 * Binds or re-assigns a parent guardian to a student.
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
  const parsed = LinkParentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_PAYLOAD", detail: parsed.error.flatten() }, { status: 400 });
  }

  const { parent_id, parent_phone, parent_full_name, parent_bni_account, relationship } = parsed.data;
  const service = createServiceClient();

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
      // Auto-provision new parent
      const defaultBniAcc = parent_bni_account?.trim() || `888${Math.floor(100000000 + Math.random() * 900000000)}`;
      const parentName = parent_full_name?.trim() || `Wali dari ${student.full_name}`;

      const { data: newParent, error: parentErr } = await service
        .from("parents")
        .insert({
          full_name: parentName,
          phone_number: cleanPhone,
          phone_verified: true,
          bni_account_number: defaultBniAcc,
        })
        .select("id, full_name, phone_number")
        .single();

      if (parentErr) {
        return NextResponse.json({ error: "PARENT_CREATE_FAILED", detail: parentErr.message }, { status: 500 });
      }

      targetParentId = newParent.id;
    }
  }

  // Delete existing mapping for this student if any (primary guardian replace)
  await service
    .from("guardian_student_map")
    .delete()
    .eq("student_id", studentId);

  // Insert guardian_student_map
  const { data: mapResult, error: mapError } = await service
    .from("guardian_student_map")
    .insert({
      parent_id: targetParentId,
      student_id: studentId,
      relationship,
      is_primary_guardian: true,
    })
    .select("id, parent_id, student_id, relationship, is_primary_guardian")
    .single();

  if (mapError) {
    return NextResponse.json({ error: "LINK_FAILED", detail: mapError.message }, { status: 500 });
  }

  // Fetch full parent info to return
  const { data: parentObj } = await service
    .from("parents")
    .select("id, full_name, phone_number, email, bni_account_number")
    .eq("id", targetParentId)
    .single();

  await service.from("audit_log").insert({
    actor_profile_id: user.id,
    action: "STUDENT_PARENT_LINKED",
    entity_type: "guardian_student_map",
    entity_id: mapResult.id,
    metadata: { student_id: studentId, parent_id: targetParentId },
  });

  return NextResponse.json({
    success: true,
    parent: parentObj,
    mapping: mapResult,
  });
}

/**
 * DELETE /api/v1/schools/[id]/students/[sid]/link-parent
 * Unbinds a parent from a student.
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

  const { error } = await service
    .from("guardian_student_map")
    .delete()
    .eq("student_id", studentId);

  if (error) {
    return NextResponse.json({ error: "UNLINK_FAILED", detail: error.message }, { status: 500 });
  }

  await service.from("audit_log").insert({
    actor_profile_id: user.id,
    action: "STUDENT_PARENT_UNLINKED",
    entity_type: "students",
    entity_id: studentId,
    metadata: { school_id: schoolId },
  });

  return NextResponse.json({ success: true });
}
