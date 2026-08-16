// app/api/v1/schools/[id]/payroll/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PayrollBatchExecuteResponse } from "@/types/institution";

export const dynamic = "force-dynamic";

const executeBatchSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format periode harus YYYY-MM"),
  idempotency_key: z.string().uuid(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: schoolId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const searchParams = req.nextUrl.searchParams;
  const period = searchParams.get("period") ?? new Date().toISOString().slice(0, 7);

  const { data, error } = await (supabase as any)
    .from("institution_payroll")
    .select("*")
    .eq("school_id", schoolId)
    .eq("period", period)
    .order("staff_name");

  if (error) {
    return NextResponse.json({ error: "QUERY_FAILED", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ period, roster: data });
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
  const parsed = executeBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data, error } = await (supabase as any).rpc("fn_execute_payroll_batch", {
    p_idempotency_key: parsed.data.idempotency_key,
    p_school_id: schoolId,
    p_period: parsed.data.period,
  });

  if (error) {
    return NextResponse.json({ error: "RPC_FAILED", detail: error.message }, { status: 500 });
  }

  const result = data as PayrollBatchExecuteResponse & { error?: string; http_status?: number };
  if (result.error) {
    return NextResponse.json(result, { status: result.http_status ?? 400 });
  }

  return NextResponse.json(result, { status: 200 });
}
