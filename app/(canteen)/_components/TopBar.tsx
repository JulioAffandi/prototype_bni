"use client";

import { useState, useEffect } from "react";
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
}

export function TopBar({ merchantName = "Kantin" }: TopBarProps) {
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
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-portal-border bg-portal-surface px-4 z-40 sticky top-0">
      {/* Left: Merchant Info & Connection Status */}
      <div className="flex items-center gap-3">
        <Link href="/pos" className="flex items-center gap-2">
          <span className="rounded-portal bg-portal-primary px-3 py-1.5 text-sm font-bold text-portal-primary-foreground">
            {merchantName}
          </span>
          <span className="font-portal-mono text-xs text-portal-muted hidden sm:inline">
            Kasir #01
          </span>
        </Link>

        <span
          className={`flex items-center gap-1.5 rounded-portal border px-2.5 py-1 text-xs font-medium ${
            isOnline
              ? "border-portal-success/40 bg-portal-success/10 text-portal-success"
              : "border-portal-danger/40 bg-portal-danger/10 text-portal-danger"
          }`}
        >
          {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span className="hidden xs:inline">{isOnline ? "H+0 Settlement Aktif" : "Offline"}</span>
        </span>
      </div>

      {/* Right: Actions & Route Links */}
      <div className="flex items-center gap-2">
        <OfflineQueueIndicator />

        <Link
          href="/pos/menu"
          id="menu-management-link"
          className="flex min-h-tap min-w-tap items-center justify-center rounded-portal border border-portal-border text-portal-text hover:bg-portal-surface-alt transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-portal-primary"
          title="Kelola Menu & Stok"
          aria-label="Kelola Menu & Stok"
        >
          <Utensils size={18} />
        </Link>

        <Link
          href="/pos/settlement"
          id="settlement-link"
          className="flex min-h-tap min-w-tap items-center justify-center rounded-portal border border-portal-border text-portal-text hover:bg-portal-surface-alt transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-portal-primary"
          title="Settlement H+0"
          aria-label="Settlement H+0"
        >
          <BarChart3 size={18} />
        </Link>

        <Link
          href="/pos/ai"
          id="ai-advisor-link"
          className="flex min-h-tap min-w-tap items-center justify-center rounded-portal border border-portal-border text-portal-text hover:bg-portal-surface-alt transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-portal-primary"
          title="AI Sales Advisor"
          aria-label="AI Sales Advisor"
        >
          <Bot size={18} />
        </Link>

        <Link
          href="/pos/profile"
          id="profile-link"
          className="flex min-h-tap min-w-tap items-center justify-center rounded-portal border border-portal-border text-portal-text hover:bg-portal-surface-alt transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-portal-primary"
          title="Profil Stand Kantin"
          aria-label="Profil Stand Kantin"
        >
          <User size={18} />
        </Link>

        <Link
          href="/pos/settings"
          id="settings-link"
          className="flex min-h-tap min-w-tap items-center justify-center rounded-portal border border-portal-border text-portal-text hover:bg-portal-surface-alt transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-portal-primary"
          title="Pengaturan Telegram"
          aria-label="Pengaturan Telegram"
        >
          <Settings size={18} />
        </Link>

        <button
          type="button"
          id="canteen-header-logout-btn"
          onClick={() => {
            if (confirm("Keluar dari Kasir Stand Kantin?")) {
              handleLogout("/login");
            }
          }}
          className="flex min-h-tap min-w-tap items-center justify-center rounded-portal border border-portal-danger/30 bg-portal-danger/10 text-portal-danger hover:bg-portal-danger hover:text-white transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-portal-primary"
          title="Keluar Akun Kasir / Switch User"
          aria-label="Keluar Akun Kasir / Switch User"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
