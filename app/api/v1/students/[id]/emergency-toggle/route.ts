import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const EmergencyToggleSchema = z.object({
  emergency_approve: z.boolean(),
});

/**
 * PATCH /api/v1/students/[id]/emergency-toggle
 * Activates or deactivates Emergency Auto-Approval for a student.
 * Reference: Schema v3 RLS & guardianship capabilities
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: studentId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const parentId = user.app_metadata?.parent_id as string | undefined;

  const service = createServiceClient();
  let resolvedParentId = parentId;

  if (!resolvedParentId) {
    const { data: profile } = await service
      .from("profiles")
      .select("parent_id")
      .eq("id", user.id)
      .maybeSingle();
    resolvedParentId = profile?.parent_id || undefined;
  }

  if (!resolvedParentId) {
    return NextResponse.json({ error: "RLS_FORBIDDEN" }, { status: 403 });
  }

  // Verify guardianship with can_manage_pagu capability
  const { data: guardianship } = await service
    .from("guardian_student_map")
    .select("id, can_manage_pagu")
    .eq("parent_id", resolvedParentId)
    .eq("student_id", studentId)
    .eq("status", "active")
    .maybeSingle();

  if (!guardianship || !guardianship.can_manage_pagu) {
    return NextResponse.json({ error: "RLS_FORBIDDEN" }, { status: 403 });
  }

  const body = await request.json() as unknown;
  const parsed = EmergencyToggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await service
    .from("students")
    .update({ emergency_approve: parsed.data.emergency_approve })
    .eq("id", studentId)
    .select("id, emergency_approve, emergency_limit")
    .single();

  if (error) {
    return NextResponse.json({ error: "UPDATE_FAILED", detail: error.message }, { status: 500 });
  }

  await service.from("audit_log").insert({
    actor_user_id: user.id,
    actor_role_snapshot: "parent",
    action: parsed.data.emergency_approve ? "EMERGENCY_TOGGLE_ON" : "EMERGENCY_TOGGLE_OFF",
    entity_type: "students",
    entity_id: studentId,
    metadata: { emergency_approve: parsed.data.emergency_approve },
  });

  return NextResponse.json({ emergency_approve: data.emergency_approve });
}
