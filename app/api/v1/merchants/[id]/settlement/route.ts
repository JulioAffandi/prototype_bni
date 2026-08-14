import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/merchants/[id]/settlement
 * Returns daily settlement summary for a merchant (Schema v3).
 * Reference: Schema v3 §8 (canteen_transactions business_date)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: merchantId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const appMetadata = user.app_metadata || {};
  const userRoles: string[] = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
  const userMerchantIds: string[] = Array.isArray(appMetadata.merchant_ids) ? appMetadata.merchant_ids : [];

  const service = createServiceClient();

  const isMerchantUser = (userRoles.includes("merchant_staff") || userRoles.includes("merchant_owner") || userRoles.includes("platform_admin")) &&
    (userMerchantIds.includes(merchantId) || userRoles.includes("platform_admin"));

  if (!isMerchantUser) {
    const { data: roles } = await service
      .from("user_roles")
      .select("role, merchant_id")
      .eq("user_id", user.id)
      .is("revoked_at", null);

    const hasAccess = roles?.some(
      (r) => (r.role === "merchant_staff" || r.role === "merchant_owner") && r.merchant_id === merchantId,
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "RLS_FORBIDDEN" }, { status: 403 });
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const date = request.nextUrl.searchParams.get("date") ?? today;

  const { data: txList } = await service
    .from("canteen_transactions")
    .select("id, amount, status, is_emergency, settlement_status, created_at, business_date")
    .eq("merchant_id", merchantId)
    .eq("business_date", date);

  const list = txList || [];
  const settled = list.filter((t) => t.status === "SETTLED");
  const rejected = list.filter((t) =>
    t.status === "REJECTED_OVERLIMIT" || t.status === "REJECTED_CARD_BLOCKED" || t.status === "REJECTED_POST_HOC",
  );
  const pending = list.filter((t) => t.status === "PENDING");

  return NextResponse.json({
    date,
    merchant_id: merchantId,
    summary: {
      total_revenue: settled.reduce((s, t) => s + t.amount, 0),
      settled_count: settled.length,
      rejected_count: rejected.length,
      pending_count: pending.length,
      emergency_count: settled.filter((t) => t.is_emergency).length,
    },
    transactions: list,
  });
}
