import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { BottomDock } from "./_components/BottomDock";
import AiAssistant from "@/components/chat/AiAssistant";

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
    <div data-portal="parent" className="relative min-h-screen pb-28">
      {/* Soft radial glow di belakang hero balance — signature Parent Hub */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 animate-glow-pulse"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, var(--portal-primary) 0%, transparent 70%)",
        }}
      />

      <main className="relative mx-auto w-full max-w-md px-4 pt-6">
        {children}
      </main>

      <BottomDock />
      <AiAssistant persona="parent" />
    </div>
  );
}

