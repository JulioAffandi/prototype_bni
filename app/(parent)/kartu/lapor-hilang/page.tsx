import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import ReportLostCardWizard from "@/components/parent/ReportLostCardWizard";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lapor Kartu Hilang",
  description: "Blokir dan Lapor Kartu NFC Hilang atau Rusak",
};

export default async function ReportLostCardPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const { studentId } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login/parent");
  }

  const service = createServiceClient() as any;

  // 1. Get Parent Record
  const { data: parentRecord } = await service
    .from("parents")
    .select("id, email")
    .or(`id.eq.${user.id},email.eq.${user.email}`)
    .maybeSingle();

  const possibleParentIds = Array.from(
    new Set([parentRecord?.id, user.id].filter((id): id is string => Boolean(id)))
  );

  // 2. Resolve Student
  let targetStudentId = studentId;
  if (!targetStudentId) {
    const { data: mappings } = await service
      .from("guardian_student_map")
      .select("student_id")
      .in("parent_id", possibleParentIds)
      .limit(1);

    targetStudentId = mappings?.[0]?.student_id;
  }

  // 3. Fallback to first available student if needed
  if (!targetStudentId) {
    const { data: firstStudent } = await service
      .from("students")
      .select("id")
      .limit(1)
      .single();
    targetStudentId = firstStudent?.id;
  }

  const { data: student } = await service
    .from("students")
    .select("id, full_name, student_number, school_id, schools(name)")
    .eq("id", targetStudentId)
    .maybeSingle();

  const { data: card } = await service
    .from("student_cards")
    .select("card_uid_last4, uid_last4, status")
    .eq("student_id", targetStudentId)
    .maybeSingle();

  const last4 = card?.card_uid_last4 || card?.uid_last4 || "8E01";
  const studentData = {
    id: student?.id || targetStudentId || "STU-001",
    fullName: student?.full_name || "Kenzou Tanaka",
    studentNumber: student?.student_number || "20261001",
    schoolName: student?.schools?.name || "SMA BNI Harapan Bangsa",
    cardUid: `KENZ-2025-${last4}`,
  };

  return (
    <div className="space-y-4">
      <div className="pt-1 pb-1">
        <h1 className="text-xl font-extrabold text-portal-text tracking-tight">Lapor Kartu Hilang</h1>
        <p className="text-xs text-portal-muted mt-0.5">
          Proses blokir instan &amp; pengajuan penerbitan KTA NFC pengganti
        </p>
      </div>

      <ReportLostCardWizard student={studentData} />
    </div>
  );
}
