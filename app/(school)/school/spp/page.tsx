// app/(school)/school/spp/page.tsx
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import SPPReconciliationTable from "@/components/school/SPPReconciliationTable";
import { FileText } from "lucide-react";

export const metadata: Metadata = { title: "Rekonsiliasi SPP & Fee Categories" };
export const dynamic = "force-dynamic";

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

  // Fetch fee categories and invoices for current school
  const [feeCategoriesRes, periodsRes, invoicesRes] = await Promise.all([
    service
      .from("institution_fee_categories")
      .select("*")
      .eq("school_id", schoolId)
      .eq("is_active", true),
    service
      .from("spp_invoices")
      .select("period")
      .eq("school_id", schoolId)
      .order("period", { ascending: false }),
    service
      .from("spp_invoices")
      .select(`
        id, student_id, period, amount, status, due_date, paid_at,
        retry_count, bni_h2h_reference, fee_category_id, receipt_qr_hash,
        students ( full_name ),
        institution_fee_categories ( label, category )
      `)
      .eq("school_id", schoolId)
      .order("status"),
  ]);

  const uniquePeriods = Array.from(new Set((periodsRes.data ?? []).map((p) => p.period)));
  if (!uniquePeriods.includes(currentPeriod)) uniquePeriods.unshift(currentPeriod);

  const initialList = (invoicesRes.data ?? []).map((inv) => {
    const st = inv.students as unknown as { full_name?: string } | null;
    const cat = inv.institution_fee_categories as unknown as { label?: string; category?: string } | null;
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
      fee_category_id: inv.fee_category_id,
      receipt_qr_hash: inv.receipt_qr_hash,
      student_name: st?.full_name ?? "Siswa",
      category_label: cat?.label ?? "SPP Bulanan",
      category_code: cat?.category ?? "SPP_BULANAN",
    };
  });

  return (
    <div className="space-y-6" data-portal="school">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Tagihan &amp; Rekonsiliasi Multi-Kategori Fee</h1>
          <p className="text-sm text-muted-foreground">
            SPP Bulanan, Uang Gedung, Seragam, Kegiatan &amp; Kuitansi Digital BNI H2H SNAP BI
          </p>
        </div>
      </div>

      <SPPReconciliationTable
        schoolId={schoolId}
        initialPeriod={currentPeriod}
        availablePeriods={uniquePeriods}
        initialInvoices={initialList}
        feeCategories={feeCategoriesRes.data ?? []}
      />
    </div>
  );
}
