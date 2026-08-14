import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import SchoolSidebar from "@/components/school/SchoolSidebar";

export const metadata: Metadata = {
  title: {
    default: "VALO School Portal",
    template: "%s | VALO School Portal",
  },
  description: "Portal B2B Sekolah — Rekonsiliasi SPP, Manajemen Siswa, dan Treasury AI",
};

export default async function SchoolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const appMetadata = user.app_metadata || {};
  const userRoles: string[] = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
  const userSchoolIds: string[] = Array.isArray(appMetadata.school_ids) ? appMetadata.school_ids : [];

  const service = createServiceClient();
  let schoolId: string | null = userSchoolIds[0] || null;
  let isSchoolStaff = userRoles.includes("school_admin") || userRoles.includes("school_treasurer") || userRoles.includes("platform_admin");

  if (!isSchoolStaff || !schoolId) {
    const { data: roles } = await service
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", user.id)
      .is("revoked_at", null);

    const activeRole = roles?.find(
      (r) => r.role === "school_admin" || r.role === "school_treasurer",
    );
    if (activeRole) {
      isSchoolStaff = true;
      schoolId = activeRole.school_id;
    }
  }

  if (!isSchoolStaff) redirect("/login");

  const { data: school } = schoolId
    ? await service.from("schools").select("name, status").eq("id", schoolId).maybeSingle()
    : { data: null };

  return (
    <div className="min-h-screen bg-background flex">
      <SchoolSidebar schoolName={school?.name ?? "Sekolah"} />
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-6 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
