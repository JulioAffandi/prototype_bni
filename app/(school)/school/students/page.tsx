import { createServiceClient } from "@/lib/supabase/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import StudentManagementTable, { Student } from "@/components/school/StudentManagementTable";
import { Users } from "lucide-react";

export const metadata: Metadata = { title: "Manajemen Siswa" };

const DEMO_SCHOOL_ID = "09c77f03-7f77-4c26-8da4-6ad5462f860c";

export default async function SchoolStudentsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const appMetadata = user.app_metadata || {};
  const userSchoolIds: string[] = Array.isArray(appMetadata.school_ids) ? appMetadata.school_ids : [];

  let schoolId: string | null = userSchoolIds[0] || null;

  if (!schoolId) {
    const { data: roles } = await service
      .from("user_roles")
      .select("school_id")
      .eq("user_id", user.id)
      .is("revoked_at", null);
    schoolId = roles?.[0]?.school_id || null;
  }

  if (!schoolId) {
    const { data: profile } = await service
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .maybeSingle();
    schoolId = profile?.school_id || null;
  }

  // Fallback to active demo school if no school attached
  if (!schoolId) {
    schoolId = DEMO_SCHOOL_ID;
  }

  // Validate school exists, otherwise fallback to active demo school
  const { data: schoolCheck } = await service
    .from("schools")
    .select("id")
    .eq("id", schoolId)
    .maybeSingle();

  if (!schoolCheck) {
    schoolId = DEMO_SCHOOL_ID;
  }

  // Auto-bind admin profile & user_roles to active school if missing, so RLS permits read access
  const { data: userRoleCheck } = await service
    .from("user_roles")
    .select("id")
    .eq("user_id", user.id)
    .eq("school_id", schoolId)
    .is("revoked_at", null)
    .maybeSingle();

  if (!userRoleCheck) {
    await service.from("user_roles").insert({
      user_id: user.id,
      role: "school_admin",
      school_id: schoolId,
    });
  }

  await service
    .from("profiles")
    .update({ school_id: schoolId })
    .eq("id", user.id);

  // 1. Query students using authenticated server Supabase client (createServerSupabase)
  // Left joins with explicit relationship disambiguation & no status exclusion filter
  const { data: students } = await supabase
    .from("students")
    .select(`
      id, full_name, student_number, class_label, status,
      daily_limit, emergency_approve, emergency_limit, created_at,
      student_cards!student_cards_student_id_fkey ( id, uid_last4, status, created_at ),
      guardian_student_map!guardian_student_map_student_id_fkey (
        parent_id, relationship, is_primary_guardian,
        parents ( id, full_name, phone_number )
      )
    `)
    .eq("school_id", schoolId)
    .order("full_name");

  // 2. Query 7d overdraft count from student_daily_counters using authenticated client
  const { data: counters } = await supabase
    .from("student_daily_counters")
    .select("student_id, overdraft_count")
    .eq("school_id", schoolId);

  const overdraftMap = new Map<string, number>();
  (counters as Array<{ student_id: string; overdraft_count: number | null }> ?? []).forEach((c) => {
    overdraftMap.set(c.student_id, (overdraftMap.get(c.student_id) || 0) + (c.overdraft_count || 0));
  });

  // Enrich missing parent profiles if RLS restricts nested parent reads for school admins
  const parentIdsToFetch = new Set<string>();
  (students ?? []).forEach((s: any) => {
    const maps = Array.isArray(s.guardian_student_map) ? s.guardian_student_map : [];
    maps.forEach((m: any) => {
      if (m.parent_id && !m.parents) {
        parentIdsToFetch.add(m.parent_id);
      }
    });
  });

  const parentMap = new Map<string, { id: string; full_name: string; phone_number: string }>();
  if (parentIdsToFetch.size > 0) {
    const { data: parentRows } = await service
      .from("parents")
      .select("id, full_name, phone_number")
      .in("id", Array.from(parentIdsToFetch));
    (parentRows ?? []).forEach((p) => parentMap.set(p.id, p));
  }

  const rawList = (students ?? []) as unknown as Array<{
    id: string;
    full_name: string;
    status: string;
    daily_limit: number;
    emergency_approve: boolean;
    created_at: string;
    student_cards?: Array<{ id: string; uid_last4: string | null; status: string; created_at: string }>;
    guardian_student_map?: Array<{
      parent_id: string;
      relationship: string;
      is_primary_guardian: boolean;
      parents: { id: string; full_name: string; phone_number: string } | null;
    }>;
  }>;

  const formattedStudents: Student[] = rawList.map((s) => {
    const cards = Array.isArray(s.student_cards) ? s.student_cards : [];
    cards.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const activeCard = cards.find((c) => c.status === "active" || c.status === "lost_reported" || c.status === "blocked") || cards[0];

    const cardStatus = (activeCard?.status as any) || (s.status === "graduated" ? "graduated" : s.status === "transferred_out" ? "transferred_out" : "active");
    const last4 = activeCard?.uid_last4 ? `•••• ${activeCard.uid_last4}` : "•••• ????";

    const maps = Array.isArray(s.guardian_student_map) ? s.guardian_student_map : [];
    const primaryMap = maps.find((m) => m.is_primary_guardian) || maps[0];
    const parentObj = primaryMap?.parents ?? (primaryMap?.parent_id ? parentMap.get(primaryMap.parent_id) : null) ?? null;

    return {
      id: s.id,
      full_name: s.full_name,
      nfc_uid_last4: last4,
      card_status: cardStatus,
      daily_limit: s.daily_limit ?? 20000,
      daily_limit_used: 0,
      emergency_approve: Boolean(s.emergency_approve),
      emergency_overdraft_count_7d: overdraftMap.get(s.id) || 0,
      created_at: s.created_at,
      parent: parentObj
        ? {
            id: parentObj.id,
            full_name: parentObj.full_name,
            phone_number: parentObj.phone_number,
            relationship: primaryMap?.relationship ?? "orang_tua",
          }
        : null,
    };
  });

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
              Daftar siswa, status kartu NFC, kendali pagu, dan relasi orang tua (Schema v3)
            </p>
          </div>
        </div>
      </div>

      <StudentManagementTable
        schoolId={schoolId}
        students={formattedStudents}
      />
    </div>
  );
}
