import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const PaguSchema = z.object({
  daily_limit: z.number().positive().max(500000, "Pagu maksimal Rp500.000"),
});

/**
 * PATCH /api/v1/students/[id]/pagu
 * Updates the student's daily spending limit.
 * Only guardians with can_manage_pagu capability can perform this action.
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

  // Read app_metadata.parent_id or profile parent_id
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

  // Verify parent has guardianship with can_manage_pagu
  const { data: guardianship } = await service
    .from("guardian_student_map")
    .select("id, can_manage_pagu")
    .eq("parent_id", resolvedParentId)
    .eq("student_id", studentId)
    .eq("status", "active")
    .maybeSingle();

  if (!guardianship || !guardianship.can_manage_pagu) {
    return NextResponse.json({ error: "RLS_FORBIDDEN", message: "Akses ditolak: Tidak memiliki hak kelola pagu." }, { status: 403 });
  }

  const body = await request.json() as unknown;
  const parsed = PaguSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await service
    .from("students")
    .update({ daily_limit: parsed.data.daily_limit })
    .eq("id", studentId)
    .select("id, daily_limit")
    .single();

  if (error) {
    return NextResponse.json({ error: "UPDATE_FAILED", detail: error.message }, { status: 500 });
  }

  // Audit log
  await service.from("audit_log").insert({
    actor_user_id: user.id,
    actor_role_snapshot: "parent",
    action: "PAGU_UPDATED",
    entity_type: "students",
    entity_id: studentId,
    metadata: { new_daily_limit: parsed.data.daily_limit },
  });

  return NextResponse.json({
    daily_limit: data.daily_limit,
    updated_at: new Date().toISOString(),
  });
}
