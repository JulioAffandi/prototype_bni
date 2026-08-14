import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import CanteenHeader from "@/components/canteen/CanteenHeader";
import AiAssistant from "@/components/chat/AiAssistant";

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

  const appMetadata = user.app_metadata || {};
  const userRoles: string[] = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
  const userMerchantIds: string[] = Array.isArray(appMetadata.merchant_ids) ? appMetadata.merchant_ids : [];

  const service = createServiceClient();
  let merchantId: string | null = userMerchantIds[0] || null;
  let isMerchantUser = userRoles.includes("merchant_staff") || userRoles.includes("merchant_owner") || userRoles.includes("platform_admin");

  if (!isMerchantUser || !merchantId) {
    const { data: roles } = await service
      .from("user_roles")
      .select("role, merchant_id")
      .eq("user_id", user.id)
      .is("revoked_at", null);

    const activeRole = roles?.find(
      (r) => r.role === "merchant_staff" || r.role === "merchant_owner",
    );
    if (activeRole) {
      isMerchantUser = true;
      merchantId = activeRole.merchant_id;
    }
  }

  if (!isMerchantUser) redirect("/login");

  const { data: merchant } = merchantId
    ? await service.from("merchants").select("name, status").eq("id", merchantId).maybeSingle()
    : { data: null };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <CanteenHeader merchantName={merchant?.name ?? "Kantin"} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <AiAssistant />
    </div>
  );
}
