import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/students/[id]/vault
 * Returns the Student Vault balance (from ledger_accounts) and savings goal for a student.
 * Parent-only access — verifies guardianship.
 * Reference: Schema v3 §10 (student_vault & ledger_accounts)
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

  if (!resolvedParentId) {
    return NextResponse.json({ error: "RLS_FORBIDDEN" }, { status: 403 });
  }

  // Verify guardianship
  const { data: guardianship } = await service
    .from("guardian_student_map")
    .select("id, can_view_activity")
    .eq("parent_id", resolvedParentId)
    .eq("student_id", studentId)
    .eq("status", "active")
    .maybeSingle();

  if (!guardianship || !guardianship.can_view_activity) {
    return NextResponse.json({ error: "RLS_FORBIDDEN" }, { status: 403 });
  }

  const { data: vault, error } = await service
    .from("student_vault")
    .select(`
      student_id, school_id, ledger_account_id, savings_goal_name, savings_goal_target, updated_at,
      ledger_accounts ( balance )
    `)
    .eq("student_id", studentId)
    .maybeSingle();

  if (error || !vault) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const ledgerObj = vault.ledger_accounts as { balance?: number } | null;
  const balance = ledgerObj?.balance ?? 0;

  return NextResponse.json({
    vault: {
      student_id: vault.student_id,
      school_id: vault.school_id,
      vault_balance: balance,
      savings_goal_name: vault.savings_goal_name,
      savings_goal_target: vault.savings_goal_target,
      updated_at: vault.updated_at,
    },
  });
}
