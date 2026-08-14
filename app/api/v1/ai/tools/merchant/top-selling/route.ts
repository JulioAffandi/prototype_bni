import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/ai/tools/merchant/top-selling
 * Tool data endpoint for Merchant AI — top selling menu items.
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { data: profileData } = await supabase
    .from("profiles")
    .select("merchant_id, role")
    .eq("id", user.id)
    .single();

  const profile = profileData as { merchant_id: string | null; role: string } | null;

  if (!profile || profile.role !== "merchant_staff") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const days = parseInt(request.nextUrl.searchParams.get("days") ?? "7");
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data: transactionsData } = await supabase
    .from("canteen_transactions")
    .select("items, amount")
    .eq("merchant_id", profile.merchant_id ?? "")
    .gte("created_at", since)
    .in("status", ["SETTLED", "SETTLED_OVERDRAFT", "COMPLETED"]);

  const transactions = transactionsData as Array<{
    items: Array<{ menu: string; qty: number; price: number }> | null;
    amount: number;
  }> | null;

  // Aggregate menu items
  const menuMap = new Map<string, { qty: number; revenue: number }>();
  for (const tx of transactions ?? []) {
    const items = tx.items as { menu: string; qty: number; price: number }[] | null;
    if (!items) continue;
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
