import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrResolveParentId } from "@/lib/supabase/parent-resolver";
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
  UserCheck,
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

  // Automatically resolve or auto-bind parent_id
  const parentId = await getOrResolveParentId(user);

  let students: StudentWithVault[] = [];

  if (parentId) {
    const service = createServiceClient();
    const { data: mappings } = await service
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
      .eq("parent_id", parentId);

    students = (mappings ?? [])
      .map((m) => m.students as StudentWithVault | null)
      .filter(Boolean) as StudentWithVault[];
  }

  // Recent canteen transactions for all linked children
  const studentIds = students.map((s) => s.id);
  const service = createServiceClient();
  const { data: recentTx } = studentIds.length > 0
    ? await service
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
          <h1 className="text-xl font-bold text-foreground">Parent Control Hub</h1>
        </div>
        <button
          id="notif-btn"
          className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
          aria-label="Notifikasi"
        >
          <Bell className="w-5 h-5 text-foreground" />
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
          <div key={student.id} className="glass rounded-2xl p-5 card-hover space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                    <UserCheck className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-base text-foreground">{student.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Status: <span className="font-semibold text-foreground">{student.card_status === "active" ? "Kartu Aktif" : student.card_status}</span>
                    </p>
                  </div>
                </div>
              </div>
              {student.emergency_approve && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Darurat Aktif</span>
                </div>
              )}
            </div>

            {/* Pagu progress */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground font-medium">Pagu Terpakai</span>
                <span className="font-bold text-foreground">{formatRupiah(student.daily_limit_used)} / {formatRupiah(student.daily_limit)}</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${paguPct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Sisa Hari Ini: <span className="font-bold text-primary">{formatRupiah(sisaPagu)}</span>
              </p>
            </div>

            {/* Vault */}
            {student.student_vault && (
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/60 border border-border/50">
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="w-4 h-4 text-accent" />
                  <div>
                    <p className="text-xs text-muted-foreground">Student Vault (Tabungan)</p>
                    <p className="text-sm font-bold text-foreground">{formatRupiah(student.student_vault.vault_balance ?? 0)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground font-medium">{student.student_vault.savings_goal_name || "Target Tabungan"}</p>
                  <p className="text-xs font-bold text-accent">{Math.round(vaultProgress)}% tercapai</p>
                </div>
              </div>
            )}

            <a
              href={`/pagu?student=${student.id}`}
              className="flex items-center justify-between pt-3 border-t border-border/50 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Atur Pagu &amp; Batas Darurat</span>
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        );
      })}

      {/* Empty state */}
      {students.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center space-y-3 border border-border/60">
          <Wallet className="w-12 h-12 text-muted-foreground/70 mx-auto" />
          <h2 className="font-bold text-base text-foreground">Belum Ada Siswa Terhubung</h2>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Akun Anda belum terhubung dengan data siswa di sekolah. Berikan No. HP Anda (<strong>{user.phone || user.email}</strong>) kepada Admin Sekolah untuk ditautkan.
          </p>
        </div>
      )}

      {/* Recent transactions */}
      {recentTx && recentTx.length > 0 && (
        <div className="glass rounded-2xl p-5 space-y-3">
          <h2 className="font-bold text-sm text-foreground">Transaksi Terbaru Siswa</h2>
          <div className="space-y-2.5">
            {recentTx.map((tx) => {
              const studentName = students.find((s) => s.id === tx.student_id)?.full_name ?? "Siswa";
              const menuList = Array.isArray(tx.items) && tx.items.length > 0
                ? (tx.items as { menu: string }[]).map((i) => i.menu).join(", ")
                : "Kantin Sekolah";
              return (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.is_emergency ? "bg-accent/20" : "bg-primary/20"}`}>
                      <CreditCard className={`w-4 h-4 ${tx.is_emergency ? "text-accent" : "text-primary"}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{menuList}</p>
                      <p className="text-xs text-muted-foreground">{studentName} · {new Date(tx.created_at).toLocaleDateString("id-ID")}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">{formatRupiah(tx.amount)}</p>
                    {tx.is_emergency && (
                      <p className="text-[11px] font-semibold text-accent">Darurat</p>
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
        <div className="glass rounded-2xl p-5 space-y-3">
          <h2 className="font-bold text-sm text-foreground">Status Tagihan SPP</h2>
          <div className="space-y-2.5">
            {firstStudent.spp_invoices.slice(0, 3).map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                <div className="flex items-center gap-2.5">
                  {getSPPStatusIcon(inv.status)}
                  <div>
                    <p className="text-sm font-semibold text-foreground">SPP {inv.period}</p>
                    <p className="text-xs text-muted-foreground">
                      Jatuh tempo: {new Date(inv.due_date).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{formatRupiah(inv.amount)}</p>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full inline-block mt-0.5 ${
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
