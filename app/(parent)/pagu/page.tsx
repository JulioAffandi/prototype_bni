import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import PaguManagementClient, { type StudentPaguData } from "@/components/parent/PaguManagementClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = { title: "Atur Pagu Harian" };

export default async function PaguPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login/parent");
  }

  const service = createServiceClient();

  // 1. Get Parent Record
  const { data: parentRecord } = await service
    .from("parents")
    .select("id, email, full_name")
    .or(`id.eq.${user.id},email.eq.${user.email}`)
    .maybeSingle();

  const possibleParentIds = Array.from(
    new Set([parentRecord?.id, user.id].filter((id): id is string => Boolean(id)))
  );

  // 2. Get Linked Student IDs
  const { data: mappings } = await service
    .from("guardian_student_map")
    .select("student_id")
    .in("parent_id", possibleParentIds);

  let studentIds = (mappings || []).map((m: any) => m.student_id);

  // 3. Fallback: If no mappings found, fetch all demo students
  if (studentIds.length === 0) {
    const { data: allStudents } = await service
      .from("students")
      .select("id")
      .is("deleted_at", null)
      .limit(5);
    studentIds = (allStudents || []).map((s: any) => s.id);
  }

  // 4. Fetch Students Data
  const { data: rawStudents } = await service
    .from("students")
    .select("id, school_id, full_name, student_number, grade_level, class_group, daily_limit, daily_limit_used, emergency_limit, emergency_approve, card_status")
    .in("id", studentIds)
    .is("deleted_at", null);

  // 5. Fetch Schools & Active Cards Separately
  const schoolIds = Array.from(new Set((rawStudents || []).map((s: any) => s.school_id).filter(Boolean)));
  const { data: rawSchools } = await service
    .from("schools")
    .select("id, name, code")
    .in("id", schoolIds);

  const { data: rawCards } = await service
    .from("student_cards")
    .select("student_id, card_uid_last4, uid_last4, is_active, status")
    .in("student_id", studentIds);

  const schoolMap = new Map((rawSchools || []).map((sc: any) => [sc.id, sc]));
  
  const cardMap = new Map<string, any>();
  (rawCards || []).forEach((cd: any) => {
    if (!cardMap.has(cd.student_id) || cd.is_active || cd.status === "active") {
      cardMap.set(cd.student_id, cd);
    }
  });

  const formattedStudents: StudentPaguData[] = (rawStudents || []).map((s: any) => {
    const school = schoolMap.get(s.school_id);
    const card = cardMap.get(s.id);
    const last4 = card?.card_uid_last4 || card?.uid_last4;

    return {
      id: s.id,
      schoolId: s.school_id || "SCH-DEFAULT",
      schoolName: school?.name || "SMA BNI Harapan Bangsa",
      schoolCode: school?.code || "BNI-SCH",
      fullName: s.full_name,
      studentNumber: s.student_number || "20261001",
      gradeClass: `${s.grade_level || ""} ${s.class_group || ""}`.trim(),
      dailyLimit: Number(s.daily_limit) || 20000,
      dailyLimitUsed: Number(s.daily_limit_used) || 0,
      emergencyLimit: Number(s.emergency_limit) || 15000,
      emergencyApprove: Boolean(s.emergency_approve),
      cardStatus: s.card_status || "ACTIVE",
      cardLast4: last4 ? `****${last4}` : "****8E01",
    };
  });

  return (
    <div className="space-y-4">
      <div className="pt-1 pb-1">
        <h1 className="text-xl font-extrabold text-portal-text tracking-tight">Atur Pagu Harian</h1>
        <p className="text-xs text-portal-muted mt-0.5">
          Kontrol batas belanja harian, auto-approval darurat &amp; alokasi tabungan otomatis anak
        </p>
      </div>

      <PaguManagementClient initialStudents={formattedStudents} />
    </div>
  );
}
