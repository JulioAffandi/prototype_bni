// app/(school)/school/financial/page.tsx
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import FinancialHub from "@/components/school/FinancialHub";
import { Landmark } from "lucide-react";

export const metadata: Metadata = { title: "Investasi & Kredit Bank" };
export const dynamic = "force-dynamic";

export default async function SchoolFinancialPage() {
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

  const [creditRes, investmentRes] = await Promise.all([
    service
      .from("institution_credit_applications")
      .select("*")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false }),
    service
      .from("institution_investments")
      .select("*")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-6" data-portal="school">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <Landmark className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Portofolio Finansial &amp; Kredit Bank</h1>
          <p className="text-sm text-muted-foreground">
            Kredit modal kerja BNI, portofolio investasi sekolah (Deposito/Sukuk), dan simulator financial runway
          </p>
        </div>
      </div>

      <FinancialHub
        schoolId={schoolId}
        initialCreditApplications={creditRes.data ?? []}
        initialInvestments={investmentRes.data ?? []}
      />
    </div>
  );
}
