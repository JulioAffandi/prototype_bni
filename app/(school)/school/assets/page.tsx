// app/(school)/school/assets/page.tsx
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import AssetInventoryTable from "@/components/school/AssetInventoryTable";
import { Boxes } from "lucide-react";

export const metadata: Metadata = { title: "Inventaris Aset Sekolah" };
export const dynamic = "force-dynamic";

export default async function SchoolAssetsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const appMetadata = user.app_metadata || {};
  const userSchoolIds: string[] = Array.isArray(appMetadata.school_ids) ? appMetadata.school_ids : [];

  const service = createServiceClient();
  let schoolId: string | null = userSchoolIds[0] || null;

  if (!schoolId) {
    const { data: roles } = await service
      .from("user_roles")
      .select("school_id")
      .eq("user_id", user.id)
      .is("revoked_at", null);
    schoolId = roles?.[0]?.school_id || null;
  }

  if (!schoolId) redirect("/login");

  const [assetsRes, merchantsRes] = await Promise.all([
    service
      .from("institution_assets")
      .select("*, merchants ( name )")
      .eq("school_id", schoolId)
      .order("asset_name"),
    service
      .from("merchants")
      .select("id, name")
      .eq("school_id", schoolId),
  ]);

  return (
    <div className="space-y-6" data-portal="school">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <Boxes className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Inventaris Aset Sekolah</h1>
          <p className="text-sm text-muted-foreground">
            Aset operasional non-working (elektronik, furnitur) dan aset commercial working kantin (POS, EDC BNI)
          </p>
        </div>
      </div>

      <AssetInventoryTable
        schoolId={schoolId}
        initialAssets={assetsRes.data ?? []}
        merchants={merchantsRes.data ?? []}
      />
    </div>
  );
}
