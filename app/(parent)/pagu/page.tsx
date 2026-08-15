import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrResolveParentId } from "@/lib/supabase/parent-resolver";
import { redirect } from "next/navigation";
import PaguSlider from "@/components/parent/PaguSlider";
import EmergencyToggle from "@/components/parent/EmergencyToggle";
import CardManagementCard from "@/components/parent/CardManagementCard";
import type { Metadata } from "next";
import { SlidersHorizontal } from "lucide-react";

export const metadata: Metadata = { title: "Atur Pagu" };

export default async function PaguPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parentId = await getOrResolveParentId(user, true);
  let students: Array<{
    id: string;
    full_name: string;
    daily_limit: number;
    daily_limit_used: number;
    emergency_approve: boolean;
    emergency_limit: number;
    emergency_used_today: boolean;
    emergency_overdraft_count_7d: number;
    nfc_uid_last4: string;
    card_status: "active" | "lost_reported" | "blocked" | "graduated" | "transferred_out";
  }> = [];

  if (parentId) {
    const service = createServiceClient();
    const todayStr = new Date().toISOString().slice(0, 10);

    const { data: mappings } = await service
      .from("guardian_student_map")
      .select(`
        student_id, status,
        students!guardian_student_map_student_id_fkey (
          id, full_name, daily_limit, emergency_approve, emergency_limit,
          student_cards!student_cards_student_id_fkey ( uid_last4, status )
        )
      `)
      .eq("parent_id", parentId);

    const activeMappings = (mappings ?? []).filter(
      (m) => !m.status || m.status.toLowerCase() === "active"
    );

    const rawStudents = activeMappings.map((m) => m.students).filter(Boolean);

    students = await Promise.all(
      rawStudents.map(async (st: any) => {
        const { data: counter } = await service
          .from("student_daily_counters")
          .select("spent_amount, overdraft_amount, overdraft_count")
          .eq("student_id", st.id)
          .eq("business_date", todayStr)
          .maybeSingle();

        const cards = (st.student_cards || []) as Array<{ uid_last4: string | null; status: string }>;
        const activeCard = cards.find((c) => c.status === "active") || cards[0];

        return {
          id: st.id,
          full_name: st.full_name,
          daily_limit: st.daily_limit,
          daily_limit_used: counter?.spent_amount ?? 0,
          emergency_approve: st.emergency_approve,
          emergency_limit: st.emergency_limit,
          emergency_used_today: (counter?.overdraft_count ?? 0) > 0,
          emergency_overdraft_count_7d: counter?.overdraft_count ?? 0,
          nfc_uid_last4: activeCard?.uid_last4 ?? "????",
          card_status: (activeCard?.status as any) ?? "active",
        };
      }),
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <SlidersHorizontal className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Atur Pagu &amp; Kartu NFC</h1>
          <p className="text-xs text-muted-foreground">
            Batas belanja harian, persetujuan transaksi darurat, dan manajemen kartu fisik
          </p>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center space-y-3">
          <p className="text-sm font-semibold">Belum Ada Siswa Terhubung</p>
          <p className="text-xs text-muted-foreground">
            Tautkan data siswa terlebih dahulu di halaman Dashboard untuk mengatur pagu harian.
          </p>
        </div>
      ) : (
        students.map((student) => (
          <div key={student.id} className="space-y-4">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-1">
              {student.full_name}
            </h2>

            {/* Pagu slider card */}
            <PaguSlider
              studentId={student.id}
              studentName={student.full_name}
              currentLimit={student.daily_limit}
              currentUsed={student.daily_limit_used}
            />

            {/* Emergency toggle card */}
            <EmergencyToggle
              studentId={student.id}
              studentName={student.full_name}
              emergencyApprove={student.emergency_approve}
              emergencyLimit={student.emergency_limit}
              emergencyUsedToday={student.emergency_used_today}
              overdraftCount7d={student.emergency_overdraft_count_7d}
            />

            {/* NFC Card Management */}
            <CardManagementCard
              studentId={student.id}
              studentName={student.full_name}
              nfcUidLast4={student.nfc_uid_last4}
              cardStatus={student.card_status}
            />
          </div>
        ))
      )}
    </div>
  );
}
