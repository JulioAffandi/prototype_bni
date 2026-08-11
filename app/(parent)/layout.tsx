import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ParentBottomNav from "@/components/parent/ParentBottomNav";
import type { ProfileRow } from "@/types/database";

export const metadata: Metadata = {
  title: "Parent Control App",
  description: "Kontrol pagu harian, pantau tabungan, dan kelola SPP anak Anda.",
};

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const profile = profileData as Pick<ProfileRow, "role"> | null;

  if (!profile || profile.role !== "parent") redirect("/login");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 pb-20 overflow-y-auto">
        {children}
      </main>
      <ParentBottomNav />
    </div>
  );
}
