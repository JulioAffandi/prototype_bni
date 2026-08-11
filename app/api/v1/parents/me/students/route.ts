import { createServerSupabaseClient } from "@/lib/supabase/server";
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

  // Get parent profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("parent_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "parent" || !profile.parent_id) {
    return NextResponse.json({ error: "RLS_FORBIDDEN" }, { status: 403 });
  }

  // Fetch students via guardian map — RLS enforced
  const { data: mappings, error } = await supabase
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
    .eq("parent_id", profile.parent_id);

  if (error) {
    return NextResponse.json({ error: "FETCH_FAILED", detail: error.message }, { status: 500 });
  }

  const students = (mappings ?? []).map((m) => ({
    ...m.students,
    relationship: m.relationship,
    is_primary_guardian: m.is_primary_guardian,
  }));

  return NextResponse.json({ students });
}
