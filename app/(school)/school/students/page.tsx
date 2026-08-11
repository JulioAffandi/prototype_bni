import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import StudentManagementTable from "@/components/school/StudentManagementTable";
import { Users } from "lucide-react";

export const metadata: Metadata = { title: "Manajemen Siswa" };

export default async function SchoolStudentsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", user.id)
    .single();
  if (!profile?.school_id) redirect("/login");

  const { data: students } = await supabase
    .from("students")
    .select(`
      id, full_name, nfc_uid_last4, card_status,
      daily_limit, daily_limit_used, emergency_approve,
      emergency_overdraft_count_7d, created_at
    `)
    .eq("school_id", profile.school_id)
    .order("full_name");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Manajemen Siswa</h1>
            <p className="text-sm text-muted-foreground">
              Daftar siswa, status kartu NFC, dan kendali pagu
            </p>
          </div>
        </div>
      </div>

      <StudentManagementTable
        schoolId={profile.school_id}
        students={(students ?? []).map((s) => ({
          id: s.id,
          full_name: s.full_name,
          nfc_uid_last4: s.nfc_uid_last4 ?? "????",
          card_status: s.card_status as "active" | "lost_reported" | "blocked" | "graduated" | "transferred_out",
          daily_limit: s.daily_limit,
          daily_limit_used: s.daily_limit_used,
          emergency_approve: s.emergency_approve,
          emergency_overdraft_count_7d: s.emergency_overdraft_count_7d,
          created_at: s.created_at,
        }))}
      />
    </div>
  );
}
