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
 * Only the parent guardian of this student can perform this action.
 * Reference: PRODUCT_SPECIFICATION_v2.md §9.2
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("parent_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "parent" || !profile.parent_id) {
    return NextResponse.json({ error: "RLS_FORBIDDEN" }, { status: 403 });
  }

  // Verify this parent is actually a guardian of this student
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
  const parsed = PaguSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Use service client for write — RLS bypass (write integrity via server validation above)
  const service = createServiceClient();
  const { data, error } = await service
    .from("students")
    .update({ daily_limit: parsed.data.daily_limit })
    .eq("id", studentId)
    .select("id, daily_limit, daily_limit_used")
    .single();

  if (error) {
    return NextResponse.json({ error: "UPDATE_FAILED", detail: error.message }, { status: 500 });
  }

  // Audit log
  await service.from("audit_log").insert({
    actor_profile_id: user.id,
    action: "PAGU_UPDATED",
    entity_type: "students",
    entity_id: studentId,
    metadata: { new_daily_limit: parsed.data.daily_limit },
  });

  return NextResponse.json({
    daily_limit: data.daily_limit,
    daily_limit_used: data.daily_limit_used,
    updated_at: new Date().toISOString(),
  });
}
