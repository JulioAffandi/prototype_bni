import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import SchoolProfileClient from "@/components/school/SchoolProfileClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profil Sekolah & Pengaturan",
};

export default async function SchoolProfilePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const appMetadata = user.app_metadata || {};
  const schoolIds: string[] = Array.isArray(appMetadata.school_ids) ? appMetadata.school_ids : [];

  let targetSchoolId = schoolIds[0] || null;

  if (!targetSchoolId) {
    const { data: roles } = await service
      .from("user_roles")
      .select("school_id")
      .eq("user_id", user.id)
      .is("revoked_at", null);

    const activeRole = roles?.find((r) => r.school_id);
    if (activeRole?.school_id) {
      targetSchoolId = activeRole.school_id;
    }
  }

  if (!targetSchoolId) {
    const { data: firstSchool } = await service
      .from("schools")
      .select("id")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (firstSchool?.id) targetSchoolId = firstSchool.id;
  }

  const { data: schoolData } = targetSchoolId
    ? await service
        .from("schools")
        .select("id, name, npsn, bni_giro_account, address, default_daily_limit, default_emergency_limit, status")
        .eq("id", targetSchoolId)
        .maybeSingle()
    : { data: null };

  const school = schoolData || {
    id: targetSchoolId || "00000000-0000-0000-0000-000000000001",
    name: "SMA Negeri 1 Jakarta",
    npsn: "20101234",
    bni_giro_account: "00123456789",
    address: "Jl. Pemuda No. 100, Rawamangun, Jakarta Timur",
    default_daily_limit: 20000,
    default_emergency_limit: 15000,
    status: "active",
  };

  return (
    <SchoolProfileClient
      user={{
        id: user.id,
        email: user.email || "",
        displayName: user.user_metadata?.full_name || "School Admin",
      }}
      school={school}
    />
  );
}
