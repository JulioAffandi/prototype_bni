import { createServiceClient } from "@/lib/supabase/service";
import { verifySnapWebhook } from "@/lib/snap";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/webhooks/bni/h2h/debit-callback
 * Inbound BNI H2H webhook for SPP debit status.
 * Verifies SNAP BI HMAC signature before processing.
 * Reference: PRODUCT_SPECIFICATION_v2.md §9.1, §9.2, §11.3, §5.4
 */
export async function POST(request: NextRequest) {
  const body = await request.text();

  // ── SNAP BI Signature Verification (§9.1) ────────────────────
  const verification = verifySnapWebhook({
    headers: {
      "x-signature": request.headers.get("x-signature"),
      "x-timestamp": request.headers.get("x-timestamp"),
      "x-client-key": request.headers.get("x-client-key"),
    },
    body,
    relativePath: "/api/webhooks/bni/h2h/debit-callback",
  });

  if (!verification.valid) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: verification.reason },
      { status: 401 },
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const { referenceNo, originalReferenceNo, responseCode, amount } = payload as {
    referenceNo: string;
    originalReferenceNo: string;
    responseCode: string;
    amount: { value: string; currency: string };
  };

  const service = createServiceClient();

  // Find invoice by BNI reference
  const { data: invoice } = await service
    .from("spp_invoices")
    .select("id, student_id, school_id, amount, status, retry_count")
    .eq("bni_h2h_reference", originalReferenceNo)
    .single();

  if (!invoice) {
    // Log unknown reference but return 200 to BNI (avoid retry storm)
    console.warn("[BNI Webhook] Invoice not found for reference:", originalReferenceNo);
    return NextResponse.json({ responseCode: "00", responseMessage: "Success" });
  }

  const isSuccess = responseCode === "00" || responseCode === "2007300";

  if (isSuccess) {
    // Mark PAID + record ledger double-entry
    await service.from("spp_invoices").update({
      status: "PAID",
      paid_at: new Date().toISOString(),
      bni_h2h_reference: referenceNo ?? originalReferenceNo,
    }).eq("id", invoice.id);

    // Double-entry ledger (parent debit, school escrow credit)
    const paidAmount = parseFloat(amount?.value ?? String(invoice.amount));
    await service.from("wallet_ledger").insert([
      {
        account_type: "parent",
        account_ref_id: invoice.student_id,
        entry_type: "DEBIT",
        amount: paidAmount,
        balance_after: 0,
        reference_table: "spp_invoices",
        reference_id: invoice.id,
      },
      {
        account_type: "school_escrow",
        account_ref_id: invoice.school_id,
        entry_type: "CREDIT",
        amount: paidAmount,
        balance_after: 0,
        reference_table: "spp_invoices",
        reference_id: invoice.id,
      },
    ]);

    await service.from("audit_log").insert({
      action: "SPP_PAID",
      entity_type: "spp_invoices",
      entity_id: invoice.id,
      metadata: { bni_reference: referenceNo, amount: paidAmount },
    });
  } else {
    // Failed — increment retry count
    const newRetryCount = (invoice.retry_count ?? 0) + 1;
    const newStatus = newRetryCount >= 3 ? "OVERDUE" : "FAILED";

    await service.from("spp_invoices").update({
      status: newStatus,
      retry_count: newRetryCount,
    }).eq("id", invoice.id);

    await service.from("audit_log").insert({
      action: "SPP_DEBIT_FAILED",
      entity_type: "spp_invoices",
      entity_id: invoice.id,
      metadata: {
        bni_response_code: responseCode,
        retry_count: newRetryCount,
        new_status: newStatus,
      },
    });
  }

  // SNAP BI standard response
  return NextResponse.json({ responseCode: "00", responseMessage: "Success" });
}
