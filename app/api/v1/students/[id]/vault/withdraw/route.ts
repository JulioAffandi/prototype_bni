import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const WithdrawVaultSchema = z.object({
  amount: z.number().positive(),
  destination_account: z.string().optional(),
});

/**
 * POST /api/v1/students/[id]/vault/withdraw
 * Parent submits a Vault withdrawal request for a student under Dual Control (Schema v3).
 * Inserts request record into public.vault_withdrawal_requests and logs audit event.
 */
export async function POST(
  request: NextRequest,
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

  // Verify guardianship capability
  const { data: guardianship } = await service
    .from("guardian_student_map")
    .select("id, school_id, can_approve_vault")
    .eq("parent_id", resolvedParentId)
    .eq("student_id", studentId)
    .eq("status", "active")
    .maybeSingle();

  if (!guardianship || !guardianship.can_approve_vault) {
    return NextResponse.json({ error: "RLS_FORBIDDEN" }, { status: 403 });
  }

  const body = await request.json() as unknown;
  const parsed = WithdrawVaultSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { amount, destination_account } = parsed.data;

  // Verify available vault balance from ledger
  const { data: vault } = await service
    .from("student_vault")
    .select(`
      student_id, school_id, ledger_account_id,
      ledger_accounts ( balance )
    `)
    .eq("student_id", studentId)
    .maybeSingle();

  if (!vault) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Student Vault tidak ditemukan." }, { status: 404 });
  }

  const ledgerObj = vault.ledger_accounts as { balance?: number } | null;
  const availableBalance = ledgerObj?.balance ?? 0;

  if (amount > availableBalance) {
    return NextResponse.json(
      {
        error: "INSUFFICIENT_FUNDS",
        message: `Saldo Vault tidak mencukupi. Saldo tersedia: Rp ${availableBalance.toLocaleString("id-ID")}`,
      },
      { status: 400 },
    );
  }

  // Find parent BNI account if destination not provided
  let targetAccount = destination_account?.trim();
  if (!targetAccount) {
    const { data: parent } = await service
      .from("parents")
      .select("bni_account_number")
      .eq("id", resolvedParentId)
      .maybeSingle();
    targetAccount = parent?.bni_account_number || "REK-BNI-WALI";
  }

  const nowIso = new Date().toISOString();
  const expiresIso = new Date(Date.now() + 86400000).toISOString(); // 24 hours expiry

  const { data: withdrawal, error: withdrawError } = await service
    .from("vault_withdrawal_requests")
    .insert({
      student_id: studentId,
      requested_by: user.id,
      approved_by: user.id,
      amount,
      status: "PENDING_CONFIRM",
      destination_account: targetAccount,
      requested_at: nowIso,
      expires_at: expiresIso,
    })
    .select("id, student_id, amount, status, destination_account, requested_at")
    .single();

  if (withdrawError || !withdrawal) {
    return NextResponse.json(
      { error: "INSERT_FAILED", detail: withdrawError?.message },
      { status: 500 },
    );
  }

  // Audit trail
  await service.from("audit_log").insert({
    school_id: vault.school_id,
    actor_user_id: user.id,
    actor_role_snapshot: "parent",
    action: "VAULT_WITHDRAWAL_REQUESTED",
    entity_type: "vault_withdrawal_requests",
    entity_id: withdrawal.id,
    metadata: { student_id: studentId, amount, destination_account: targetAccount, timestamp: nowIso },
  });

  return NextResponse.json({
    success: true,
    withdrawal,
  });
}
