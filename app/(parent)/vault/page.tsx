import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrResolveParentId } from "@/lib/supabase/parent-resolver";
import { redirect } from "next/navigation";
import VaultGoalCard from "@/components/parent/VaultGoalCard";
import type { Metadata } from "next";
import { Vault, ArrowDownToLine, AlertCircle } from "lucide-react";

export const metadata: Metadata = { title: "Student Vault" };

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default async function VaultPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parentId = await getOrResolveParentId(user);
  let students: Array<{
    id: string;
    full_name: string;
    student_vault: {
      vault_balance: number;
      savings_goal_name: string | null;
      savings_goal_target: number | null;
      updated_at: string;
    } | null;
  }> = [];

  if (parentId) {
    const service = createServiceClient();
    const { data: mappings } = await service
      .from("guardian_student_map")
      .select(`
        student_id,
        students (
          id, full_name,
          student_vault ( vault_balance, savings_goal_name, savings_goal_target, updated_at )
        )
      `)
      .eq("parent_id", parentId);

    students = (mappings ?? [])
      .map((m) => m.students)
      .filter(Boolean) as Array<{
        id: string;
        full_name: string;
        student_vault: {
          vault_balance: number;
          savings_goal_name: string | null;
          savings_goal_target: number | null;
          updated_at: string;
        } | null;
      }>;
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center">
          <Vault className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Student Goal Vault</h1>
          <p className="text-sm text-muted-foreground">Tabungan otomatis dari sisa pagu harian</p>
        </div>
      </div>

      {students.map((student) => {
        const vault = student.student_vault;
        return (
          <div key={student.id} className="space-y-3">
            <VaultGoalCard
              studentName={student.full_name}
              vaultBalance={vault?.vault_balance ?? 0}
              goalName={vault?.savings_goal_name ?? "Tabungan"}
              goalTarget={vault?.savings_goal_target ?? 300000}
            />

            {/* Withdrawal section */}
            <div className="glass rounded-2xl p-4 border border-border/60">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-foreground">
                <ArrowDownToLine className="w-4 h-4 text-primary" />
                Cairkan Tabungan
              </h3>
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/50 border border-border/50 mb-3">
                <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Pencairan memerlukan konfirmasi dua pihak (Dual Control). Dana akan
                  dikembalikan ke rekening BNI orang tua utama.
                </p>
              </div>
              {vault && vault.vault_balance > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Saldo tersedia</span>
                  <span className="font-bold text-lg text-foreground">{formatRupiah(vault.vault_balance)}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Belum ada saldo untuk dicairkan
                </p>
              )}
            </div>
          </div>
        );
      })}

      {students.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center border border-border/60">
          <Vault className="w-10 h-10 text-muted-foreground/70 mx-auto mb-3" />
          <p className="font-bold text-foreground">Belum Ada Siswa Terhubung</p>
        </div>
      )}
    </div>
  );
}
