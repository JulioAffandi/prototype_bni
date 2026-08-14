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
 * Reference: PRODUCT_SPECIFICATION_v2.md §2.4, §9.2
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

  const { data: profileData } = await supabase
    .from("profiles")
    .select("parent_id, role")
    .eq("id", user.id)
    .single();

  const profile = profileData as { parent_id: string | null; role: string } | null;

  if (!profile || profile.role !== "parent" || !profile.parent_id) {
    return NextResponse.json({ error: "RLS_FORBIDDEN" }, { status: 403 });
  }

  // Verify guardianship
  const { data: guardianship } = await supabase
    .from("guardian_student_map")
    .select("id")
    .eq("parent_id", profile.parent_id)
    .eq("student_id", studentId)
    .single();

  if (!guardianship) {
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

  const service = createServiceClient();
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
    actor_profile_id: user.id,
    action: parsed.data.emergency_approve ? "EMERGENCY_TOGGLE_ON" : "EMERGENCY_TOGGLE_OFF",
    entity_type: "students",
    entity_id: studentId,
    metadata: { emergency_approve: parsed.data.emergency_approve },
  });

  return NextResponse.json({ emergency_approve: data.emergency_approve });
}
