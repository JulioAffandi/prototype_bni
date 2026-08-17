"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, SlidersHorizontal, Receipt, Bell, User } from "lucide-react";

export const PARENT_NAV_ITEMS = [
  { href: "/dashboard", label: "Beranda", icon: Home },
  { href: "/pagu", label: "Pagu", icon: SlidersHorizontal },
  { href: "/spp", label: "SPP", icon: Receipt },
  { href: "/notifikasi", label: "Notifikasi", icon: Bell },
  { href: "/profil", label: "Profil", icon: User },
] as const;

export default function BottomBar5Menu() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigasi utama orang tua"
      className="fixed inset-x-0 bottom-3 z-40 mx-auto flex w-[min(94%,28rem)] items-center justify-between rounded-portal-lg border border-portal-border bg-portal-surface/95 px-2 py-2 shadow-portal-card backdrop-blur-xl"
    >
      {PARENT_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active =
          pathname === href ||
          (href !== "/dashboard" && pathname.startsWith(href)) ||
          (href === "/profil" && pathname.startsWith("/profile"));

        return (
          <Link
            key={href}
            href={href}
            id={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[44px] min-w-[3.25rem] flex-1 flex-col items-center justify-center gap-1 rounded-portal px-2 py-1.5 text-[11px] font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-portal-primary ${
              active
                ? "bg-portal-primary/10 text-portal-primary scale-105"
                : "text-portal-muted hover:bg-portal-surface-alt hover:text-portal-text"
            }`}
          >
            <Icon
              size={19}
              strokeWidth={active ? 2.5 : 2}
              className={active ? "text-portal-primary" : "text-portal-muted"}
            />
            <span className="leading-none">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
