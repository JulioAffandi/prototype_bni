import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import BottomBar5Menu from "@/components/shared/BottomBar5Menu";
import AiAssistant from "@/components/chat/AiAssistant";
import { plusJakartaSans } from "@/lib/fonts";

export const metadata: Metadata = {
  title: {
    template: "%s | EduConnect Parent",
    default: "EduConnect Parent Portal",
  },
  description: "Portal Terpadu Orang Tua EduConnect — Pantau Saldo, Atur Pagu Harian, SPP & Kartu Pelajar BNI.",
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
    <div
      data-portal="parent"
      className={`${plusJakartaSans.variable} font-portal-sans relative min-h-screen bg-portal-bg text-portal-text antialiased pb-28 selection:bg-portal-primary/20 selection:text-portal-primary`}
    >
      {/* Soft gradient aura glow at the top for premium light fintech vibe */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 opacity-40 blur-3xl overflow-hidden -z-0"
        style={{
          background:
            "radial-gradient(ellipse 75% 50% at 50% -10%, rgba(115, 87, 199, 0.35) 0%, rgba(249, 115, 22, 0.15) 50%, transparent 100%)",
        }}
      />

      <main className="relative z-10 mx-auto w-full max-w-md px-4 pt-4 sm:pt-6">
        {children}
      </main>

      <BottomBar5Menu />
      <AiAssistant persona="parent" />
    </div>
  );
}
