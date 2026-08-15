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
    const { data: userRole } = await service
      .from("user_roles")
      .select("school_id")
      .eq("user_id", user.id)
      .not("school_id", "is", null)
      .maybeSingle();

    if (userRole?.school_id) {
      targetSchoolId = userRole.school_id;
    }
  }

  if (!targetSchoolId) {
    const { data: firstSchool } = await service
      .from("schools")
      .select("id")
      .order("created_at")
      .limit(1)
      .single();
    if (firstSchool) targetSchoolId = firstSchool.id;
  }

  const { data: school } = targetSchoolId
    ? await service
        .from("schools")
        .select("id, name, npsn, bni_giro_account, address, default_daily_limit, default_emergency_limit, status")
        .eq("id", targetSchoolId)
        .single()
    : { data: null };

  if (!school) {
    redirect("/school");
  }

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
