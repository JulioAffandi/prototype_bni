import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/ai/tools/school/deposito-sim
 * Simulates BNI Deposito yield for idle school funds.
 * Reference: PRODUCT_SPECIFICATION_v2.md §10.2
 * Rates are illustrative — must be replaced with live BNI API rates in production.
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { data: profileData } = await supabase
    .from("profiles")
    .select("school_id, role")
    .eq("id", user.id)
    .single();

  const profile = profileData as { school_id: string | null; role: string } | null;

  if (!profile || profile.role !== "school_admin") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const schoolId = request.nextUrl.searchParams.get("school_id");
  if (schoolId !== profile.school_id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const amount = parseFloat(request.nextUrl.searchParams.get("amount") ?? "0");
  const tenor = parseInt(request.nextUrl.searchParams.get("tenor") ?? "3");

  if (amount <= 0) {
    return NextResponse.json({ error: "INVALID_PAYLOAD", message: "Amount harus lebih dari 0" }, { status: 400 });
  }

  // Illustrative BNI Deposito rates (% per annum) — replace with live API
  const RATE_TABLE: Record<number, number> = {
    1: 3.25,
    3: 3.50,
    6: 3.75,
    12: 4.00,
  };

  const annualRate = RATE_TABLE[tenor] ?? 3.50;
  const periodRate = annualRate * (tenor / 12);
  const grossYield = amount * (periodRate / 100);
  const taxRate = 0.2; // PPh Pasal 4(2) 20%
  const netYield = grossYield * (1 - taxRate);
  const maturityValue = amount + netYield;

  return NextResponse.json({
    disclaimer: "Ilustrasi. Tingkat bunga aktual mengikuti ketentuan BNI berlaku. Bukan nasihat keuangan resmi.",
    input: { amount_idr: amount, tenor_months: tenor },
    rate: {
      annual_pct: annualRate,
      period_pct: parseFloat(periodRate.toFixed(4)),
    },
    projection: {
      gross_yield_idr: Math.round(grossYield),
      tax_idr: Math.round(grossYield * taxRate),
      net_yield_idr: Math.round(netYield),
      maturity_value_idr: Math.round(maturityValue),
    },
    max_recommended_allocation_pct: 40,
    max_recommended_amount_idr: Math.round(amount * 0.4),
  });
}
