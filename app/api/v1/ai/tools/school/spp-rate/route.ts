import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/ai/tools/school/spp-rate
 * Tool data endpoint for School Treasury AI — SPP collection rate.
 * Reference: PRODUCT_SPECIFICATION_v2.md §10.2
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "school_admin") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const schoolId = request.nextUrl.searchParams.get("school_id");
  if (schoolId !== profile.school_id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const period = request.nextUrl.searchParams.get("period") ??
    new Date().toISOString().slice(0, 7);

  const { data: invoices } = await supabase
    .from("spp_invoices")
    .select("status, amount")
    .eq("school_id", schoolId ?? "")
    .eq("period", period);

  const total = (invoices ?? []).length;
  const paid = (invoices ?? []).filter((i) => i.status === "PAID").length;
  const failed = (invoices ?? []).filter((i) => ["FAILED", "OVERDUE"].includes(i.status)).length;
  const totalAmount = (invoices ?? []).reduce((s, i) => s + i.amount, 0);
  const paidAmount = (invoices ?? []).filter((i) => i.status === "PAID").reduce((s, i) => s + i.amount, 0);

  return NextResponse.json({
    period,
    total_students: total,
    paid_count: paid,
    failed_count: failed,
    collection_rate_pct: total > 0 ? Math.round((paid / total) * 100) : 0,
    total_amount_idr: totalAmount,
    collected_amount_idr: paidAmount,
    outstanding_amount_idr: totalAmount - paidAmount,
  });
}
