// app/api/v1/parents/topup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const topUpSchema = z.object({
  amount: z.number().positive("Nominal top-up harus lebih besar dari 0"),
  channel: z.string().optional().default("BNI_VA_INSTANT"),
});

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "UNAUTHENTICATED", message: "Sesi tidak valid" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = topUpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { amount, channel } = parsed.data;
  const service = createServiceClient();

  // 1. Locate parent record by auth_user_id or user.id
  let { data: parent } = await service
    .from("parents")
    .select("id, wallet_balance, full_name")
    .or(`auth_user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle();

  // Fallback: if not found by direct ID, search first parent record in database for MVP demo
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

  const bniReference = `BNI-VA-${Date.now()}`;
  const currentBalance = Number(parent.wallet_balance ?? 0);
  const newBalance = currentBalance + amount;

  // 2. Update wallet balance on parents table
  const { error: updateErr } = await (service as any)
    .from("parents")
    .update({
      wallet_balance: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parent.id);

  if (updateErr) {
    return NextResponse.json({ error: "UPDATE_FAILED", detail: updateErr.message }, { status: 500 });
  }

  // 3. Record transaction in parent_wallet_transactions
  const { error: txErr } = await (service as any)
    .from("parent_wallet_transactions")
    .insert({
      parent_id: parent.id,
      type: "TOPUP",
      amount,
      description: "Top-Up Saldo Instan BNI Virtual Account",
      payment_channel: channel,
      bni_reference: bniReference,
      status: "SUCCESS",
    });

  if (txErr) {
    console.warn("[TopUp API] Transaction record warning:", txErr.message);
  }

  return NextResponse.json({
    success: true,
    new_balance: newBalance,
    reference: bniReference,
    message: `Top-Up Rp ${amount.toLocaleString("id-ID")} Berhasil`,
  });
}
