"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  ShieldCheck,
  Bot,
  User,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  GraduationCap,
  Building2,
  LogOut,
} from "lucide-react";
import { handleLogout } from "@/lib/auth/actions";

interface SidebarProps {
  schoolName?: string;
}

const NAV_ITEMS = [
  { href: "/school", label: "Dashboard", icon: LayoutDashboard },
  { href: "/school/spp", label: "Rekonsiliasi SPP", icon: FileText },
  { href: "/school/students", label: "Manajemen Siswa", icon: Users },
  { href: "/school/audit", label: "Audit & Kepatuhan", icon: ShieldCheck },
  { href: "/school/ai", label: "Treasury AI", icon: Bot },
  { href: "/school/profile", label: "Profil Sekolah", icon: User },
  { href: "/school/settings", label: "Pengaturan", icon: Settings },
] as const;

export function Sidebar({ schoolName = "VALO School" }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={`sticky top-0 h-screen shrink-0 border-r border-portal-border bg-portal-surface flex flex-col transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-portal-border px-4">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 truncate">
            <div className="flex h-8 w-8 items-center justify-center rounded-portal bg-portal-primary/15 border border-portal-primary/30 text-portal-primary">
              <GraduationCap size={18} />
            </div>
            <div className="truncate">
              <p className="text-[10px] uppercase tracking-wider text-portal-muted">VALO</p>
              <p className="truncate text-xs font-semibold text-portal-text">{schoolName}</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-portal bg-portal-primary/15 border border-portal-primary/30 text-portal-primary">
            <GraduationCap size={18} />
          </div>
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

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto space-y-1 p-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/school" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              id={`school-nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-portal px-3 py-2 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-portal-primary ${
                active
                  ? "bg-portal-primary text-portal-primary-foreground font-semibold"
                  : "text-portal-muted hover:bg-portal-surface-alt hover:text-portal-text"
              }`}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer: SNAP BI status & Logout */}
      <div className="border-t border-portal-border p-3 space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Building2 size={16} className="text-portal-muted shrink-0" />
          {!collapsed && (
            <div className="truncate">
              <p className="text-[10px] text-portal-muted leading-tight">Terhubung ke BNI H2H</p>
              <div className="flex items-center gap-1 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-portal-success" />
                <span className="text-[11px] text-portal-success font-medium">SNAP BI Active</span>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          id="school-logout-sidebar-btn"
          onClick={() => handleLogout("/login")}
          className="flex w-full items-center gap-3 rounded-portal px-3 py-2 text-xs font-semibold text-portal-danger hover:bg-portal-danger/15 transition-colors border border-portal-danger/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-portal-primary"
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span className="truncate">Keluar / Switch User</span>}
        </button>
      </div>
    </aside>
  );
}
