import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import MerchantProfileClient from "@/components/canteen/MerchantProfileClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profil Merchant & Stand Kantin",
};

export default async function MerchantProfilePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const appMetadata = user.app_metadata || {};
  const merchantIds: string[] = Array.isArray(appMetadata.merchant_ids) ? appMetadata.merchant_ids : [];

  let targetMerchantId = merchantIds[0] || null;

  if (!targetMerchantId) {
    const { data: userRole } = await service
      .from("user_roles")
      .select("merchant_id")
      .eq("user_id", user.id)
      .not("merchant_id", "is", null)
      .maybeSingle();

    if (userRole?.merchant_id) {
      targetMerchantId = userRole.merchant_id;
    }
  }

  if (!targetMerchantId) {
    const { data: firstMerchant } = await service
      .from("merchants")
      .select("id")
      .order("created_at")
      .limit(1)
      .single();
    if (firstMerchant) targetMerchantId = firstMerchant.id;
  }

  const { data: merchant } = targetMerchantId
    ? await service
        .from("merchants")
        .select(`
          id, name, bni_merchant_account, status,
          schools ( name )
        `)
        .eq("id", targetMerchantId)
        .single()
    : { data: null };

  if (!merchant) {
    redirect("/pos");
  }

  const schoolObj = Array.isArray(merchant.schools) ? merchant.schools[0] : merchant.schools;
  const schoolName = (schoolObj as { name?: string } | null)?.name || "Sekolah Mitra";

  return (
    <MerchantProfileClient
      user={{
        id: user.id,
        email: user.email || "",
        displayName: user.user_metadata?.full_name || "Kasir Kantin",
      }}
      merchant={{
        id: merchant.id,
        name: merchant.name,
        school_name: schoolName,
        bni_settlement_account: merchant.bni_merchant_account || "88800002222",
        is_active: merchant.status === "active",
      }}
    />
  );
}
