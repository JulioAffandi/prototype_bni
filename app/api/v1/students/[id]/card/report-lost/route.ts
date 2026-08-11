import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/v1/students/[id]/card/report-lost
 * Parent reports a lost/stolen NFC card.
 * Immediately blocks all future transactions on this card.
 * Reference: PRODUCT_SPECIFICATION_v2.md §12.1, §9.2
 */
export async function POST(
  _request: NextRequest,
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

  const service = createServiceClient();

  // Block card — immediate effect
  const { error } = await service
    .from("students")
    .update({ card_status: "lost_reported" })
    .eq("id", studentId);

  if (error) {
    return NextResponse.json({ error: "UPDATE_FAILED", detail: error.message }, { status: 500 });
  }

  // Record lifecycle event (§12.1)
  await service.from("card_lifecycle_events").insert({
    student_id: studentId,
    event_type: "lost_reported",
    notes: "Dilaporkan oleh orang tua via Parent App",
    actor_profile_id: user.id,
  });

  await service.from("audit_log").insert({
    actor_profile_id: user.id,
    action: "CARD_LOST_REPORTED",
    entity_type: "students",
    entity_id: studentId,
    metadata: { reported_by: "parent", timestamp: new Date().toISOString() },
  });

  return NextResponse.json({ card_status: "lost_reported" });
}
