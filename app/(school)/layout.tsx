import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "school_admin") redirect("/login");

  const { data: school } = profile.school_id
    ? await supabase.from("schools").select("name, status").eq("id", profile.school_id).single()
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
