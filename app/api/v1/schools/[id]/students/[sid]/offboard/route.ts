import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/v1/schools/[id]/students/[sid]/offboard
 * Offboards a student (graduated or transferred).
 * Deactivates card, disbursses vault balance to parent's account.
 * Reference: PRODUCT_SPECIFICATION_v2.md §12.4, §9.2
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> },
) {
  const { id: schoolId, sid: studentId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .single();

  const profile = profileData as { role: string; school_id: string | null } | null;

  if (!profile || profile.role !== "school_admin" || profile.school_id !== schoolId) {
    return NextResponse.json({ error: "RLS_FORBIDDEN" }, { status: 403 });
  }

  const body = await _request.json().catch(() => ({})) as { reason?: string };
  const cardStatus = body.reason === "transfer" ? "transferred_out" : "graduated";

  const service = createServiceClient();

  // Step 1: Deactivate card
  await service
    .from("students")
    .update({ card_status: cardStatus })
    .eq("id", studentId)
    .eq("school_id", schoolId);

  // Step 2: Check vault balance
  const { data: vault } = await service
    .from("student_vault")
    .select("vault_balance, id")
    .eq("student_id", studentId)
    .single();

  let vaultDisbursed = false;
  if (vault && vault.vault_balance > 0) {
    // Record vault disbursal in ledger (double-entry: student_vault DEBIT, parent CREDIT)
    await service.from("wallet_ledger").insert([
      {
        account_type: "student_vault",
        account_ref_id: studentId,
        entry_type: "DEBIT",
        amount: vault.vault_balance,
        balance_after: 0,
        reference_table: "card_lifecycle_events",
        reference_id: studentId,
      },
    ]);

    // Zero out vault
    await service.from("student_vault").update({ vault_balance: 0 }).eq("id", vault.id);
    vaultDisbursed = true;
  }

  // Step 3: Lifecycle event (§12.4)
  await service.from("card_lifecycle_events").insert({
    student_id: studentId,
    event_type: "offboarded",
    notes: `Offboarding: ${cardStatus}. Vault disbursed: ${vaultDisbursed}`,
    actor_profile_id: user.id,
  });

  await service.from("audit_log").insert({
    actor_profile_id: user.id,
    action: "STUDENT_OFFBOARDED",
    entity_type: "students",
    entity_id: studentId,
    metadata: {
      school_id: schoolId,
      card_status: cardStatus,
      vault_disbursed: vaultDisbursed,
      vault_amount: vault?.vault_balance ?? 0,
    },
  });

  return NextResponse.json({
    student_id: studentId,
    card_status: cardStatus,
    vault_disbursed: vaultDisbursed,
    vault_amount_disbursed: vault?.vault_balance ?? 0,
  });
}
