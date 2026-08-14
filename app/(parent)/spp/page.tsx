import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrResolveParentId } from "@/lib/supabase/parent-resolver";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { invoice_status_t } from "@/types/database";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
} from "lucide-react";

export const metadata: Metadata = { title: "Status SPP" };

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

const STATUS_CONFIG: Record<
  string,
  { icon: typeof CheckCircle2; label: string; badgeClass: string; iconClass: string }
> = {
  PAID: {
    icon: CheckCircle2,
    label: "Lunas",
    badgeClass: "badge-paid",
    iconClass: "text-primary",
  },
  UNPAID: {
    icon: Clock,
    label: "Belum Bayar",
    badgeClass: "badge-unpaid",
    iconClass: "text-accent",
  },
  FAILED: {
    icon: XCircle,
    label: "Gagal",
    badgeClass: "badge-failed",
    iconClass: "text-destructive",
  },
  OVERDUE: {
    icon: AlertTriangle,
    label: "Terlambat",
    badgeClass: "badge-overdue",
    iconClass: "text-destructive",
  },
  DRAFT: {
    icon: Clock,
    label: "Draft",
    badgeClass: "badge-unpaid",
    iconClass: "text-muted-foreground",
  },
  CANCELLED: {
    icon: XCircle,
    label: "Batal",
    badgeClass: "badge-failed",
    iconClass: "text-muted-foreground",
  },
};

export default async function SPPPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parentId = await getOrResolveParentId(user);
  let studentIds: string[] = [];
  let mappingsList: Array<{ student_id: string; students: { full_name?: string } | null }> = [];

  const service = createServiceClient();
  if (parentId) {
    const { data: mappings } = await service
      .from("guardian_student_map")
      .select("student_id, students(full_name)")
      .eq("parent_id", parentId)
      .eq("status", "active");

    mappingsList = (mappings ?? []) as unknown as Array<{ student_id: string; students: { full_name?: string } | null }>;
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

  const list = invoices ?? [];

  // Group by period
  const periodMap = new Map<string, typeof list>();
  for (const inv of list) {
    if (!periodMap.has(inv.period)) periodMap.set(inv.period, []);
    periodMap.get(inv.period)!.push(inv);
  }
  const periods = Array.from(periodMap.keys()).sort((a, b) => b.localeCompare(a));

  function getStudentName(studentId: string) {
    const m = mappingsList.find((x) => x.student_id === studentId);
    return m?.students?.full_name ?? "Siswa";
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Status SPP</h1>
          <p className="text-sm text-muted-foreground">Riwayat pembayaran uang sekolah (Schema v3)</p>
        </div>
      </div>

      {periods.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center border border-border/60">
          <FileText className="w-10 h-10 text-muted-foreground/70 mx-auto mb-3" />
          <p className="font-bold text-foreground">Belum ada tagihan SPP</p>
          <p className="text-sm text-muted-foreground mt-1">
            Tagihan akan muncul setiap awal bulan secara otomatis.
          </p>
        </div>
      )}

      {periods.map((period) => {
        const periodInvoices = periodMap.get(period) ?? [];
        const allPaid = periodInvoices.every((i) => i.status === "PAID");

        return (
          <div key={period} className="glass rounded-2xl p-4 border border-border/60">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm text-foreground">
                SPP {new Date(period + "-01").toLocaleDateString("id-ID", {
                  month: "long",
                  year: "numeric",
                })}
              </h2>
              {allPaid && (
                <span className="text-xs badge-paid px-2.5 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3 h-3" />
                  Semua Lunas
                </span>
              )}
            </div>

            <div className="space-y-3">
              {periodInvoices.map((inv) => {
                const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.UNPAID;
                const Icon = cfg.icon;
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between py-2 border-b border-border/40 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full bg-muted flex items-center justify-center`}>
                        <Icon className={`w-4 h-4 ${cfg.iconClass}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{getStudentName(inv.student_id)}</p>
                        <p className="text-xs text-muted-foreground">
                          {inv.paid_at
                            ? `Lunas ${new Date(inv.paid_at).toLocaleDateString("id-ID")}`
                            : `Jatuh tempo ${new Date(inv.due_date).toLocaleDateString("id-ID")}`}
                        </p>
                        {inv.retry_count > 0 && inv.status !== "PAID" && (
                          <p className="text-xs text-accent font-medium">
                            Percobaan ulang ke-{inv.retry_count}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{formatRupiah(inv.amount)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full inline-block mt-0.5 ${cfg.badgeClass}`}>
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
