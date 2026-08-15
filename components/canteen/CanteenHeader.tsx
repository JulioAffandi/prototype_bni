"use client";

import { useState, useEffect } from "react";
import {
  Store,
  Wifi,
  WifiOff,
  BarChart3,
  Bot,
  Settings,
  Utensils,
  User,
} from "lucide-react";
import Link from "next/link";
import OfflineQueueIndicator from "./OfflineQueueIndicator";

interface CanteenHeaderProps {
  merchantName: string;
}

export default function CanteenHeader({ merchantName }: CanteenHeaderProps) {
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
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md">
      <div className="flex items-center justify-between px-4 h-14">
        {/* Left — merchant info */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center">
            <Store className="w-4 h-4 text-accent" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">{merchantName}</p>
            <div className="flex items-center gap-1 mt-0.5">
              {isOnline ? (
                <>
                  <Wifi className="w-3 h-3 text-primary" />
                  <span className="text-xs text-primary">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-destructive" />
                  <span className="text-xs text-destructive">Offline</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-2">
          <OfflineQueueIndicator />
          <Link
            href="/pos/menu"
            id="menu-management-link"
            className="w-8 h-8 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors"
            title="Kelola Menu & Stok"
            aria-label="Kelola Menu & Stok"
          >
            <Utensils className="w-4 h-4 text-muted-foreground" />
          </Link>
          <Link
            href="/pos/settlement"
            id="settlement-link"
            className="w-8 h-8 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors"
            title="Settlement H+0"
            aria-label="Settlement H+0"
          >
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </Link>
          <Link
            href="/pos/ai"
            id="ai-advisor-link"
            className="w-8 h-8 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors"
            title="AI Sales Advisor"
            aria-label="AI Sales Advisor"
          >
            <Bot className="w-4 h-4 text-muted-foreground" />
          </Link>
          <Link
            href="/pos/profile"
            id="profile-link"
            className="w-8 h-8 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors"
            title="Profil Stand Kantin"
            aria-label="Profil Stand Kantin"
          >
            <User className="w-4 h-4 text-muted-foreground" />
          </Link>
          <Link
            href="/pos/settings"
            id="settings-link"
            className="w-8 h-8 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors"
            title="Pengaturan Telegram"
            aria-label="Pengaturan Telegram"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </header>
  );
}
