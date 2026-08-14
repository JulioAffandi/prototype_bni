import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrResolveParentId } from "@/lib/supabase/parent-resolver";
import { redirect } from "next/navigation";
import PaguSlider from "@/components/parent/PaguSlider";
import EmergencyToggle from "@/components/parent/EmergencyToggle";
import type { Metadata } from "next";
import { SlidersHorizontal } from "lucide-react";

export const metadata: Metadata = { title: "Atur Pagu" };

export default async function PaguPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parentId = await getOrResolveParentId(user);
  let students: Array<{
    id: string;
    full_name: string;
    daily_limit: number;
    daily_limit_used: number;
    emergency_approve: boolean;
    emergency_limit: number;
    emergency_used_today: boolean;
    emergency_overdraft_count_7d: number;
  }> = [];

  if (parentId) {
    const service = createServiceClient();
    const todayStr = new Date().toISOString().slice(0, 10);

    const { data: mappings } = await service
      .from("guardian_student_map")
      .select(`
        student_id,
        students (
          id, full_name, daily_limit, emergency_approve, emergency_limit
        )
      `)
      .eq("parent_id", parentId)
      .eq("status", "active");

    const rawStudents = (mappings ?? []).map((m) => m.students).filter(Boolean);

    students = await Promise.all(
      rawStudents.map(async (st: any) => {
        const { data: counter } = await service
          .from("student_daily_counters")
          .select("spent_amount, overdraft_amount, overdraft_count")
          .eq("student_id", st.id)
          .eq("business_date", todayStr)
          .maybeSingle();

        return {
          id: st.id,
          full_name: st.full_name,
          daily_limit: st.daily_limit,
          daily_limit_used: counter?.spent_amount ?? 0,
          emergency_approve: st.emergency_approve,
          emergency_limit: st.emergency_limit,
          emergency_used_today: (counter?.overdraft_count ?? 0) > 0,
          emergency_overdraft_count_7d: counter?.overdraft_count ?? 0,
        };
      }),
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
          <SlidersHorizontal className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Atur Pagu Jajan</h1>
          <p className="text-sm text-muted-foreground">Kontrol pengeluaran harian anak Anda (Schema v3)</p>
        </div>
      </div>

      {students.map((student) => (
        <div key={student.id} className="space-y-3">
          <PaguSlider
            studentId={student.id}
            studentName={student.full_name}
            currentLimit={student.daily_limit}
            currentUsed={student.daily_limit_used}
          />
          <EmergencyToggle
            studentId={student.id}
            studentName={student.full_name}
            emergencyApprove={student.emergency_approve}
            emergencyLimit={student.emergency_limit}
            emergencyUsedToday={student.emergency_used_today}
            overdraftCount7d={student.emergency_overdraft_count_7d}
          />
        </div>
      ))}

      {students.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center border border-border/60">
          <SlidersHorizontal className="w-10 h-10 text-muted-foreground/70 mx-auto mb-3" />
          <p className="font-bold text-foreground">Belum ada siswa terhubung</p>
          <p className="text-sm text-muted-foreground mt-1">
            Hubungi admin sekolah untuk menautkan akun anak Anda.
          </p>
        </div>
      )}
    </div>
  );
}
