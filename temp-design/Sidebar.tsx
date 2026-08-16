"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Receipt,
  FileBarChart,
  ShieldAlert,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/school", label: "Ringkasan", icon: LayoutDashboard },
  { href: "/school/students", label: "Siswa & NISN", icon: Users },
  { href: "/school/spp", label: "Tagihan SPP", icon: Receipt },
  { href: "/school/reports", label: "Laporan", icon: FileBarChart },
  { href: "/school/audit", label: "Audit & Dispute", icon: ShieldAlert },
] as const;

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={`sticky top-0 h-screen shrink-0 border-r border-portal-border bg-portal-surface transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex h-14 items-center justify-between border-b border-portal-border px-4">
        {!collapsed && (
          <span className="truncate text-sm font-semibold text-portal-text">
            VALO School
          </span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
          className="ml-auto rounded-portal p-1.5 text-portal-muted hover:bg-portal-surface-alt hover:text-portal-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-portal-primary"
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>

      <nav className="flex flex-col gap-1 p-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-portal px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-portal-primary ${
                active
                  ? "bg-portal-primary text-portal-primary-foreground"
                  : "text-portal-muted hover:bg-portal-surface-alt hover:text-portal-text"
              }`}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
