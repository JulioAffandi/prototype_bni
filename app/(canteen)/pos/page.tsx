import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import PosTerminalClient from "@/components/canteen/PosTerminalClient";
import AIChatDrawer from "@/components/canteen/AIChatDrawer";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kasir POS" };

// Demo menu for MVP — in production this comes from merchant's menu DB table
const DEMO_MENU = [
  { id: "m1", name: "Nasi Goreng Spesial", price: 12000, category: "Makanan Berat", available: true },
  { id: "m2", name: "Nasi Uduk Komplit", price: 10000, category: "Makanan Berat", available: true },
  { id: "m3", name: "Mie Goreng Telur", price: 11000, category: "Makanan Berat", available: true },
  { id: "m4", name: "Ayam Goreng Crispy", price: 8000, category: "Lauk", available: true },
  { id: "m5", name: "Tempe Mendoan (2 pcs)", price: 3000, category: "Lauk", available: true },
  { id: "m6", name: "Tahu Goreng Bakso", price: 3000, category: "Lauk", available: true },
  { id: "m7", name: "Es Teh Manis Jumbo", price: 4000, category: "Minuman", available: true },
  { id: "m8", name: "Air Mineral 600ml", price: 3000, category: "Minuman", available: true },
  { id: "m9", name: "Jus Jeruk Segar", price: 6000, category: "Minuman", available: true },
  { id: "m10", name: "Roti Bakar Cokelat", price: 7000, category: "Snack", available: true },
];

export default async function CanteenPOSPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const appMetadata = user.app_metadata || {};
  const userMerchantIds: string[] = Array.isArray(appMetadata.merchant_ids) ? appMetadata.merchant_ids : [];

  const service = createServiceClient();
  let merchantId: string | null = userMerchantIds[0] || null;

  if (!merchantId) {
    const { data: roles } = await service
      .from("user_roles")
      .select("merchant_id")
      .eq("user_id", user.id)
      .is("revoked_at", null);
    merchantId = roles?.[0]?.merchant_id || null;
  }

  const effectiveMerchantId = merchantId ?? "demo-merchant-id";

  // Fetch dynamic menu items from public.menu_items
  const { data: dbItems } = await service
    .from("menu_items")
    .select("id, name, unit_price, category, is_active, stock_qty")
    .eq("merchant_id", effectiveMerchantId)
    .eq("is_active", true)
    .gt("stock_qty", 0)
    .order("category")
    .order("name");

  const menuItems = (dbItems && dbItems.length > 0)
    ? dbItems.map((m) => ({
        id: m.id,
        name: m.name,
        price: m.unit_price,
        category: m.category,
        available: m.is_active && m.stock_qty > 0,
      }))
    : DEMO_MENU;

  return <PosTerminalClient merchantId={effectiveMerchantId} menuItems={menuItems} />;
}
