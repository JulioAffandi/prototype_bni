import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Database, merchant_status_t } from "@/types/database";

type MerchantUpdatePayload = Database["public"]["Tables"]["merchants"]["Update"];

const MerchantProfileUpdateSchema = z.object({
  stall_name: z.string().min(2).optional(),
  bni_settlement_account: z.string().optional(),
  is_active: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: merchantId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json() as unknown;
  const parsed = MerchantProfileUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const updateData: MerchantUpdatePayload = {};

  if (parsed.data.stall_name) updateData.name = parsed.data.stall_name;
  if (parsed.data.bni_settlement_account) updateData.bni_merchant_account = parsed.data.bni_settlement_account;
  if (parsed.data.is_active !== undefined) {
    updateData.status = (parsed.data.is_active ? "active" : "suspended") as merchant_status_t;
  }

  updateData.updated_at = new Date().toISOString();

  const { error: updateErr } = await service
    .from("merchants")
    .update(updateData)
    .eq("id", merchantId);

  if (updateErr) {
    return NextResponse.json({ error: "UPDATE_FAILED", detail: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Profil Merchant berhasil diperbarui!" });
}
