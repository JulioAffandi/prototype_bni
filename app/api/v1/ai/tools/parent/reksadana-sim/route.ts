import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/ai/tools/parent/reksadana-sim
 * Simulates projected value of BNI Reksa Dana / wondr Growth allocation (Schema v3).
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const appMetadata = user.app_metadata || {};
  const userRoles: string[] = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];

  const service = createServiceClient();
  const isParentUser = userRoles.includes("parent") || userRoles.includes("platform_admin");

  if (!isParentUser) {
    const { data: roles } = await service
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .is("revoked_at", null);

    const hasAccess = roles?.some((r) => r.role === "parent");
    if (!hasAccess) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
  }

  const amount = parseFloat(request.nextUrl.searchParams.get("amount") ?? "0");
  if (amount <= 0) {
    return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const SCENARIOS = [
    { name: "Konservatif (BNI Dana Pasar Uang)", annual_return_pct: 4.5, horizon_months: 12 },
    { name: "Moderat (BNI Dana Pendapatan Tetap)", annual_return_pct: 7.0, horizon_months: 12 },
    { name: "wondr Growth (Estimasi)", annual_return_pct: 6.2, horizon_months: 12 },
  ];

  const projections = SCENARIOS.map((s) => {
    const periodReturn = amount * (s.annual_return_pct / 100) * (s.horizon_months / 12);
    return {
      product: s.name,
      horizon_months: s.horizon_months,
      estimated_return_pct: s.annual_return_pct,
      projected_gain_idr: Math.round(periodReturn),
      projected_total_idr: Math.round(amount + periodReturn),
    };
  });

  return NextResponse.json({
    disclaimer: "Proyeksi bersifat ilustratif berdasarkan kinerja historis. Reksa dana memiliki risiko. Hasil masa lalu tidak menjamin hasil masa depan. Ini bukan nasihat keuangan resmi.",
    allocation_amount_idr: amount,
    projections,
  });
}
