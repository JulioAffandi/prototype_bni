import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  ShieldCheck,
  TrendingUp,
  CreditCard,
  Bell,
  ChevronRight,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import type { Student, StudentVault, SPPInvoice } from "@/types/database";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function getPaguPercentage(used: number, limit: number): number {
  if (limit === 0) return 0;
  return Math.min(100, (used / limit) * 100);
}

function getSPPStatusIcon(status: SPPInvoice["status"]) {
  switch (status) {
    case "PAID":
      return <CheckCircle2 className="w-4 h-4 text-primary" />;
    case "OVERDUE":
      return <AlertTriangle className="w-4 h-4 text-destructive" />;
    case "FAILED":
      return <AlertTriangle className="w-4 h-4 text-destructive" />;
    default:
      return <Clock className="w-4 h-4 text-accent" />;
  }
}

interface StudentWithVault extends Student {
  student_vault: StudentVault | null;
  spp_invoices: SPPInvoice[];
}

export default async function ParentDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("parent_id")
    .eq("id", user.id)
    .single();

  if (!profile?.parent_id) redirect("/login");

  // Fetch students via guardian map with vault + recent SPP
  const { data: mappings } = await supabase
    .from("guardian_student_map")
    .select(`
      student_id, is_primary_guardian,
      students (
        id, full_name, daily_limit, daily_limit_used,
        emergency_approve, emergency_limit, emergency_used_today, card_status,
        student_vault ( vault_balance, savings_goal_name, savings_goal_target ),
        spp_invoices ( id, period, status, amount, due_date )
      )
    `)
    .eq("parent_id", profile.parent_id);

  const students = (mappings ?? [])
    .map((m) => m.students as StudentWithVault | null)
    .filter(Boolean) as StudentWithVault[];

  // Recent transactions
  const studentIds = students.map((s) => s.id);
  const { data: recentTx } = studentIds.length > 0
    ? await supabase
        .from("canteen_transactions")
        .select("id, student_id, amount, status, is_emergency, created_at, items")
        .in("student_id", studentIds)
        .in("status", ["SETTLED", "SETTLED_OVERDRAFT", "COMPLETED"])
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: [] };

  const firstStudent = students[0];

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <p className="text-sm text-muted-foreground">Selamat datang kembali</p>
          <h1 className="text-xl font-bold">Parent Control Hub</h1>
        </div>
        <button
          id="notif-btn"
          className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
          aria-label="Notifikasi"
        >
          <Bell className="w-5 h-5" />
        </button>
      </div>

      {/* Student cards */}
      {students.map((student) => {
        const paguPct = getPaguPercentage(student.daily_limit_used, student.daily_limit);
        const sisaPagu = student.daily_limit - student.daily_limit_used;
        const vaultProgress = student.student_vault?.savings_goal_target
          ? Math.min(100, ((student.student_vault.vault_balance ?? 0) / student.student_vault.savings_goal_target) * 100)
          : 0;

        return (
          <div key={student.id} className="glass rounded-2xl p-5 card-hover">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{student.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {student.card_status === "active" ? "Kartu Aktif" : student.card_status}
                    </p>
                  </div>
                </div>
              </div>
              {student.emergency_approve && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full badge-pending text-xs">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Darurat Aktif</span>
                </div>
              )}
            </div>

            {/* Pagu progress */}
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Pagu Terpakai</span>
                <span className="font-medium">{formatRupiah(student.daily_limit_used)} / {formatRupiah(student.daily_limit)}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full progress-fill"
                  style={{ width: `${paguPct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Sisa: <span className="font-semibold text-primary">{formatRupiah(sisaPagu)}</span>
              </p>
            </div>

            {/* Vault */}
            {student.student_vault && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-accent" />
                  <div>
                    <p className="text-xs text-muted-foreground">Student Vault</p>
                    <p className="text-sm font-semibold">{formatRupiah(student.student_vault.vault_balance ?? 0)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{student.student_vault.savings_goal_name}</p>
                  <p className="text-xs font-medium text-accent">{Math.round(vaultProgress)}% tercapai</p>
                </div>
              </div>
            )}

            <a
              href={`/pagu?student=${student.id}`}
              className="flex items-center justify-between mt-3 pt-3 border-t border-border/50 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Atur Pagu &amp; Pengaturan</span>
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        );
      })}

      {/* Empty state */}
      {students.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center">
          <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Belum ada siswa terdaftar</p>
          <p className="text-sm text-muted-foreground mt-1">Hubungi admin sekolah untuk menautkan akun anak Anda.</p>
        </div>
      )}

      {/* Recent transactions */}
      {recentTx && recentTx.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <h2 className="font-semibold text-sm mb-3">Transaksi Terbaru</h2>
          <div className="space-y-2">
            {recentTx.map((tx) => {
              const studentName = students.find((s) => s.id === tx.student_id)?.full_name ?? "Siswa";
              const menuList = Array.isArray(tx.items) && tx.items.length > 0
                ? (tx.items as { menu: string }[]).map((i) => i.menu).join(", ")
                : "Kantin";
              return (
                <div key={tx.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${tx.is_emergency ? "bg-accent/15" : "bg-primary/15"}`}>
                      <CreditCard className={`w-3.5 h-3.5 ${tx.is_emergency ? "text-accent" : "text-primary"}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{menuList}</p>
                      <p className="text-xs text-muted-foreground">{studentName} · {new Date(tx.created_at).toLocaleDateString("id-ID")}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatRupiah(tx.amount)}</p>
                    {tx.is_emergency && (
                      <p className="text-xs text-accent">Darurat</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SPP Status */}
      {firstStudent?.spp_invoices && firstStudent.spp_invoices.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <h2 className="font-semibold text-sm mb-3">Status SPP</h2>
          <div className="space-y-2">
            {firstStudent.spp_invoices.slice(0, 3).map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  {getSPPStatusIcon(inv.status)}
                  <div>
                    <p className="text-sm font-medium">SPP {inv.period}</p>
                    <p className="text-xs text-muted-foreground">
                      Jatuh tempo: {new Date(inv.due_date).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatRupiah(inv.amount)}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    inv.status === "PAID" ? "badge-paid" :
                    inv.status === "UNPAID" ? "badge-unpaid" :
                    "badge-failed"
                  }`}>
                    {inv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
