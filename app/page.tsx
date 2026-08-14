import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Root page — redirects to the appropriate portal based on user role.
 * Unauthenticated users are redirected to /login.
 */
export default async function RootPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const profile = profileData as { role: string } | null;

  if (!profile) redirect("/login");

  switch (profile.role) {
    case "parent":
      redirect("/dashboard");
    case "merchant_staff":
      redirect("/pos");
    case "school_admin":
      redirect("/school");
    case "platform_admin":
      redirect("/admin");
    default:
      redirect("/login");
  }
}
