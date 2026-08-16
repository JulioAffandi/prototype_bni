"use client";

import { useState, useEffect } from "react";
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
  Wallet,
  ShoppingCart,
  Boxes,
  Landmark,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { handleLogout } from "@/lib/auth/actions";

interface SidebarProps {
  schoolName?: string;
}

type NavLeaf = {
  kind: "leaf";
  id: string;
  num?: string;
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavGroup = {
  kind: "group";
  id: string;
  num?: string;
  label: string;
  icon: LucideIcon;
  children: NavLeaf[];
};

type NavItem = NavLeaf | NavGroup;

const NAV_ITEMS: NavItem[] = [
  {
    kind: "leaf",
    id: "school-nav-dashboard",
    num: "01",
    href: "/school",
    label: "Home",
    icon: LayoutDashboard,
  },
  {
    kind: "leaf",
    id: "school-nav-assets",
    num: "02",
    href: "/school/assets",
    label: "Asset Management",
    icon: Boxes,
  },
  {
    kind: "group",
    id: "school-nav-billing",
    num: "03",
    label: "Billing & Student Management",
    icon: Users,
    children: [
      {
        kind: "leaf",
        id: "school-nav-students",
        href: "/school/students",
        label: "Roster Siswa & NFC",
        icon: Users,
      },
      {
        kind: "leaf",
        id: "school-nav-spp",
        href: "/school/spp",
        label: "Tagihan & Multi-Fee",
        icon: FileText,
      },
    ],
  },
  {
    kind: "leaf",
    id: "school-nav-payroll",
    num: "04",
    href: "/school/payroll",
    label: "Payroll & Employee",
    icon: Wallet,
  },
  {
    kind: "leaf",
    id: "school-nav-procurement",
    num: "05",
    href: "/school/procurement",
    label: "Procurement & Supplier",
    icon: ShoppingCart,
  },
  {
    kind: "leaf",
    id: "school-nav-financial",
    num: "06",
    href: "/school/financial",
    label: "Institution Financing",
    icon: Landmark,
  },
  {
    kind: "leaf",
    id: "school-nav-audit",
    num: "07",
    href: "/school/audit",
    label: "Institution Reporting",
    icon: ShieldCheck,
  },
  {
    kind: "leaf",
    id: "school-nav-ai",
    num: "08",
    href: "/school/ai",
    label: "AI Institution Assistant",
    icon: Bot,
  },
];

const SECONDARY_ITEMS: NavLeaf[] = [
  {
    kind: "leaf",
    id: "school-nav-profil-sekolah",
    href: "/school/profile",
    label: "Profil Sekolah",
    icon: User,
  },
  {
    kind: "leaf",
    id: "school-nav-pengaturan",
    href: "/school/settings",
    label: "Pengaturan",
    icon: Settings,
  },
];

export function Sidebar({ schoolName = "VALO School" }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Automatically open groups if child active
    NAV_ITEMS.forEach((item) => {
      if (item.kind === "group") {
        const isChildActive = item.children.some((child) => pathname.startsWith(child.href));
        if (isChildActive) {
          setOpenGroups((prev) => ({ ...prev, [item.id]: true }));
        }
      }
    });
  }, [pathname]);

  const toggleGroup = (groupId: string) => {
    if (collapsed) {
      setCollapsed(false);
    }
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const isLeafActive = (leaf: NavLeaf) => {
    if (leaf.href === "/school") {
      return pathname === "/school";
    }
    return pathname.startsWith(leaf.href);
  };

  const isGroupActive = (group: NavGroup) => {
    return group.children.some((child) => pathname.startsWith(child.href));
  };

  return (
    <aside
      data-portal="school"
      className={`sticky top-0 h-screen shrink-0 border-r border-portal-border bg-gradient-to-b from-[var(--color-fin-sidebar-from)] to-[var(--color-fin-sidebar-to)] text-white flex flex-col transition-[width] duration-200 z-30 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 truncate">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 border border-white/20 text-white">
              <GraduationCap size={18} />
            </div>
            <div className="truncate">
              <p className="text-[10px] uppercase tracking-wider text-white/60 font-medium">EduConnect</p>
              <p className="truncate text-xs font-semibold text-white">{schoolName}</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 border border-white/20 text-white">
            <GraduationCap size={18} />
          </div>
        )}

        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
          className="ml-auto rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto space-y-1 p-2 scrollbar-thin">
        {NAV_ITEMS.map((item) => {
          if (item.kind === "leaf") {
            const active = isLeafActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                id={item.id}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50 ${
                  active
                    ? "bg-white/20 text-white font-semibold shadow-sm backdrop-blur-sm border border-white/20"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.num && !collapsed && (
                  <span className="text-[10px] font-mono text-white/50 w-4 shrink-0 tabular-nums">{item.num}</span>
                )}
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate flex-1">{item.label}</span>}
              </Link>
            );
          }

          // Group
          const active = isGroupActive(item);
          const isOpen = !!openGroups[item.id];
          const Icon = item.icon;

          return (
            <div key={item.id} className="space-y-1">
              <button
                type="button"
                id={item.id}
                onClick={() => toggleGroup(item.id)}
                aria-expanded={isOpen}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50 ${
                  active
                    ? "bg-white/15 text-white font-semibold"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.num && !collapsed && (
                  <span className="text-[10px] font-mono text-white/50 w-4 shrink-0 tabular-nums">{item.num}</span>
                )}
                <Icon size={18} className="shrink-0" />
                {!collapsed && (
                  <>
                    <span className="truncate flex-1 text-left">{item.label}</span>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </>
                )}
              </button>

              {/* Submenu */}
              {isOpen && !collapsed && (
                <div className="ml-7 space-y-1 pl-2 border-l border-white/15">
                  {item.children.map((child) => {
                    const childActive = isLeafActive(child);
                    const ChildIcon = child.icon;
                    return (
                      <Link
                        key={child.id}
                        href={child.href}
                        id={child.id}
                        aria-current={childActive ? "page" : undefined}
                        className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          childActive
                            ? "bg-white/20 text-white font-semibold"
                            : "text-white/75 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <ChildIcon size={15} className="shrink-0" />
                        <span className="truncate">{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Divider */}
        <div className="pt-2 pb-1 border-t border-white/10 my-2" />

        {/* Secondary footer items */}
        {SECONDARY_ITEMS.map((item) => {
          const active = isLeafActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              id={item.id}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                active
                  ? "bg-white/20 text-white font-semibold"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer: SNAP BI status & Logout */}
      <div className="border-t border-white/10 p-3 space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Building2 size={16} className="text-white/60 shrink-0" />
          {!collapsed && (
            <div className="truncate">
              <p className="text-[10px] text-white/60 leading-tight">Terhubung ke BNI H2H</p>
              <div className="flex items-center gap-1 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[11px] text-emerald-300 font-medium">SNAP BI Active</span>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          id="school-logout-sidebar-btn"
          onClick={() => handleLogout("/login")}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/20 hover:text-white transition-colors border border-rose-400/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span className="truncate">Keluar / Switch User</span>}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
