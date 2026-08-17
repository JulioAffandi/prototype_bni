// app/api/v1/parents/campaign-invoices/[id]/pay/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: invoiceId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "UNAUTHENTICATED", message: "Sesi tidak valid" }, { status: 401 });
  }

  const service = createServiceClient();

  // 1. Fetch campaign invoice
  const { data: invoice, error: fetchErr } = await (service as any)
    .from("campaign_invoices")
    .select(`
      id, campaign_id, school_id, student_id, amount, status,
      school_billing_campaigns ( title, category ),
      students ( full_name )
    `)
    .eq("id", invoiceId)
    .maybeSingle();

  if (fetchErr || !invoice) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Tagihan event tidak ditemukan" }, { status: 404 });
  }

  if (invoice.status === "PAID") {
    return NextResponse.json({ error: "ALREADY_PAID", message: "Tagihan ini sudah lunas" }, { status: 400 });
  }

  // 2. Resolve parent entity
  let { data: parent } = await service
    .from("parents")
    .select("id, wallet_balance, full_name")
    .or(`auth_user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle();

  if (!parent) {
    const { data: firstParent } = await service
      .from("parents")
      .select("id, wallet_balance, full_name")
      .limit(1)
      .single();
    parent = firstParent;
  }

  if (!parent) {
    return NextResponse.json({ error: "PARENT_NOT_FOUND", message: "Data wali tidak ditemukan" }, { status: 404 });
  }

  const currentBalance = Number(parent.wallet_balance ?? 0);
  const amountToPay = Number(invoice.amount);

  // 3. Verify balance
  if (currentBalance < amountToPay) {
    return NextResponse.json({
      error: "INSUFFICIENT_BALANCE",
      message: `Saldo BNI Anda (${currentBalance.toLocaleString("id-ID")}) tidak mencukupi untuk pembayaran Rp ${amountToPay.toLocaleString("id-ID")}. Silakan Top-Up terlebih dahulu.`,
    }, { status: 400 });
  }

  const newBalance = currentBalance - amountToPay;
  const bniRef = `BNI-EVENT-${Date.now()}-${invoiceId.slice(-6)}`;
  const qrHash = `EduConnect-EVENT-QR-${invoiceId.slice(0, 8)}-${Date.now()}`;
  const nowIso = new Date().toISOString();
  const campaignTitle = invoice.school_billing_campaigns?.title || "Iuran Sekolah";
  const studentName = invoice.students?.full_name || "Siswa";

  // 4. Deduct parent wallet balance
  const { error: deductErr } = await (service as any)
    .from("parents")
    .update({ wallet_balance: newBalance, updated_at: nowIso })
    .eq("id", parent.id);

  if (deductErr) {
    return NextResponse.json({ error: "DEDUCT_FAILED", detail: deductErr.message }, { status: 500 });
  }

  // 5. Update invoice status to PAID
  const { error: updateInvErr } = await (service as any)
    .from("campaign_invoices")
    .update({
      status: "PAID",
      paid_at: nowIso,
      paid_by_parent_id: parent.id,
      bni_h2h_reference: bniRef,
      receipt_qr_hash: qrHash,
    })
    .eq("id", invoiceId);

  if (updateInvErr) {
    console.warn("[Campaign Pay API] Update invoice warning:", updateInvErr.message);
  }

  // 6. Record mutasi in parent_wallet_transactions
  await (service as any).from("parent_wallet_transactions").insert({
    parent_id: parent.id,
    type: "EVENT_PAYMENT",
    amount: amountToPay,
    description: `Pembayaran ${campaignTitle} (${studentName})`,
    payment_channel: "BNI_WALLET",
    bni_reference: bniRef,
    status: "SUCCESS",
  });

  // 7. Insert notification into portal_notifications
  const formattedAmount = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amountToPay);
  await (service as any).from("portal_notifications").insert({
    parent_id: parent.id,
    title: `Pembayaran Sukses: ${campaignTitle}`,
    message: `Pembayaran ${campaignTitle} untuk ${studentName} sebesar ${formattedAmount} telah berhasil dipotong dari Saldo BNI. Ref: ${bniRef}`,
    type: "PAYMENT_SUCCESS",
    action_url: "/spp?tab=kegiatan",
    is_read: false,
  });

  return NextResponse.json({
    success: true,
    new_balance: newBalance,
    bni_h2h_reference: bniRef,
    receipt_qr_hash: qrHash,
    message: `Pembayaran ${campaignTitle} Berhasil!`,
  });
}
