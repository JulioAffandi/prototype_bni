"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  FileText,
  ShieldCheck,
  Bot,
  Building2,
  Settings,
  User,
  LogOut,
} from "lucide-react";
import { handleLogout } from "@/lib/auth/actions";

interface SchoolSidebarProps {
  schoolName: string;
}

const NAV_ITEMS = [
  { href: "/school", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/school/spp", icon: FileText, label: "Rekonsiliasi SPP" },
  { href: "/school/students", icon: Users, label: "Manajemen Siswa" },
  { href: "/school/audit", icon: ShieldCheck, label: "Audit & Kepatuhan" },
  { href: "/school/ai", icon: Bot, label: "Treasury AI" },
  { href: "/school/profile", icon: User, label: "Profil Sekolah" },
  { href: "/school/settings", icon: Settings, label: "Pengaturan" },
] as const;

export default function SchoolSidebar({ schoolName }: SchoolSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 border-r border-border bg-card/95 backdrop-blur-md flex flex-col z-40">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">VALO</p>
            <p className="font-semibold text-sm truncate max-w-32">{schoolName}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href !== "/school" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              id={`school-nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-primary/15 text-primary border border-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* School info footer & Logout */}
      <div className="p-4 border-t border-border space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Terhubung ke BNI H2H</p>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-xs text-primary font-medium">SNAP BI Active</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          id="school-logout-sidebar-btn"
          onClick={() => handleLogout("/login")}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all border border-red-500/20"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Keluar / Switch User</span>
        </button>
      </div>
    </aside>
  );
}
