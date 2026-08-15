import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const MenuItemSchema = z.object({
  name: z.string().min(2),
  category: z.string().min(2),
  unit_price: z.number().positive(),
  unit_cost: z.number().nonnegative().optional().default(0),
  stock_qty: z.number().int().nonnegative().optional().default(50),
  is_active: z.boolean().optional().default(true),
});

const UpdateMenuItemSchema = MenuItemSchema.partial().extend({
  id: z.string().uuid(),
});

/**
 * GET /api/v1/merchants/[id]/menu
 * Returns all menu items for a merchant (Schema v3).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: merchantId } = await params;
  const activeOnly = request.nextUrl.searchParams.get("active_only") === "true";

  const service = createServiceClient();
  let query = service
    .from("menu_items")
    .select("id, merchant_id, name, category, unit_price, unit_cost, stock_qty, is_active, created_at, updated_at")
    .eq("merchant_id", merchantId)
    .order("category")
    .order("name");

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data: items, error } = await query;
  if (error) {
    return NextResponse.json({ error: "FETCH_FAILED", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ menu_items: items ?? [] });
}

/**
 * POST /api/v1/merchants/[id]/menu
 * Adds a new menu item for a merchant.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: merchantId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json() as unknown;
  const parsed = MenuItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const { data: newItem, error } = await service
    .from("menu_items")
    .insert({
      merchant_id: merchantId,
      name: parsed.data.name.trim(),
      category: parsed.data.category.trim(),
      unit_price: parsed.data.unit_price,
      unit_cost: parsed.data.unit_cost,
      stock_qty: parsed.data.stock_qty,
      is_active: parsed.data.is_active,
    })
    .select("id, merchant_id, name, category, unit_price, unit_cost, stock_qty, is_active, created_at")
    .single();

  if (error || !newItem) {
    return NextResponse.json({ error: "INSERT_FAILED", detail: error?.message }, { status: 500 });
  }

  return NextResponse.json({ item: newItem }, { status: 201 });
}

/**
 * PATCH /api/v1/merchants/[id]/menu
 * Updates an existing menu item (price, COGS, stock, category, active status).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: merchantId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json() as unknown;
  const parsed = UpdateMenuItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { id: itemId, ...fields } = parsed.data;
  const updatePayload: {
    updated_at: string;
    name?: string;
    category?: string;
    unit_price?: number;
    unit_cost?: number;
    stock_qty?: number;
    is_active?: boolean;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (fields.name !== undefined) updatePayload.name = fields.name.trim();
  if (fields.category !== undefined) updatePayload.category = fields.category.trim();
  if (fields.unit_price !== undefined) updatePayload.unit_price = fields.unit_price;
  if (fields.unit_cost !== undefined) updatePayload.unit_cost = fields.unit_cost;
  if (fields.stock_qty !== undefined) updatePayload.stock_qty = fields.stock_qty;
  if (fields.is_active !== undefined) updatePayload.is_active = fields.is_active;

  const service = createServiceClient();
  const { data: updatedItem, error } = await service
    .from("menu_items")
    .update(updatePayload)
    .eq("id", itemId)
    .eq("merchant_id", merchantId)
    .select("id, merchant_id, name, category, unit_price, unit_cost, stock_qty, is_active, updated_at")
    .single();

  if (error || !updatedItem) {
    return NextResponse.json({ error: "UPDATE_FAILED", detail: error?.message }, { status: 500 });
  }

  return NextResponse.json({ item: updatedItem });
}

/**
 * DELETE /api/v1/merchants/[id]/menu?item_id=...
 * Deletes a menu item.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: merchantId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const itemId = request.nextUrl.searchParams.get("item_id");
  if (!itemId) {
    return NextResponse.json({ error: "INVALID_PAYLOAD", message: "item_id query param required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from("menu_items")
    .delete()
    .eq("id", itemId)
    .eq("merchant_id", merchantId);

  if (error) {
    return NextResponse.json({ error: "DELETE_FAILED", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, deleted_item_id: itemId });
}
