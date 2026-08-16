"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, PiggyBank, User } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Beranda", icon: Home },
  { href: "/dashboard/wallet", label: "Dompet", icon: Wallet },
  { href: "/dashboard/vault", label: "Vault", icon: PiggyBank },
  { href: "/dashboard/profile", label: "Profil", icon: User },
] as const;

export function BottomDock() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-[min(92%,26rem)] items-center justify-between rounded-portal-lg border border-portal-border bg-portal-surface/80 px-3 py-2 shadow-portal-glow backdrop-blur-xl"
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-tap min-w-tap flex-col items-center justify-center gap-1 rounded-portal px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-portal-primary ${
              active
                ? "bg-portal-primary text-portal-primary-foreground"
                : "text-portal-muted hover:text-portal-text"
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 2} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
