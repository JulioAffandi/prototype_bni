import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CanteenHeader from "@/components/canteen/CanteenHeader";

export const metadata: Metadata = {
  title: {
    default: "VALO POS",
    template: "%s | VALO POS",
  },
  description: "Kasir Kantin Digital — NFC tap, offline queue, dan AI Inventory Advisor",
};

export default async function CanteenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, merchant_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "merchant_staff") redirect("/login");

  const { data: merchant } = profile.merchant_id
    ? await supabase.from("merchants").select("name, status").eq("id", profile.merchant_id).single()
    : { data: null };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <CanteenHeader merchantName={merchant?.name ?? "Kantin"} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
