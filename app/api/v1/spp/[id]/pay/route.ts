import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/v1/spp/[id]/pay
 * Simulates BNI H2H payment settlement for an SPP invoice (Schema v3).
 * Marks invoice as 'PAID', sets paid_at = now(), generates bni_h2h_reference, and logs audit.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: invoiceId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const service = createServiceClient();

  // Fetch target invoice
  const { data: invoice, error: fetchErr } = await service
    .from("spp_invoices")
    .select("id, school_id, student_id, period, amount, status")
    .eq("id", invoiceId)
    .maybeSingle();

  if (fetchErr || !invoice) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Tagihan SPP tidak ditemukan." }, { status: 404 });
  }

  if (invoice.status === "PAID") {
    return NextResponse.json(
      { error: "ALREADY_PAID", message: "Tagihan SPP ini sudah lunas." },
      { status: 400 },
    );
  }

  const bniRef = `BNI-H2H-PAY-${Date.now()}-${invoiceId.slice(-6)}`;
  const nowIso = new Date().toISOString();

  // Update invoice status to PAID
  const { data: updated, error: updateErr } = await (service as any)
    .from("spp_invoices")
    .update({
      status: "PAID",
      amount_paid: invoice.amount,
      paid_at: nowIso,
      bni_h2h_reference: bniRef,
    })
    .eq("id", invoiceId)
    .select("id, status, amount, amount_paid, paid_at, bni_h2h_reference")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: "UPDATE_FAILED", detail: updateErr?.message },
      { status: 500 },
    );
  }

  // Audit trail
  await service.from("audit_log").insert({
    school_id: invoice.school_id,
    actor_user_id: user.id,
    actor_role_snapshot: "parent",
    action: "SPP_INVOICE_PAID",
    entity_type: "spp_invoices",
    entity_id: invoiceId,
    metadata: { student_id: invoice.student_id, amount: invoice.amount, bni_h2h_reference: bniRef, timestamp: nowIso },
  });

  return NextResponse.json({
    success: true,
    invoice: updated,
  });
}
