import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrResolveParentId } from "@/lib/supabase/parent-resolver";
import { redirect } from "next/navigation";
import VaultGoalCard from "@/components/parent/VaultGoalCard";
import VaultWithdrawalModal from "@/components/parent/VaultWithdrawalModal";
import type { Metadata } from "next";
import { Vault } from "lucide-react";

export const metadata: Metadata = { title: "Student Vault" };

export default async function VaultPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parentId = await getOrResolveParentId(user, true);
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
        student_id, status,
        students!guardian_student_map_student_id_fkey (
          id, full_name,
          student_vault!student_vault_student_id_fkey (
            student_id, school_id, ledger_account_id, savings_goal_name, savings_goal_target, updated_at,
            ledger_accounts ( balance )
          )
        )
      `)
      .eq("parent_id", parentId);

    const activeMappings = (mappings ?? []).filter(
      (m) => !m.status || m.status.toLowerCase() === "active"
    );

    const rawStudents = activeMappings.map((m) => m.students).filter(Boolean);

    students = rawStudents.map((st: any) => {
      const vArr = Array.isArray(st.student_vault) ? st.student_vault[0] : st.student_vault;
      const ledgerObj = vArr?.ledger_accounts as { balance?: number } | null;
      const balance = ledgerObj?.balance ?? 0;

      return {
        id: st.id,
        full_name: st.full_name,
        student_vault: vArr
          ? {
              vault_balance: balance,
              savings_goal_name: vArr.savings_goal_name,
              savings_goal_target: vArr.savings_goal_target,
              updated_at: vArr.updated_at,
            }
          : null,
      };
    });
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
          <Vault className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Student Vault (Tabungan Siswa)</h1>
          <p className="text-xs text-muted-foreground">
            Alokasi sisa pagu harian otomatis masuk ke tabungan impian anak
          </p>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center space-y-3">
          <p className="text-sm font-semibold">Belum Ada Siswa Terhubung</p>
          <p className="text-xs text-muted-foreground">
            Tautkan data siswa terlebih dahulu di Dashboard untuk mengakses Student Vault.
          </p>
        </div>
      ) : (
        students.map((student) => (
          <div key={student.id} className="space-y-4">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-1">
              {student.full_name}
            </h2>

            <VaultGoalCard
              studentId={student.id}
              studentName={student.full_name}
              vaultBalance={student.student_vault?.vault_balance ?? 0}
              goalName={student.student_vault?.savings_goal_name ?? "Tabungan Impian"}
              goalTarget={student.student_vault?.savings_goal_target ?? 0}
            />

            <div className="flex justify-end">
              <VaultWithdrawalModal
                studentId={student.id}
                studentName={student.full_name}
                vaultBalance={student.student_vault?.vault_balance ?? 0}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
