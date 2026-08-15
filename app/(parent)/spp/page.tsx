import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrResolveParentId } from "@/lib/supabase/parent-resolver";
import { redirect } from "next/navigation";
import ParentSPPList from "@/components/parent/ParentSPPList";
import type { Metadata } from "next";
import { FileText } from "lucide-react";

export const metadata: Metadata = { title: "Status SPP" };

export default async function SPPPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parentId = await getOrResolveParentId(user, true);
  let studentIds: string[] = [];
  let mappingsList: Array<{ student_id: string; students: { full_name?: string } | null }> = [];

  const service = createServiceClient();
  if (parentId) {
    const { data: mappings } = await service
      .from("guardian_student_map")
      .select("student_id, status, students!guardian_student_map_student_id_fkey(full_name)")
      .eq("parent_id", parentId);

    const activeMappings = (mappings ?? []).filter(
      (m) => !m.status || m.status.toLowerCase() === "active"
    );

    mappingsList = activeMappings as unknown as Array<{ student_id: string; students: { full_name?: string } | null }>;
    studentIds = mappingsList.map((m) => m.student_id);
  }

  // Fetch all SPP invoices
  const { data: invoices } = studentIds.length > 0
    ? await service
        .from("spp_invoices")
        .select("id, student_id, period, amount, status, due_date, paid_at, retry_count")
        .in("student_id", studentIds)
        .order("period", { ascending: false })
    : { data: [] };

  const rawList = invoices ?? [];

  function getStudentName(studentId: string) {
    const m = mappingsList.find((x) => x.student_id === studentId);
    return m?.students?.full_name ?? "Siswa";
  }

  const formattedInvoices = rawList.map((inv) => ({
    id: inv.id,
    student_id: inv.student_id,
    student_name: getStudentName(inv.student_id),
    period: inv.period,
    amount: inv.amount,
    status: inv.status,
    due_date: inv.due_date,
    paid_at: inv.paid_at,
    retry_count: inv.retry_count,
  }));

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Tagihan &amp; Rekonsiliasi SPP</h1>
          <p className="text-xs text-muted-foreground">
            Status autodebet BNI H2H SNAP BI dan riwayat pembayaran SPP sekolah
          </p>
        </div>
      </div>

      <ParentSPPList initialInvoices={formattedInvoices} />
    </div>
  );
}
