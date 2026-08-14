import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { Users, CheckCircle2, AlertTriangle, TrendingUp, Activity } from "lucide-react";
import AIChatDrawer from "@/components/canteen/AIChatDrawer";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard Sekolah" };

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default async function SchoolDashboardPage() {
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

  // Current month period
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // SPP stats
  const { data: sppStats } = await service
    .from("spp_invoices")
    .select("status, amount, amount_paid")
    .eq("school_id", schoolId)
    .eq("period", period);

  const totalInvoices = sppStats?.length ?? 0;
  const paidInvoices = sppStats?.filter((s) => s.status === "PAID").length ?? 0;
  const failedInvoices = sppStats?.filter((s) => s.status === "FAILED" || s.status === "OVERDUE").length ?? 0;
  const totalAmount = sppStats?.reduce((sum, s) => sum + s.amount, 0) ?? 0;
  const paidAmount = sppStats?.filter((s) => s.status === "PAID").reduce((sum, s) => sum + (s.amount_paid || s.amount), 0) ?? 0;
  const collectionRate = totalInvoices > 0 ? Math.round((paidInvoices / totalInvoices) * 100) : 0;

  // Student count (Schema v3)
  const { count: studentCount } = await service
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("status", "active");

  // Recent canteen transactions using denormalized school_id (Schema v3)
  const { data: recentTx } = await service
    .from("canteen_transactions")
    .select("id, amount, status, created_at")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(5);

  const stats = [
    {
      label: "Siswa Aktif",
      value: String(studentCount ?? 0),
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/15",
    },
    {
      label: "SPP Lunas",
      value: `${collectionRate}%`,
      icon: CheckCircle2,
      color: "text-primary",
      bg: "bg-primary/15",
    },
    {
      label: "SPP Bermasalah",
      value: String(failedInvoices),
      icon: AlertTriangle,
      color: "text-destructive",
      bg: "bg-destructive/15",
    },
    {
      label: "Dana Terkumpul",
      value: formatRupiah(paidAmount),
      icon: TrendingUp,
      color: "text-accent",
      bg: "bg-accent/15",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard Sekolah</h1>
        <p className="text-muted-foreground text-sm mt-1">Periode: {period}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="glass rounded-2xl p-4 card-hover">
              <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* SPP collection gauge */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Rekonsiliasi SPP {period}</h2>
          <a href="/school/spp" className="text-sm text-primary hover:underline">
            Lihat detail
          </a>
        </div>
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-muted-foreground">{paidInvoices} dari {totalInvoices} siswa lunas</span>
          <span className="font-bold text-primary">{collectionRate}%</span>
        </div>
        <div className="h-4 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full progress-fill"
            style={{ width: `${collectionRate}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>Dana terkumpul: {formatRupiah(paidAmount)}</span>
          <span>Target: {formatRupiah(totalAmount)}</span>
        </div>
      </div>

      {/* Recent transactions */}
      {recentTx && recentTx.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Transaksi Kantin Terbaru</h2>
          </div>
          <div className="space-y-2">
            {recentTx.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${tx.status === "SETTLED" ? "bg-primary" : "bg-destructive"}`} />
                  <span className="text-sm text-muted-foreground">
                    {new Date(tx.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    tx.status === "SETTLED" ? "badge-settled" :
                    tx.status === "REJECTED_OVERLIMIT" ? "badge-rejected" : "badge-offline"
                  }`}>
                    {tx.status}
                  </span>
                  <span className="text-sm font-semibold">{formatRupiah(tx.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Treasury AI button */}
      <div className="flex justify-end">
        <AIChatDrawer
          endpoint="/api/v1/ai/treasury-advisor"
          persona="treasury"
          triggerLabel="Konsultasi Treasury AI"
        />
      </div>
    </div>
  );
}
