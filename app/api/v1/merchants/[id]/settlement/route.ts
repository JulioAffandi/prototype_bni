import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/merchants/[id]/settlement
 * Returns daily settlement summary for a merchant.
 * Reference: PRODUCT_SPECIFICATION_v2.md §4.2 Stage 3, §9.2
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, merchant_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "merchant_staff" || profile.merchant_id !== merchantId) {
    return NextResponse.json({ error: "RLS_FORBIDDEN" }, { status: 403 });
  }

  const date = request.nextUrl.searchParams.get("date") ??
    new Date().toISOString().split("T")[0];

  const { data: txList } = await supabase
    .from("canteen_transactions")
    .select("id, amount, status, is_emergency, created_at")
    .eq("merchant_id", merchantId)
    .gte("created_at", `${date}T00:00:00`)
    .lte("created_at", `${date}T23:59:59`);

  const settled = (txList ?? []).filter((t) =>
    ["SETTLED", "SETTLED_OVERDRAFT", "COMPLETED"].includes(t.status)
  );
  const offlineQueued = (txList ?? []).filter((t) => t.status === "OFFLINE_QUEUED");
  const rejected = (txList ?? []).filter((t) =>
    ["REJECTED_OVERLIMIT", "REJECTED_POST_HOC"].includes(t.status)
  );

  return NextResponse.json({
    date,
    merchant_id: merchantId,
    summary: {
      total_revenue: settled.reduce((s, t) => s + t.amount, 0),
      settled_count: settled.length,
      rejected_count: rejected.length,
      offline_queued_count: offlineQueued.length,
      emergency_count: settled.filter((t) => t.is_emergency).length,
    },
    transactions: txList ?? [],
  });
}
