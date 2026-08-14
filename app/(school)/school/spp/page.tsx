import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import SPPReconciliationTable from "@/components/school/SPPReconciliationTable";
import { FileText } from "lucide-react";

export const metadata: Metadata = { title: "Rekonsiliasi SPP" };

export default async function SchoolSPPPage() {
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

  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Fetch all periods available
  const { data: periods } = await service
    .from("spp_invoices")
    .select("period")
    .eq("school_id", schoolId)
    .order("period", { ascending: false });

  const uniquePeriods = Array.from(new Set((periods ?? []).map((p) => p.period)));
  if (!uniquePeriods.includes(currentPeriod)) uniquePeriods.unshift(currentPeriod);

  // Fetch invoices for current period
  const { data: invoices } = await service
    .from("spp_invoices")
    .select(`
      id, student_id, period, amount, status, due_date, paid_at,
      retry_count, bni_h2h_reference,
      students ( full_name )
    `)
    .eq("school_id", schoolId)
    .eq("period", currentPeriod)
    .order("status");

  const initialList = (invoices ?? []).map((inv) => {
    const st = inv.students as unknown as { full_name?: string } | null;
    return {
      id: inv.id,
      student_id: inv.student_id,
      period: inv.period,
      amount: inv.amount,
      status: inv.status,
      due_date: inv.due_date,
      paid_at: inv.paid_at,
      retry_count: inv.retry_count,
      bni_h2h_reference: inv.bni_h2h_reference,
      student_name: st?.full_name ?? "Siswa",
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Rekonsiliasi SPP</h1>
          <p className="text-sm text-muted-foreground">
            Manajemen tagihan dan status pembayaran SPP otomatis via BNI H2H (Schema v3)
          </p>
        </div>
      </div>

      <SPPReconciliationTable
        schoolId={schoolId}
        initialPeriod={currentPeriod}
        availablePeriods={uniquePeriods}
        initialInvoices={initialList}
      />
    </div>
  );
}
