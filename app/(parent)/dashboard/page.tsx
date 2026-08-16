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
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserCheck,
} from "lucide-react";
import type { StudentRow, StudentVaultRow, SPPInvoiceRow } from "@/types/database";
import type { Metadata } from "next";
import ParentLinkStudentAction from "@/components/parent/ParentLinkStudentAction";

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

function getSPPStatusIcon(status: SPPInvoiceRow["status"]) {
  switch (status) {
    case "PAID":
      return <CheckCircle2 className="w-4 h-4 text-primary" />;
    case "OVERDUE":
    case "FAILED":
      return <AlertTriangle className="w-4 h-4 text-destructive" />;
    default:
      return <Clock className="w-4 h-4 text-accent" />;
  }
}

interface DisplayStudent extends StudentRow {
  daily_limit_used: number;
  card_status: string;
  student_vault: (StudentVaultRow & { vault_balance: number }) | null;
  spp_invoices: SPPInvoiceRow[];
}

export default async function ParentDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parentId = await getOrResolveParentId(user, true);
  let students: DisplayStudent[] = [];

  const service = createServiceClient();
  const todayStr = new Date().toISOString().slice(0, 10);

  if (parentId) {
    const { data: mappings, error: mapErr } = await service
      .from("guardian_student_map")
      .select(`
        student_id, is_primary_guardian, status,
        students!guardian_student_map_student_id_fkey (
          id, school_id, full_name, student_number, class_label, date_of_birth, status,
          daily_limit, emergency_approve, emergency_limit, created_at, updated_at, offboarded_at,
          student_cards!student_cards_student_id_fkey ( id, uid_last4, status ),
          student_vault!student_vault_student_id_fkey ( student_id, school_id, ledger_account_id, vault_balance, savings_goal_name, savings_goal_target, updated_at ),
          spp_invoices!spp_invoices_student_id_fkey ( id, school_id, student_id, billed_parent_id, period, period_start, amount, amount_paid, status, retry_count, next_retry_at, due_date, paid_at, bni_h2h_reference, ledger_transaction_id, created_at, updated_at )
        )
      `)
      .eq("parent_id", parentId);

    if (mapErr) {
      console.error("Error fetching parent guardian_student_map:", mapErr);
    }

    const activeMappings = (mappings ?? []).filter(
      (m) => !m.status || m.status.toLowerCase() === "active"
    );

    const rawList = activeMappings.map((m) => m.students).filter(Boolean);

    students = await Promise.all(
      rawList.map(async (st: any) => {
        const cards = st.student_cards || [];
        const activeCard = cards.find((c: any) => c.status === "active") || cards[0];

        // Fetch daily counter for spent_amount
        const { data: counter } = await service
          .from("student_daily_counters")
          .select("spent_amount")
          .eq("student_id", st.id)
          .eq("business_date", todayStr)
          .maybeSingle();

        const vaultObj = Array.isArray(st.student_vault) ? st.student_vault[0] : st.student_vault;
        let vaultBalance = vaultObj?.vault_balance ?? 0;

        if (vaultObj?.ledger_account_id && (vaultObj.vault_balance === undefined || vaultObj.vault_balance === null)) {
          const { data: ledgerAcc } = await service
            .from("ledger_accounts")
            .select("balance")
            .eq("id", vaultObj.ledger_account_id)
            .maybeSingle();
          if (ledgerAcc) {
            vaultBalance = ledgerAcc.balance ?? 0;
          }
        }

        return {
          ...st,
          daily_limit_used: counter?.spent_amount ?? 0,
          card_status: activeCard?.status ?? "pending_activation",
          student_vault: vaultObj ? { ...vaultObj, vault_balance: vaultBalance } : null,
          spp_invoices: st.spp_invoices || [],
        };
      }),
    );
  }

  // Recent canteen transactions for linked children
  const studentIds = students.map((s) => s.id);
  const { data: recentTx } = studentIds.length > 0
    ? await service
        .from("canteen_transactions")
        .select("id, student_id, amount, status, is_emergency, created_at, items")
        .in("student_id", studentIds)
        .eq("status", "SETTLED")
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
        <div className="flex items-center gap-2">
          <ParentLinkStudentAction variant="button" />
          <button
            id="notif-btn"
            className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Notifikasi"
          >
            <Bell className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </div>

      {/* Student cards */}
      {students.map((student) => {
        const paguPct = getPaguPercentage(student.daily_limit_used, student.daily_limit);
        const sisaPagu = Math.max(0, student.daily_limit - student.daily_limit_used);
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
        <ParentLinkStudentAction variant="empty" userContact={user.phone || user.email} />
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
