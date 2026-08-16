// app/api/v1/schools/[id]/financial/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { calculateMonthlyInstallment } from "@/lib/finance/calculations";

export const dynamic = "force-dynamic";

const creditApplicationSchema = z.object({
  resource: z.literal("credit"),
  plafon_amount: z.number().positive(),
  tenor_months: z.number().int().min(1).max(120),
  purpose: z.string().min(10),
  estimated_interest_rate: z.number().nonnegative().default(9.5),
});

const investmentSchema = z.object({
  resource: z.literal("investment"),
  investment_type: z.enum(["BNI_DEPOSITO", "SUKUK_NEGARA", "REKSADANA_PASAR_UANG"]),
  principal_amount: z.number().positive(),
  expected_yield_rate: z.number().nonnegative(),
  placement_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  maturity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const postFinancialSchema = z.discriminatedUnion("resource", [
  creditApplicationSchema,
  investmentSchema,
]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: schoolId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const [creditRes, investmentRes] = await Promise.all([
    (supabase as any)
      .from("institution_credit_applications")
      .select("*")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false }),
    (supabase as any)
      .from("institution_investments")
      .select("*")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false }),
  ]);

  if (creditRes.error) {
    return NextResponse.json({ error: "CREDIT_QUERY_FAILED", detail: creditRes.error.message }, { status: 500 });
  }

  if (investmentRes.error) {
    return NextResponse.json({ error: "INVESTMENT_QUERY_FAILED", detail: investmentRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    credit_applications: creditRes.data,
    investments: investmentRes.data,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: schoolId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = postFinancialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.resource === "credit") {
    // Server-side calculation of monthly installment
    const installment = calculateMonthlyInstallment(
      parsed.data.plafon_amount,
      parsed.data.estimated_interest_rate,
      parsed.data.tenor_months
    );

    const { data, error } = await (supabase as any)
      .from("institution_credit_applications")
      .insert({
        school_id: schoolId,
        plafon_amount: parsed.data.plafon_amount,
        tenor_months: parsed.data.tenor_months,
        purpose: parsed.data.purpose,
        estimated_interest_rate: parsed.data.estimated_interest_rate,
        estimated_monthly_installment: installment,
        status: "SUBMITTED",
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "INSERT_FAILED", detail: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } else {
    const { data, error } = await (supabase as any)
      .from("institution_investments")
      .insert({
        school_id: schoolId,
        investment_type: parsed.data.investment_type,
        principal_amount: parsed.data.principal_amount,
        expected_yield_rate: parsed.data.expected_yield_rate,
        placement_date: parsed.data.placement_date,
        maturity_date: parsed.data.maturity_date ?? null,
        status: "ACTIVE",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "INSERT_FAILED", detail: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  }
}
