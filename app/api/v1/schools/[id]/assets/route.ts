// app/api/v1/schools/[id]/assets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const assetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("NON_WORKING"),
    asset_name: z.string().min(2),
    asset_code: z.string().optional(),
    category: z.string().min(2),
    location: z.string().optional(),
    quantity: z.number().int().positive().default(1),
    condition: z.enum(["BAIK", "PERLU_PERBAIKAN", "RUSAK"]).default("BAIK"),
    acquisition_date: z.string().optional(),
    acquisition_value: z.number().nonnegative().optional(),
    notes: z.string().optional(),
  }),
  z.object({
    kind: z.literal("WORKING"),
    merchant_id: z.string().uuid(),
    asset_name: z.string().min(2),
    asset_code: z.string().optional(),
    category: z.string().min(2),
    location: z.string().optional(),
    quantity: z.number().int().positive().default(1),
    condition: z.enum(["BAIK", "PERLU_PERBAIKAN", "RUSAK"]).default("BAIK"),
    acquisition_date: z.string().optional(),
    acquisition_value: z.number().nonnegative().optional(),
    notes: z.string().optional(),
  }),
]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: schoolId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const searchParams = req.nextUrl.searchParams;
  const kind = searchParams.get("kind");

  let query = (supabase as any)
    .from("institution_assets")
    .select("*, merchants ( name )")
    .eq("school_id", schoolId)
    .order("asset_name");

  if (kind) query = query.eq("kind", kind);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "QUERY_FAILED", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ assets: data });
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
  const parsed = assetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const insertData = {
    ...parsed.data,
    school_id: schoolId,
    merchant_id: parsed.data.kind === "WORKING" ? parsed.data.merchant_id : null,
  };

  const { data, error } = await (supabase as any)
    .from("institution_assets")
    .insert(insertData as any)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "INSERT_FAILED", detail: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
