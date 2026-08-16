// app/api/v1/schools/[id]/procurement/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const createProcurementSchema = z.object({
  type: z.enum(["PURCHASE_ORDER", "REIMBURSEMENT"]),
  vendor_name: z.string().min(2),
  category: z.string().min(2),
  description: z.string().optional(),
  amount: z.number().positive(),
  receipt_file_path: z.string().optional(),
  claimed_by_name: z.string().optional(),
  claimed_by_phone: z.string().optional(),
  ocr_raw_json: z.any().optional(),
  ocr_confidence: z.number().optional(),
});

const resolveProcurementSchema = z.object({
  procurement_id: z.string().uuid(),
  decision: z.enum(["APPROVE", "REJECT"]),
  rejection_reason: z.string().optional(),
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
  const type = searchParams.get("type");
  const status = searchParams.get("status");

  let query = (supabase as any)
    .from("institution_procurement")
    .select("*")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  if (type) query = query.eq("type", type);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "QUERY_FAILED", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data });
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
  const parsed = createProcurementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const insertData = {
    school_id: schoolId,
    type: parsed.data.type,
    requested_by: user.id,
    claimed_by_name: parsed.data.claimed_by_name ?? null,
    claimed_by_phone: parsed.data.claimed_by_phone ?? null,
    vendor_name: parsed.data.vendor_name,
    category: parsed.data.category,
    description: parsed.data.description ?? null,
    amount: parsed.data.amount,
    status: "SUBMITTED",
    receipt_file_path: parsed.data.receipt_file_path ?? null,
    ocr_raw_json: parsed.data.ocr_raw_json ?? null,
    ocr_confidence: parsed.data.ocr_confidence ?? null,
  };

  const { data, error } = await (supabase as any)
    .from("institution_procurement")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "INSERT_FAILED", detail: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: schoolId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = resolveProcurementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data, error } = await (supabase as any).rpc("fn_resolve_procurement", {
    p_idempotency_key: parsed.data.idempotency_key,
    p_procurement_id: parsed.data.procurement_id,
    p_decision: parsed.data.decision,
    p_rejection_reason: parsed.data.rejection_reason ?? null,
  });

  if (error) {
    return NextResponse.json({ error: "RPC_FAILED", detail: error.message }, { status: 500 });
  }

  const result = data as { error?: string; http_status?: number };
  if (result.error) {
    return NextResponse.json(result, { status: result.http_status ?? 400 });
  }

  return NextResponse.json(result, { status: 200 });
}
