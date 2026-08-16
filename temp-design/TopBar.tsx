"use client";

import { CircleUserRound, Wifi } from "lucide-react";

export function TopBar() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-portal-border bg-portal-surface px-4">
      <div className="flex items-center gap-2">
        <span className="rounded-portal bg-portal-primary px-3 py-1.5 text-sm font-bold text-portal-primary-foreground">
          KANTIN
        </span>
        <span className="font-portal-mono text-xs text-portal-muted">
          Kasir #01
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 rounded-portal border border-portal-success/40 bg-portal-success/10 px-2.5 py-1 text-xs font-medium text-portal-success">
          <Wifi size={14} />
          H+0 Settlement Aktif
        </span>

        <button
          type="button"
          className="flex min-h-tap min-w-tap items-center gap-2 rounded-portal border border-portal-border px-3 text-sm text-portal-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-portal-primary"
        >
          <CircleUserRound size={20} />
          Merchant
        </button>
      </div>
    </header>
  );
}
