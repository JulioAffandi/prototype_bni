import { createServerSupabaseClient } from "@/lib/supabase/server";
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("parent_id")
    .eq("id", user.id)
    .single();
  if (!profile?.parent_id) redirect("/login");

  const { data: mappings } = await supabase
    .from("guardian_student_map")
    .select(`
      student_id,
      students (
        id, full_name, daily_limit, daily_limit_used,
        emergency_approve, emergency_limit,
        emergency_used_today, emergency_overdraft_count_7d
      )
    `)
    .eq("parent_id", profile.parent_id);

  const students = (mappings ?? [])
    .map((m) => m.students)
    .filter(Boolean) as {
      id: string;
      full_name: string;
      daily_limit: number;
      daily_limit_used: number;
      emergency_approve: boolean;
      emergency_limit: number;
      emergency_used_today: boolean;
      emergency_overdraft_count_7d: number;
    }[];

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
          <SlidersHorizontal className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Atur Pagu Jajan</h1>
          <p className="text-sm text-muted-foreground">Kontrol pengeluaran harian anak Anda</p>
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
        <div className="glass rounded-2xl p-8 text-center">
          <SlidersHorizontal className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Belum ada siswa terdaftar</p>
          <p className="text-sm text-muted-foreground mt-1">
            Hubungi admin sekolah untuk menautkan akun anak Anda.
          </p>
        </div>
      )}
    </div>
  );
}
