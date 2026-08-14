import { createServiceClient } from "@/lib/supabase/service";
import { verifySnapWebhook } from "@/lib/snap";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/webhooks/bni/h2h/debit-callback
 * Inbound BNI H2H webhook for SPP debit status.
 * Verifies SNAP BI HMAC signature before processing.
 * Reference: Schema v3 §9 (spp_invoices) & §6 (double-entry ledger)
 */
export async function POST(request: NextRequest) {
  const body = await request.text();

  // ── SNAP BI Signature Verification ──────────────────────────
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
    .select("id, student_id, school_id, billed_parent_id, amount, status, retry_count")
    .eq("bni_h2h_reference", originalReferenceNo)
    .single();

  if (!invoice) {
    console.warn("[BNI Webhook] Invoice not found for reference:", originalReferenceNo);
    return NextResponse.json({ responseCode: "00", responseMessage: "Success" });
  }

  const isSuccess = responseCode === "00" || responseCode === "2007300";

  if (isSuccess) {
    const paidAmount = parseFloat(amount?.value ?? String(invoice.amount));
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    // 1. Mark invoice as PAID
    await service.from("spp_invoices").update({
      status: "PAID",
      amount_paid: paidAmount,
      paid_at: now,
      bni_h2h_reference: referenceNo ?? originalReferenceNo,
      updated_at: now,
    }).eq("id", invoice.id);

    // 2. Double-entry Ledger Posting (parent_funding -> school_escrow)
    try {
      // Find or create parent funding account
      let parentAcctId: string | null = null;
      if (invoice.billed_parent_id) {
        const { data: parentAcct } = await service
          .from("ledger_accounts")
          .select("id")
          .eq("account_type", "parent_funding")
          .eq("owner_parent_id", invoice.billed_parent_id)
          .maybeSingle();

        if (parentAcct) {
          parentAcctId = parentAcct.id;
        } else {
          const { data: newAcct } = await service.from("ledger_accounts").insert({
            account_type: "parent_funding",
            normal_balance: "CREDIT",
            currency_code: "IDR",
            owner_parent_id: invoice.billed_parent_id,
            balance: 0,
            last_entry_seq: 0,
          }).select("id").single();
          parentAcctId = newAcct?.id || null;
        }
      }

      // Find or create school escrow account
      let schoolAcctId: string | null = null;
      const { data: schoolAcct } = await service
        .from("ledger_accounts")
        .select("id")
        .eq("account_type", "school_escrow")
        .eq("owner_school_id", invoice.school_id)
        .maybeSingle();

      if (schoolAcct) {
        schoolAcctId = schoolAcct.id;
      } else {
        const { data: newAcct } = await service.from("ledger_accounts").insert({
          account_type: "school_escrow",
          normal_balance: "CREDIT",
          currency_code: "IDR",
          owner_school_id: invoice.school_id,
          balance: 0,
          last_entry_seq: 0,
        }).select("id").single();
        schoolAcctId = newAcct?.id || null;
      }

      if (parentAcctId && schoolAcctId) {
        // Record journal transaction
        const { data: txn } = await service.from("ledger_transactions").insert({
          source: "SPP_DEBIT",
          source_table: "spp_invoices",
          source_id: invoice.id,
          school_id: invoice.school_id,
          business_date: today,
          currency_code: "IDR",
          description: `SPP invoice payment via BNI H2H debit ref ${referenceNo}`,
        }).select("id").single();

        if (txn) {
          // Post journal entries: DEBIT parent_funding (+amount), CREDIT school_escrow (-amount)
          await service.from("ledger_entries").insert([
            {
              transaction_id: txn.id,
              account_id: parentAcctId,
              signed_amount: paidAmount,
              entry_seq: 1,
              balance_after: paidAmount,
            },
            {
              transaction_id: txn.id,
              account_id: schoolAcctId,
              signed_amount: -paidAmount,
              entry_seq: 1,
              balance_after: -paidAmount,
            },
          ]);

          await service.from("spp_invoices").update({
            ledger_transaction_id: txn.id,
          }).eq("id", invoice.id);
        }
      }
    } catch (e) {
      console.error("[BNI Webhook] Ledger posting warning:", e);
    }

    await service.from("audit_log").insert({
      school_id: invoice.school_id,
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
      updated_at: new Date().toISOString(),
    }).eq("id", invoice.id);

    await service.from("audit_log").insert({
      school_id: invoice.school_id,
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
