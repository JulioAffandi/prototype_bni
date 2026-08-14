import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import type { TransactionItem } from "@/types/database";

/**
 * GET /api/v1/ai/tools/merchant/top-selling
 * Tool data endpoint for Merchant AI — top selling menu items (Schema v3).
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const appMetadata = user.app_metadata || {};
  const userRoles: string[] = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
  const userMerchantIds: string[] = Array.isArray(appMetadata.merchant_ids) ? appMetadata.merchant_ids : [];

  const service = createServiceClient();
  const merchantId = userMerchantIds[0] || "";

  const isMerchantUser = userRoles.includes("merchant_staff") || userRoles.includes("merchant_owner") || userRoles.includes("platform_admin");

  if (!isMerchantUser && merchantId) {
    const { data: roles } = await service
      .from("user_roles")
      .select("role, merchant_id")
      .eq("user_id", user.id)
      .is("revoked_at", null);

    const hasAccess = roles?.some(
      (r) => r.role === "merchant_staff" || r.role === "merchant_owner",
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
  }

  const days = parseInt(request.nextUrl.searchParams.get("days") ?? "7");
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data: transactions } = await service
    .from("canteen_transactions")
    .select("items, amount")
    .eq("merchant_id", merchantId)
    .gte("created_at", since)
    .eq("status", "SETTLED");

  // Aggregate menu items
  const menuMap = new Map<string, { qty: number; revenue: number }>();
  for (const tx of transactions ?? []) {
    const items = tx.items as unknown as TransactionItem[] | null;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const existing = menuMap.get(item.menu) ?? { qty: 0, revenue: 0 };
      menuMap.set(item.menu, {
        qty: existing.qty + item.qty,
        revenue: existing.revenue + item.qty * item.price,
      });
    }
  }

  const topItems = Array.from(menuMap.entries())
    .map(([menu, stats]) => ({ menu, ...stats }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  return NextResponse.json({ period_days: days, top_selling: topItems });
}
