import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import POSCatalog from "@/components/canteen/POSCatalog";
import AIChatDrawer from "@/components/canteen/AIChatDrawer";
import { Bot } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kasir POS" };

// Demo menu for MVP — in production this comes from merchant's menu DB table
const DEMO_MENU = [
  { id: "m1", name: "Nasi Goreng", price: 12000, category: "Makanan Berat", available: true },
  { id: "m2", name: "Nasi Uduk", price: 10000, category: "Makanan Berat", available: true },
  { id: "m3", name: "Mie Goreng", price: 11000, category: "Makanan Berat", available: true },
  { id: "m4", name: "Ayam Goreng", price: 8000, category: "Lauk", available: true },
  { id: "m5", name: "Tempe Goreng", price: 3000, category: "Lauk", available: true },
  { id: "m6", name: "Tahu Goreng", price: 3000, category: "Lauk", available: true },
  { id: "m7", name: "Es Teh Manis", price: 4000, category: "Minuman", available: true },
  { id: "m8", name: "Air Mineral", price: 3000, category: "Minuman", available: true },
  { id: "m9", name: "Jus Jeruk", price: 6000, category: "Minuman", available: true },
];

export default async function CanteenPOSPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("merchant_id")
    .eq("id", user.id)
    .single();

  const merchantId = profile?.merchant_id ?? "demo-merchant-id";

  return (
    <div className="max-w-2xl mx-auto">
      <POSCatalog merchantId={merchantId} menuItems={DEMO_MENU} />

      {/* Floating AI advisor button */}
      <div className="fixed bottom-6 right-4 z-30">
        <AIChatDrawer
          endpoint="/api/v1/ai/merchant-advisor"
          persona="merchant"
          triggerLabel="AI Advisor"
        />
      </div>
    </div>
  );
}
