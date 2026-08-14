import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/ai/tools/merchant/sales-summary
 * Tool data endpoint for Merchant AI — daily sales summary (Schema v3).
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const appMetadata = user.app_metadata || {};
  const userRoles: string[] = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
  const userMerchantIds: string[] = Array.isArray(appMetadata.merchant_ids) ? appMetadata.merchant_ids : [];

  const service = createServiceClient();
  const targetMerchantId = request.nextUrl.searchParams.get("merchant_id") || userMerchantIds[0] || "";

  const isMerchantUser = (userRoles.includes("merchant_staff") || userRoles.includes("merchant_owner") || userRoles.includes("platform_admin")) &&
    (userMerchantIds.includes(targetMerchantId) || userRoles.includes("platform_admin"));

  if (!isMerchantUser && targetMerchantId) {
    const { data: roles } = await service
      .from("user_roles")
      .select("role, merchant_id")
      .eq("user_id", user.id)
      .is("revoked_at", null);

    const hasAccess = roles?.some(
      (r) => (r.role === "merchant_staff" || r.role === "merchant_owner") && r.merchant_id === targetMerchantId,
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const params = request.nextUrl.searchParams;
  const dateFrom = params.get("date_from") ?? new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const dateTo = params.get("date_to") ?? todayStr;

  const { data: transactions } = await service
    .from("canteen_transactions")
    .select("amount, status, is_emergency, business_date")
    .eq("merchant_id", targetMerchantId)
    .gte("business_date", dateFrom)
    .lte("business_date", dateTo)
    .eq("status", "SETTLED");

  const list = transactions ?? [];
  const totalRevenue = list.reduce((s, t) => s + t.amount, 0);
  const txCount = list.length;
  const emergencyCount = list.filter((t) => t.is_emergency).length;

  return NextResponse.json({
    period: { from: dateFrom, to: dateTo },
    total_revenue: totalRevenue,
    transaction_count: txCount,
    emergency_transactions: emergencyCount,
    avg_per_transaction: txCount > 0 ? Math.round(totalRevenue / txCount) : 0,
  });
}
