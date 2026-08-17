import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import ChildProfileClient, { StudentProfileData } from "@/components/parent/ChildProfileClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profil Anak & Siswa",
  description: "Informasi Lengkap Identitas Siswa, Wali Terverifikasi & Batas Pagu",
};

export default async function ChildProfilePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login/parent");
  }

  const service = createServiceClient() as any;

  // 1. Fetch Student Details
  const { data: student } = await service
    .from("students")
    .select(`
      id,
      school_id,
      full_name,
      student_number,
      grade_level,
      class_group,
      daily_limit,
      emergency_limit,
      emergency_approve,
      card_status,
      schools(id, name, code)
    `)
    .eq("id", studentId)
    .maybeSingle();

  // 2. Fetch Card
  const { data: card } = await service
    .from("student_cards")
    .select("card_uid_last4, uid_last4, status")
    .eq("student_id", studentId)
    .maybeSingle();

  // 3. Fetch Guardians
  const { data: rawGuardians } = await service
    .from("guardian_student_map")
    .select(`
      id,
      relationship,
      is_primary_guardian,
      parents ( id, full_name, phone_number )
    `)
    .eq("student_id", studentId);

  const last4 = card?.card_uid_last4 || card?.uid_last4 || "8E01";

  const guardiansList = (rawGuardians || []).map((g: any) => ({
    id: g.id,
    fullName: g.parents?.full_name || "Wali Siswa",
    relationship: g.relationship || "Wali",
    phone: g.parents?.phone_number || "-",
    isPrimary: Boolean(g.is_primary_guardian),
  }));

  if (guardiansList.length === 0) {
    guardiansList.push({
      id: "guard-1",
      fullName: user.user_metadata?.full_name || "Wali Utama",
      relationship: "Orang Tua",
      phone: user.phone || "-",
      isPrimary: true,
    });
  }

  const studentProfile: StudentProfileData = {
    id: student?.id || studentId,
    fullName: student?.full_name || "Kenzou Tanaka",
    studentNumber: student?.student_number || "20261001",
    gradeClass: `${student?.grade_level || "X"} ${student?.class_group || "A"}`.trim(),
    schoolName: student?.schools?.name || "SMA BNI Harapan Bangsa",
    schoolCode: student?.schools?.code || "BNI-SCH",
    dailyLimit: Number(student?.daily_limit) || 20000,
    emergencyLimit: Number(student?.emergency_limit) || 15000,
    emergencyApprove: Boolean(student?.emergency_approve),
    cardUid: `KENZ-2025-${last4}`,
    cardStatus: (card?.status || student?.card_status || "ACTIVE").toUpperCase(),
    guardians: guardiansList,
  };

  return (
    <div className="space-y-4">
      <div className="pt-1 pb-1">
        <h1 className="text-xl font-extrabold text-portal-text tracking-tight">Profil Anak</h1>
        <p className="text-xs text-portal-muted mt-0.5">
          Data identitas siswa, sekolah terdaftar &amp; daftar wali terverifikasi
        </p>
      </div>

      <ChildProfileClient student={studentProfile} />
    </div>
  );
}
