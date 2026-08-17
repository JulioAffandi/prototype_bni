import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import NfcCardClient, { type KtaStudentData } from "@/components/parent/NfcCardClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Kartu Digital",
  description: "Manajemen Kartu Fisik NFC Siswa BNI EduConnect",
};

export default async function KartuPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login/parent");
  }

  const service = createServiceClient() as any;

  // 1. Get Parent Record — resolve lewat auth_user_id / id / email agar tahan
  //    terhadap perbedaan cara parent record dibuat (seed vs signup).
  const parentFilters = [`auth_user_id.eq.${user.id}`, `id.eq.${user.id}`];
  if (user.email) parentFilters.push(`email.eq.${user.email}`);

  const { data: parentRecord, error: parentError } = await service
    .from("parents")
    .select("id, auth_user_id, email, full_name")
    .or(parentFilters.join(","))
    .maybeSingle();

  if (parentError) console.error("[kartu] parents query failed:", parentError.message);

  const possibleParentIds = Array.from(
    new Set(
      [parentRecord?.id, parentRecord?.auth_user_id, user.id].filter(
        (id): id is string => Boolean(id)
      )
    )
  );

  // 2. Get Linked Student IDs
  const { data: mappings, error: mappingError } = await service
    .from("guardian_student_map")
    .select("student_id")
    .in("parent_id", possibleParentIds);

  if (mappingError) console.error("[kartu] guardian_student_map query failed:", mappingError.message);

  let studentIds = (mappings || []).map((m: any) => m.student_id);

  // 3. Fallback: jika belum ada mapping, pakai demo students (konsisten dgn pola /pagu)
  if (studentIds.length === 0) {
    const { data: allStudents, error: fallbackError } = await service
      .from("students")
      .select("id")
      .is("deleted_at", null)
      .limit(5);
    if (fallbackError) console.error("[kartu] fallback students query failed:", fallbackError.message);
    studentIds = (allStudents || []).map((s: any) => s.id);
  }

  // 4. Fetch Students Data
  //    NOTE: jangan select kolom yang tidak ada di skema (mis. class_label) —
  //    PostgREST menggagalkan seluruh query dan halaman jatuh ke empty state.
  const { data: rawStudents, error: studentsError } = await service
    .from("students")
    .select(
      "id, school_id, full_name, student_number, grade_level, class_group, daily_limit, emergency_limit, emergency_approve, card_status"
    )
    .in("id", studentIds)
    .is("deleted_at", null);

  if (studentsError) console.error("[kartu] students query failed:", studentsError.message);

  // 5. Fetch Schools & Active Cards secara terpisah (hindari nested select bermasalah)
  const schoolIds = Array.from(
    new Set((rawStudents || []).map((s: any) => s.school_id).filter(Boolean))
  );
  const { data: rawSchools } = await service
    .from("schools")
    .select("id, name, code")
    .in("id", schoolIds);

  const { data: rawCards } = await service
    .from("student_cards")
    .select("student_id, card_uid_last4, uid_last4, is_active, status")
    .in("student_id", studentIds);

  const schoolMap = new Map<string, any>((rawSchools || []).map((sc: any) => [sc.id, sc]));

  // Ambil satu kartu aktif per siswa (fallback ke kartu terakhir jika tidak ada yang aktif)
  const cardMap = new Map<string, any>();
  (rawCards || []).forEach((cd: any) => {
    if (!cardMap.has(cd.student_id) || cd.is_active || cd.status === "active") {
      cardMap.set(cd.student_id, cd);
    }
  });

  const formattedStudents: KtaStudentData[] = (rawStudents || []).map((s: any) => {
    const school = schoolMap.get(s.school_id);
    const card = cardMap.get(s.id);
    const last4 = card?.card_uid_last4 || card?.uid_last4;
    const cardStatus = card?.status || s.card_status || "ACTIVE";

    return {
      id: s.id,
      fullName: s.full_name,
      studentNumber: s.student_number || "20261001",
      schoolName: school?.name || "SMA BNI Harapan Bangsa",
      gradeClass: `${s.grade_level || ""} ${s.class_group || ""}`.trim(),
      dailyLimit: Number(s.daily_limit) || 25000,
      emergencyLimit: Number(s.emergency_limit) || 15000,
      emergencyApprove: Boolean(s.emergency_approve),
      cardStatus: typeof cardStatus === "string" ? cardStatus.toUpperCase() : "ACTIVE",
      cardLast4: last4 ? `**** **** **** ${last4}` : "**** **** **** 8E01",
    };
  });

  return (
    <div className="space-y-4">
      <div className="pb-1 pt-1">
        <h1 className="text-xl font-extrabold tracking-tight text-portal-text">Kartu Digital</h1>
        <p className="mt-0.5 text-xs text-portal-muted">
          Kartu KTA NFC EduConnect &amp; ekosistem penerimaan sekolah anak Anda
        </p>
      </div>

      <NfcCardClient initialStudents={formattedStudents} />
    </div>
  );
}
