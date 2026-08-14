import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/ai/tools/parent/spending
 * Parent AI tool: child spending breakdown by food category.
 * Reference: PRODUCT_SPECIFICATION_v2.md §10.3
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { data: profileData } = await supabase
    .from("profiles")
    .select("parent_id, role")
    .eq("id", user.id)
    .single();

  const profile = profileData as { parent_id: string | null; role: string } | null;

  if (!profile || profile.role !== "parent" || !profile.parent_id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const studentId = request.nextUrl.searchParams.get("student_id");
  const dateFrom = request.nextUrl.searchParams.get("date_from");
  const dateTo = request.nextUrl.searchParams.get("date_to");

  // Verify guardianship
  const { data: guardian } = await supabase
    .from("guardian_student_map")
    .select("id")
    .eq("parent_id", profile.parent_id)
    .eq("student_id", studentId ?? "")
    .single();

  if (!guardian) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { data: transactionsData } = await supabase
    .from("canteen_transactions")
    .select("amount, items, created_at, is_emergency")
    .eq("student_id", studentId ?? "")
    .gte("created_at", `${dateFrom}T00:00:00`)
    .lte("created_at", `${dateTo}T23:59:59`)
    .in("status", ["SETTLED", "SETTLED_OVERDRAFT", "COMPLETED"]);

  const transactions = transactionsData as Array<{
    amount: number;
    items: Array<{ menu: string; qty: number; price: number }> | null;
    created_at: string;
    is_emergency: boolean;
  }> | null;

  // Aggregate by category (based on item names — would be enriched by menu category in production)
  const categoryMap = new Map<string, { count: number; total: number }>();
  let totalSpent = 0;

  for (const tx of transactions ?? []) {
    totalSpent += tx.amount;
    const items = tx.items as { menu: string; qty: number; price: number }[] | null;
    if (items) {
      for (const item of items) {
        const cat = categorizeMenu(item.menu);
        const existing = categoryMap.get(cat) ?? { count: 0, total: 0 };
        categoryMap.set(cat, {
          count: existing.count + item.qty,
          total: existing.total + item.qty * item.price,
        });
      }
    }
  }

  const breakdown = Array.from(categoryMap.entries()).map(([category, stats]) => ({
    category,
    item_count: stats.count,
    total_idr: stats.total,
    pct_of_spending: totalSpent > 0 ? Math.round((stats.total / totalSpent) * 100) : 0,
  })).sort((a, b) => b.total_idr - a.total_idr);

  return NextResponse.json({
    student_id: studentId,
    period: { from: dateFrom, to: dateTo },
    total_spent_idr: totalSpent,
    transaction_count: (transactions ?? []).length,
    emergency_count: (transactions ?? []).filter((t) => t.is_emergency).length,
    spending_breakdown: breakdown,
    disclaimer: "Kategori menu bersifat estimasi. Konsultasikan pola makan dengan ahli gizi.",
  });
}

/** Simple heuristic categorizer — in production, enriched from menu master data */
function categorizeMenu(menuName: string): string {
  const name = menuName.toLowerCase();
  if (name.includes("nasi") || name.includes("mie") || name.includes("bakso") || name.includes("soto")) return "Makanan Berat";
  if (name.includes("teh") || name.includes("jus") || name.includes("air") || name.includes("susu")) return "Minuman";
  if (name.includes("gorengan") || name.includes("tempe") || name.includes("tahu") || name.includes("ayam")) return "Lauk";
  if (name.includes("kue") || name.includes("snack") || name.includes("roti") || name.includes("biskuit")) return "Snack";
  return "Lainnya";
}
