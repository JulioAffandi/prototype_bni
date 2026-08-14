import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import ParentBottomNav from "@/components/parent/ParentBottomNav";

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

  const appMetadata = user.app_metadata || {};
  const userRoles: string[] = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];

  let isParent = userRoles.includes("parent") || userRoles.includes("platform_admin");

  if (!isParent) {
    const service = createServiceClient();
    const { data: roles } = await service
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .is("revoked_at", null);

    isParent = roles?.some((r) => r.role === "parent") ?? false;
  }

  if (!isParent) redirect("/login");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 pb-20 overflow-y-auto">
        {children}
      </main>
      <ParentBottomNav />
    </div>
  );
}
