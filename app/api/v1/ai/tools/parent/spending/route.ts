import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import type { TransactionItem } from "@/types/database";

/**
 * GET /api/v1/ai/tools/parent/spending
 * Parent AI tool: child spending breakdown by food category (Schema v3).
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const service = createServiceClient();

  const parentId = user.app_metadata?.parent_id as string | undefined;
  let resolvedParentId = parentId;

  if (!resolvedParentId) {
    const { data: profile } = await service
      .from("profiles")
      .select("parent_id")
      .eq("id", user.id)
      .maybeSingle();
    resolvedParentId = profile?.parent_id || undefined;
  }

  if (!resolvedParentId) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const studentId = request.nextUrl.searchParams.get("student_id");
  const dateFrom = request.nextUrl.searchParams.get("date_from") || "2026-01-01";
  const dateTo = request.nextUrl.searchParams.get("date_to") || new Date().toISOString().slice(0, 10);

  // Verify guardianship
  const { data: guardian } = await service
    .from("guardian_student_map")
    .select("id")
    .eq("parent_id", resolvedParentId)
    .eq("student_id", studentId ?? "")
    .eq("status", "active")
    .maybeSingle();

  if (!guardian) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { data: transactions } = await service
    .from("canteen_transactions")
    .select("amount, items, created_at, is_emergency, business_date")
    .eq("student_id", studentId ?? "")
    .gte("business_date", dateFrom)
    .lte("business_date", dateTo)
    .eq("status", "SETTLED");

  const list = transactions ?? [];

  // Aggregate by category
  const categoryMap = new Map<string, { count: number; total: number }>();
  let totalSpent = 0;

  for (const tx of list) {
    totalSpent += tx.amount;
    const items = tx.items as unknown as TransactionItem[] | null;
    if (Array.isArray(items)) {
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
    transaction_count: list.length,
    emergency_count: list.filter((t) => t.is_emergency).length,
    spending_breakdown: breakdown,
    disclaimer: "Kategori menu bersifat estimasi. Konsultasikan pola makan dengan ahli gizi.",
  });
}

function categorizeMenu(menuName: string): string {
  const name = menuName.toLowerCase();
  if (name.includes("nasi") || name.includes("mie") || name.includes("bakso") || name.includes("soto")) return "Makanan Berat";
  if (name.includes("teh") || name.includes("jus") || name.includes("air") || name.includes("susu")) return "Minuman";
  if (name.includes("gorengan") || name.includes("tempe") || name.includes("tahu") || name.includes("ayam")) return "Lauk";
  if (name.includes("kue") || name.includes("snack") || name.includes("roti") || name.includes("biskuit")) return "Snack";
  return "Lainnya";
}
