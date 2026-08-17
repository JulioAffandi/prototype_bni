// app/(parent)/spp/page.tsx
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrResolveParentId } from "@/lib/supabase/parent-resolver";
import { redirect } from "next/navigation";
import ParentSPPWithTabs from "@/components/parent/ParentSPPWithTabs";
import type { Metadata } from "next";
import { Receipt } from "lucide-react";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Tagihan SPP & Iuran",
  description: "Status Tagihan SPP Bulanan & Iuran Kegiatan Sekolah BNI",
};
export const dynamic = "force-dynamic";

export default async function SPPPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parentId = await getOrResolveParentId(user, true);
  let studentIds: string[] = [];
  let mappingsList: Array<{ student_id: string; students: { full_name?: string } | null }> = [];

  const service = createServiceClient();
  let walletBalance = 1500000;

  if (parentId) {
    const [mapRes, parentRes] = await Promise.all([
      service
        .from("guardian_student_map")
        .select("student_id, status, students!guardian_student_map_student_id_fkey(full_name)")
        .eq("parent_id", parentId),
      service
        .from("parents")
        .select("wallet_balance")
        .eq("id", parentId)
        .maybeSingle(),
    ]);

    const activeMappings = (mapRes.data ?? []).filter(
      (m) => !m.status || m.status.toLowerCase() === "active"
    );

    mappingsList = activeMappings as unknown as Array<{ student_id: string; students: { full_name?: string } | null }>;
    studentIds = mappingsList.map((m) => m.student_id);
    if (parentRes.data?.wallet_balance !== undefined && parentRes.data?.wallet_balance !== null) {
      walletBalance = Number(parentRes.data.wallet_balance);
    }
  }

  // Fetch all SPP invoices & Campaign invoices
  const [sppRes, campaignInvRes] = await Promise.all([
    studentIds.length > 0
      ? (service as any)
          .from("spp_invoices")
          .select("id, student_id, period, amount, status, due_date, paid_at, retry_count, institution_fee_categories(label, category)")
          .in("student_id", studentIds)
          .order("period", { ascending: false })
      : { data: [] },
    studentIds.length > 0
      ? (service as any)
          .from("campaign_invoices")
          .select(`
            id, campaign_id, student_id, amount, status, paid_at, bni_h2h_reference, receipt_qr_hash, created_at,
            school_billing_campaigns ( title, category, due_date ),
            students ( full_name )
          `)
          .in("student_id", studentIds)
          .order("created_at", { ascending: false })
      : { data: [] },
  ]);

  function getStudentName(studentId: string) {
    const m = mappingsList.find((x) => x.student_id === studentId);
    return m?.students?.full_name ?? "Siswa";
  }

  const formattedSPPInvoices = (sppRes.data ?? []).map((inv: any) => ({
    id: inv.id,
    student_id: inv.student_id,
    student_name: getStudentName(inv.student_id),
    period: inv.period,
    amount: inv.amount,
    status: inv.status,
    due_date: inv.due_date,
    paid_at: inv.paid_at,
    retry_count: inv.retry_count,
    category_label: inv.institution_fee_categories?.label ?? "SPP Bulanan",
  }));

  const formattedCampaignInvoices = (campaignInvRes.data ?? []).map((inv: any) => ({
    id: inv.id,
    campaign_id: inv.campaign_id,
    student_name: inv.students?.full_name ?? getStudentName(inv.student_id),
    campaign_title: inv.school_billing_campaigns?.title ?? "Iuran Kegiatan",
    category: inv.school_billing_campaigns?.category ?? "KEGIATAN",
    amount: inv.amount,
    due_date: inv.school_billing_campaigns?.due_date ?? "2026-08-31",
    status: inv.status,
    paid_at: inv.paid_at,
    bni_h2h_reference: inv.bni_h2h_reference,
    receipt_qr_hash: inv.receipt_qr_hash,
  }));

  return (
    <div className="space-y-4">
      <div className="pt-1 pb-1">
        <h1 className="text-xl font-extrabold text-portal-text tracking-tight">Tagihan &amp; SPP</h1>
        <p className="text-xs text-portal-muted mt-0.5">
          Autodebet BNI H2H, iuran kegiatan sekolah &amp; kuitansi digital terverifikasi
        </p>
      </div>

      <Suspense fallback={<div className="text-xs text-portal-muted p-4">Memuat tagihan...</div>}>
        <ParentSPPWithTabs
          sppInvoices={formattedSPPInvoices}
          campaignInvoices={formattedCampaignInvoices}
          parentWalletBalance={walletBalance}
        />
      </Suspense>
    </div>
  );
}
