"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Wifi,
  WifiOff,
  Utensils,
  BarChart3,
  Bot,
  User,
  Settings,
  LogOut,
} from "lucide-react";
import OfflineQueueIndicator from "@/components/canteen/OfflineQueueIndicator";
import { handleLogout } from "@/lib/auth/actions";

interface TopBarProps {
  merchantName?: string;
  cashierId?: string;
}

const NAV_LINKS = [
  { href: "/pos/menu", id: "menu-management-link", icon: Utensils, label: "Kelola Menu & Stok" },
  { href: "/pos/settlement", id: "settlement-link", icon: BarChart3, label: "Settlement H+0" },
  { href: "/pos/ai", id: "ai-advisor-link", icon: Bot, label: "AI Sales Advisor" },
  { href: "/pos/profile", id: "profile-link", icon: User, label: "Profil Stand Kantin" },
  { href: "/pos/settings", id: "settings-link", icon: Settings, label: "Pengaturan Telegram" },
];

export function TopBar({ merchantName = "Kantin", cashierId = "Kasir #01" }: TopBarProps) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 text-slate-800 shadow-sm sm:px-4">
      {/* Left: compact brand mark, merchant + cashier pills, connection status */}
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <Link href="/pos" className="inline-flex shrink-0 items-center gap-2 transition-opacity hover:opacity-90">
          {/* logo.png / logo_raw.png are both square 720x720 — render 1:1 so the
              mark stays sharp instead of being letterboxed into a wide box. */}
          <Image
            src="/img/logo_raw.png"
            alt="EduConnect POS"
            width={32}
            height={32}
            priority
            className="h-8 w-8 max-h-8 object-contain"
          />
          <span className="hidden text-sm font-extrabold tracking-tight text-slate-900 sm:inline">
            EduConnect
            <span className="ml-1 rounded-md bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-700">
              POS
            </span>
          </span>
        </Link>

        <div className="hidden h-5 w-px shrink-0 bg-slate-200 sm:block" />

        <div className="flex min-w-0 items-center gap-1.5">
          <span className="flex min-w-0 items-center gap-1.5 rounded-lg border border-orange-200/80 bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-700">
            <Utensils size={13} className="shrink-0 text-orange-600" />
            <span className="truncate">{merchantName}</span>
          </span>

          <span className="hidden rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] font-semibold text-slate-500 lg:inline">
            {cashierId}
          </span>

          <span
            className={`hidden items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold md:flex ${
              isOnline
                ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                : "border-red-200 bg-red-50 text-red-600"
            }`}
          >
            {isOnline ? <Wifi size={11} /> : <WifiOff size={11} />}
            {isOnline ? "Online (Auto-Sync)" : "Offline"}
          </span>
        </div>
      </div>

      {/* Right: utility actions */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <OfflineQueueIndicator />

        {NAV_LINKS.map(({ href, id, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            id={id}
            title={label}
            aria-label={label}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
          >
            <Icon size={18} />
          </Link>
        ))}

        <div className="mx-0.5 hidden h-5 w-px bg-slate-200 sm:block" />

        <button
          type="button"
          id="canteen-header-logout-btn"
          onClick={() => {
            if (confirm("Keluar dari Kasir Stand Kantin?")) {
              handleLogout("/login");
            }
          }}
          title="Keluar Akun Kasir / Switch User"
          aria-label="Keluar Akun Kasir / Switch User"
          className="flex h-9 items-center gap-1.5 rounded-xl bg-slate-100 px-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </header>
  );
}
