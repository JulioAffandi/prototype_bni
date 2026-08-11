import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/ai/tools/merchant/sales-summary
 * Tool data endpoint for Merchant AI — daily sales summary.
 * Reference: PRODUCT_SPECIFICATION_v2.md §10.1
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("merchant_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "merchant_staff") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const merchantId = params.get("merchant_id") ?? profile.merchant_id ?? "";
  const dateFrom = params.get("date_from") ?? new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const dateTo = params.get("date_to") ?? new Date().toISOString().split("T")[0];

  if (merchantId !== profile.merchant_id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { data: transactions } = await supabase
    .from("canteen_transactions")
    .select("amount, status, is_emergency, created_at")
    .eq("merchant_id", merchantId)
    .gte("created_at", `${dateFrom}T00:00:00`)
    .lte("created_at", `${dateTo}T23:59:59`)
    .in("status", ["SETTLED", "SETTLED_OVERDRAFT", "COMPLETED"]);

  const totalRevenue = (transactions ?? []).reduce((s, t) => s + t.amount, 0);
  const txCount = (transactions ?? []).length;
  const emergencyCount = (transactions ?? []).filter((t) => t.is_emergency).length;

  return NextResponse.json({
    period: { from: dateFrom, to: dateTo },
    total_revenue: totalRevenue,
    transaction_count: txCount,
    emergency_transactions: emergencyCount,
    avg_per_transaction: txCount > 0 ? Math.round(totalRevenue / txCount) : 0,
  });
}
