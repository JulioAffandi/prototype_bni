import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import MenuManagementClient, { MenuItem } from "@/components/canteen/MenuManagementClient";
import { UtensilsCrossed } from "lucide-react";

export const metadata: Metadata = { title: "Kelola Menu Kantin" };

export default async function CanteenMenuPage() {
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

  if (!merchantId) redirect("/login");

  const { data: items } = await service
    .from("menu_items")
    .select("id, merchant_id, name, category, unit_price, unit_cost, stock_qty, is_active")
    .eq("merchant_id", merchantId)
    .order("category")
    .order("name");

  const menuList: MenuItem[] = (items ?? []).map((m) => ({
    id: m.id,
    merchant_id: m.merchant_id,
    name: m.name,
    category: m.category,
    unit_price: m.unit_price,
    unit_cost: m.unit_cost ?? 0,
    stock_qty: m.stock_qty,
    is_active: m.is_active,
  }));

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 pt-2">
        <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
          <UtensilsCrossed className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Manajemen Katalog Menu &amp; Stok</h1>
          <p className="text-sm text-muted-foreground">
            Kelola daftar makanan/minuman, harga jual, HPP (cost), dan stok porsi kantin.
          </p>
        </div>
      </div>

      <MenuManagementClient merchantId={merchantId} initialItems={menuList} />
    </div>
  );
}
