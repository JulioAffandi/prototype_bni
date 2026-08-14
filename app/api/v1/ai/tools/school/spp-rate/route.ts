import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/ai/tools/school/spp-rate
 * Tool data endpoint for School Treasury AI — SPP collection rate (Schema v3).
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const appMetadata = user.app_metadata || {};
  const userRoles: string[] = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
  const userSchoolIds: string[] = Array.isArray(appMetadata.school_ids) ? appMetadata.school_ids : [];

  const targetSchoolId = request.nextUrl.searchParams.get("school_id") || userSchoolIds[0];

  const service = createServiceClient();
  const isAuthorized = (userRoles.includes("school_admin") || userRoles.includes("school_treasurer") || userRoles.includes("platform_admin")) &&
    (userSchoolIds.includes(targetSchoolId || "") || userRoles.includes("platform_admin"));

  if (!isAuthorized && targetSchoolId) {
    const { data: roles } = await service
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", user.id)
      .is("revoked_at", null);

    const hasAccess = roles?.some(
      (r) => (r.role === "school_admin" || r.role === "school_treasurer") && r.school_id === targetSchoolId,
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
  }

  const period = request.nextUrl.searchParams.get("period") ??
    new Date().toISOString().slice(0, 7);

  const { data: invoices } = await service
    .from("spp_invoices")
    .select("status, amount, amount_paid")
    .eq("school_id", targetSchoolId ?? "")
    .eq("period", period);

  const list = invoices ?? [];
  const total = list.length;
  const paid = list.filter((i) => i.status === "PAID").length;
  const failed = list.filter((i) => i.status === "FAILED" || i.status === "OVERDUE").length;
  const totalAmount = list.reduce((s, i) => s + i.amount, 0);
  const paidAmount = list.filter((i) => i.status === "PAID").reduce((s, i) => s + (i.amount_paid || i.amount), 0);

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
