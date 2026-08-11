import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrResolveParentId } from "@/lib/supabase/parent-resolver";
import { NextResponse } from "next/server";

/**
 * GET /api/v1/parents/me/students
 * Returns the list of students under the authenticated parent.
 * Reference: PRODUCT_SPECIFICATION_v2.md §9.2
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Resolve parent_id with fallback auto-binding
  const parentId = await getOrResolveParentId(user);
  if (!parentId) {
    return NextResponse.json({ error: "NO_PARENT_PROFILE", students: [] }, { status: 200 });
  }

  const service = createServiceClient();
  // Fetch students via guardian map
  const { data: mappings, error } = await service
    .from("guardian_student_map")
    .select(`
      student_id,
      relationship,
      is_primary_guardian,
      students (
        id,
        full_name,
        nfc_uid_last4,
        daily_limit,
        daily_limit_used,
        emergency_approve,
        emergency_limit,
        emergency_used_today,
        card_status,
        school_id,
        schools (name)
      )
    `)
    .eq("parent_id", parentId);

  if (error) {
    return NextResponse.json({ error: "FETCH_FAILED", detail: error.message }, { status: 500 });
  }

  const rawMappings = (mappings ?? []) as unknown as Array<{
    student_id: string;
    relationship: string;
    is_primary_guardian: boolean;
    students: Record<string, unknown> | null;
  }>;

  const students = rawMappings
    .filter((m) => !!m.students)
    .map((m) => ({
      ...m.students,
      relationship: m.relationship,
      is_primary_guardian: m.is_primary_guardian,
    }));

  return NextResponse.json({ students });
}
