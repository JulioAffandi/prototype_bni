// app/(school)/school/payroll/page.tsx
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import PayrollBatchTable from "@/components/school/PayrollBatchTable";
import { Wallet } from "lucide-react";

export const metadata: Metadata = { title: "Payroll Guru & Staf" };
export const dynamic = "force-dynamic";

export default async function SchoolPayrollPage() {
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

  const currentPeriod = new Date().toISOString().slice(0, 7);

  const { data: roster } = await service
    .from("institution_payroll")
    .select("*")
    .eq("school_id", schoolId)
    .eq("period", currentPeriod)
    .order("staff_name");

  return (
    <div className="space-y-6" data-portal="school">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Payroll Guru &amp; Staf</h1>
          <p className="text-sm text-muted-foreground">
            Roster gaji, batch disbursement BNI H2H, dan rincian slip gaji PPh 21 / BPJS
          </p>
        </div>
      </div>

      <PayrollBatchTable
        schoolId={schoolId}
        initialPeriod={currentPeriod}
        initialRoster={(roster ?? []) as unknown as import("@/types/institution").PayrollRecord[]}
      />
    </div>
  );
}
