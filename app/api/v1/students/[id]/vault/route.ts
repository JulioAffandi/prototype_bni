import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/students/[id]/vault
 * Returns the Student Vault balance and savings goal for a student.
 * Parent-only access — verifies guardianship via RLS.
 * Reference: PRODUCT_SPECIFICATION_v2.md §2.1, §9.2
 */
export async function GET(
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

  const { data: vault, error } = await supabase
    .from("student_vault")
    .select("vault_balance, savings_goal_name, savings_goal_target, updated_at")
    .eq("student_id", studentId)
    .single();

  if (error) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ vault });
}
