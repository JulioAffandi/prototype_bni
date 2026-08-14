import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import type { student_status_t } from "@/types/database";

/**
 * POST /api/v1/schools/[id]/students/[sid]/offboard
 * Offboards a student (graduated or transferred).
 * Deactivates cards and records offboarded_at timestamp.
 * Reference: Schema v3 §3 (students, student_cards) & §13 (card_lifecycle_events)
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

  const isAuthorized = (userRoles.includes("school_admin") || userRoles.includes("platform_admin")) &&
    (userSchoolIds.includes(schoolId) || userRoles.includes("platform_admin"));

  const service = createServiceClient();

  if (!isAuthorized) {
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

  const body = await request.json().catch(() => ({})) as { reason?: string };
  const studentStatus: student_status_t = body.reason === "transfer" ? "transferred_out" : "graduated";
  const now = new Date().toISOString();

  // 1. Update Student Status
  await service
    .from("students")
    .update({
      status: studentStatus,
      offboarded_at: now,
      updated_at: now,
    })
    .eq("id", studentId)
    .eq("school_id", schoolId);

  // 2. Retire Card Credentials
  const { data: cards } = await service
    .from("student_cards")
    .select("id")
    .eq("student_id", studentId)
    .eq("school_id", schoolId);

  if (cards && cards.length > 0) {
    await service
      .from("student_cards")
      .update({ status: "retired", retired_at: now })
      .eq("student_id", studentId)
      .eq("school_id", schoolId);
  }

  // 3. Lifecycle Event & Audit Log
  await service.from("card_lifecycle_events").insert({
    student_id: studentId,
    card_id: cards?.[0]?.id || null,
    school_id: schoolId,
    event_type: "offboarded",
    notes: `Offboarding: status changed to ${studentStatus}`,
    actor_user_id: user.id,
    actor_role_snapshot: "school_admin",
  });

  await service.from("audit_log").insert({
    school_id: schoolId,
    actor_user_id: user.id,
    actor_role_snapshot: "school_admin",
    action: "STUDENT_OFFBOARDED",
    entity_type: "students",
    entity_id: studentId,
    metadata: {
      school_id: schoolId,
      student_status: studentStatus,
      offboarded_at: now,
    },
  });

  return NextResponse.json({
    student_id: studentId,
    status: studentStatus,
    offboarded_at: now,
  });
}
