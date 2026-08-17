import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import TopUpClient from "@/components/parent/TopUpClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Top Up Saldo BNI",
  description: "Isi Ulang Saldo Dompet Wali Siswa EduConnect",
};

export default async function TopUpPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login/parent");
  }

  const service = createServiceClient() as any;

  // 1. Get Parent Record
  const { data: parentRecord } = await service
    .from("parents")
    .select("id, email, full_name, wallet_balance, bni_account_number, bni_account_name")
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

  const { data: rawStudents } = studentIds.length > 0
    ? await service
        .from("students")
        .select("id, full_name, schools(name)")
        .in("id", studentIds)
        .is("deleted_at", null)
    : { data: [] };

  const childrenList = (rawStudents || []).map((s: any) => ({
    id: s.id,
    fullName: s.full_name,
    schoolName: s.schools?.name || "SMA BNI Harapan Bangsa",
  }));

  return (
    <div className="space-y-4">
      <div className="pt-1 pb-1">
        <h1 className="text-xl font-extrabold text-portal-text tracking-tight">Top Up Saldo</h1>
        <p className="text-xs text-portal-muted mt-0.5">
          Isi ulang saldo dompet utama wali untuk alokasi pagu dan SPP sekolah
        </p>
      </div>

      <TopUpClient
        initialBalance={Number(parentRecord?.wallet_balance ?? 1500000)}
        accountNumber={parentRecord?.bni_account_number || "00023213823"}
        accountName={parentRecord?.bni_account_name || parentRecord?.full_name || "Wali Siswa"}
        childrenList={childrenList}
      />
    </div>
  );
}
