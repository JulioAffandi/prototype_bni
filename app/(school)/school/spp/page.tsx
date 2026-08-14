import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { SPPStatus } from "@/types/database";
import SPPReconciliationTable from "@/components/school/SPPReconciliationTable";
import { FileText } from "lucide-react";

export const metadata: Metadata = { title: "Rekonsiliasi SPP" };

export default async function SchoolSPPPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", user.id)
    .single();
  const profile = profileData as { school_id: string | null } | null;
  if (!profile?.school_id) redirect("/login");

  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Fetch all periods available
  const { data: periodsData } = await supabase
    .from("spp_invoices")
    .select("period")
    .eq("school_id", profile.school_id)
    .order("period", { ascending: false });

  const periods = periodsData as Array<{ period: string }> | null;

  const uniquePeriods = Array.from(new Set((periods ?? []).map((p) => p.period)));
  if (!uniquePeriods.includes(currentPeriod)) uniquePeriods.unshift(currentPeriod);

  // Fetch invoices for current period
  const { data: invoicesData } = await supabase
    .from("spp_invoices")
    .select(`
      id, student_id, period, amount, status, due_date, paid_at,
      retry_count, bni_h2h_reference,
      students ( full_name )
    `)
    .eq("school_id", profile.school_id)
    .eq("period", currentPeriod)
    .order("status");

  const invoices = invoicesData as Array<{
    id: string;
    student_id: string;
    period: string;
    amount: number;
    status: SPPStatus;
    due_date: string;
    paid_at: string | null;
    retry_count: number;
    bni_h2h_reference: string | null;
    students: { full_name: string } | null;
  }> | null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Rekonsiliasi SPP</h1>
          <p className="text-sm text-muted-foreground">
            Manajemen tagihan dan status pembayaran SPP otomatis via BNI H2H
          </p>
        </div>
      </div>

      <SPPReconciliationTable
        schoolId={profile.school_id}
        initialPeriod={currentPeriod}
        availablePeriods={uniquePeriods}
        initialInvoices={(invoices ?? []).map((inv) => ({
          ...inv,
          student_name: (inv.students as { full_name?: string } | null)?.full_name ?? "Siswa",
        }))}
      />
    </div>
  );
}
