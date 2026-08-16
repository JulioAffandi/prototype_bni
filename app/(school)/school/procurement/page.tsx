// app/(school)/school/procurement/page.tsx
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import ProcurementManagement from "@/components/school/ProcurementManagement";
import { ShoppingCart } from "lucide-react";

export const metadata: Metadata = { title: "Pengadaan & Reimburse" };
export const dynamic = "force-dynamic";

export default async function SchoolProcurementPage() {
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

  const { data: items } = await service
    .from("institution_procurement")
    .select("*")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6" data-portal="school">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <ShoppingCart className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Pengadaan &amp; Reimbursement</h1>
          <p className="text-sm text-muted-foreground">
            Purchase Orders, AI OCR scanning nota reimbursement, dan WhatsApp auto-ingestion
          </p>
        </div>
      </div>

      <ProcurementManagement schoolId={schoolId} initialItems={(items ?? []) as unknown as import("@/types/institution").ProcurementItem[]} />
    </div>
  );
}
