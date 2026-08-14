import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";

/**
 * Root page — redirects to the appropriate portal based on user roles (Schema v3).
 * Unauthenticated users are redirected to /login.
 */
export default async function RootPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const appMetadata = user.app_metadata || {};
  const userRoles: string[] = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];

  let primaryRole: string | undefined = userRoles[0];

  if (!primaryRole) {
    const service = createServiceClient();
    const { data: roles } = await service
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .is("revoked_at", null);

    primaryRole = roles?.[0]?.role;
  }

  switch (primaryRole) {
    case "parent":
      redirect("/parent");
    case "merchant_staff":
    case "merchant_owner":
      redirect("/pos");
    case "school_admin":
    case "school_treasurer":
      redirect("/school");
    case "platform_admin":
    case "platform_support":
      redirect("/admin");
    default:
      redirect("/login");
  }
}
