import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/ai/tools/parent/vault-status
 * Parent AI tool: child vault balance and savings goal progress (Schema v3).
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const service = createServiceClient();

  const parentId = user.app_metadata?.parent_id as string | undefined;
  let resolvedParentId = parentId;

  if (!resolvedParentId) {
    const { data: profile } = await service
      .from("profiles")
      .select("parent_id")
      .eq("id", user.id)
      .maybeSingle();
    resolvedParentId = profile?.parent_id || undefined;
  }

  if (!resolvedParentId) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const studentId = request.nextUrl.searchParams.get("student_id");

  const { data: guardian } = await service
    .from("guardian_student_map")
    .select("id")
    .eq("parent_id", resolvedParentId)
    .eq("student_id", studentId ?? "")
    .eq("status", "active")
    .maybeSingle();

  if (!guardian) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { data: vault } = await service
    .from("student_vault")
    .select(`
      savings_goal_name, savings_goal_target, updated_at,
      ledger_accounts ( balance )
    `)
    .eq("student_id", studentId ?? "")
    .maybeSingle();

  if (!vault) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const ledgerObj = vault.ledger_accounts as { balance?: number } | null;
  const balance = ledgerObj?.balance ?? 0;

  const progress = vault.savings_goal_target
    ? Math.min(100, (balance / vault.savings_goal_target) * 100)
    : 0;

  return NextResponse.json({
    vault_balance_idr: balance,
    savings_goal: {
      name: vault.savings_goal_name,
      target_idr: vault.savings_goal_target,
      progress_pct: Math.round(progress),
      remaining_idr: vault.savings_goal_target
        ? Math.max(0, vault.savings_goal_target - balance)
        : null,
    },
    last_updated: vault.updated_at,
  });
}
