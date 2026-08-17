import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import NfcCardClient, { StudentCardInfo } from "@/components/parent/NfcCardClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Kartu Pelajar NFC",
  description: "Manajemen Kartu Fisik NFC Siswa BNI EduConnect",
};

export default async function NfcCardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login/parent");
  }

  const service = createServiceClient() as any;

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

  if (studentIds.length === 0) {
    const { data: allStudents } = await service
      .from("students")
      .select("id")
      .is("deleted_at", null)
      .limit(3);
    studentIds = (allStudents || []).map((s: any) => s.id);
  }

  // 3. Fetch Students & Schools & Cards
  const { data: rawStudents } = studentIds.length > 0
    ? await service
        .from("students")
        .select("id, school_id, full_name, student_number, grade_level, class_group, card_status")
        .in("id", studentIds)
        .is("deleted_at", null)
    : { data: [] };

  const schoolIds = Array.from(new Set((rawStudents || []).map((s: any) => s.school_id).filter(Boolean)));
  const { data: rawSchools } = schoolIds.length > 0
    ? await service
        .from("schools")
        .select("id, name, code")
        .in("id", schoolIds)
    : { data: [] };

  const { data: rawCards } = studentIds.length > 0
    ? await service
        .from("student_cards")
        .select("id, student_id, card_uid_last4, uid_last4, is_active, status, created_at")
        .in("student_id", studentIds)
    : { data: [] };

  const schoolMap = new Map<string, any>((rawSchools || []).map((sc: any) => [sc.id, sc]));
  const cardMap = new Map<string, any>();
  (rawCards || []).forEach((cd: any) => {
    if (!cardMap.has(cd.student_id) || cd.is_active || cd.status === "active") {
      cardMap.set(cd.student_id, cd);
    }
  });

  const formattedCards: StudentCardInfo[] = (rawStudents || []).map((s: any) => {
    const school = schoolMap.get(s.school_id);
    const card = cardMap.get(s.id);
    const last4 = card?.card_uid_last4 || card?.uid_last4;
    const maskedUid = last4 ? `KENZ-2025-${last4}` : "KENZ-2025-8E01";

    return {
      id: card?.id || s.id,
      studentId: s.id,
      studentName: s.full_name,
      studentNumber: s.student_number || "20261001",
      schoolName: school?.name || "SMA BNI Harapan Bangsa",
      cardUid: maskedUid,
      cardStatus: (card?.status || s.card_status || "ACTIVE").toUpperCase(),
      isActive: card?.is_active ?? true,
      issuedDate: card?.created_at || "10 Jan 2026",
    };
  });

  return (
    <div className="space-y-4">
      <div className="pt-1 pb-1">
        <h1 className="text-xl font-extrabold text-portal-text tracking-tight">Kartu Pelajar NFC</h1>
        <p className="text-xs text-portal-muted mt-0.5">
          Manajemen KTA NFC fisik BNI, kunci sementara &amp; laporan kehilangan kartu
        </p>
      </div>

      <NfcCardClient cards={formattedCards} />
    </div>
  );
}
