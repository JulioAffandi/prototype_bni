import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/ai/tools/parent/vault-status
 * Parent AI tool: child vault balance and savings goal progress.
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("parent_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "parent" || !profile.parent_id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const studentId = request.nextUrl.searchParams.get("student_id");

  const { data: guardian } = await supabase
    .from("guardian_student_map")
    .select("id")
    .eq("parent_id", profile.parent_id)
    .eq("student_id", studentId ?? "")
    .single();

  if (!guardian) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { data: vault } = await supabase
    .from("student_vault")
    .select("vault_balance, savings_goal_name, savings_goal_target, updated_at")
    .eq("student_id", studentId ?? "")
    .single();

  if (!vault) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const progress = vault.savings_goal_target
    ? Math.min(100, (vault.vault_balance / vault.savings_goal_target) * 100)
    : 0;

  return NextResponse.json({
    vault_balance_idr: vault.vault_balance,
    savings_goal: {
      name: vault.savings_goal_name,
      target_idr: vault.savings_goal_target,
      progress_pct: Math.round(progress),
      remaining_idr: vault.savings_goal_target
        ? Math.max(0, vault.savings_goal_target - vault.vault_balance)
        : null,
    },
    last_updated: vault.updated_at,
  });
}
