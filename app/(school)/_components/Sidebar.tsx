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
import EduConnectLogo from "@/components/shared/EduConnectLogo";

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

export function Sidebar({ schoolName = "EduConnect School" }: SidebarProps) {
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
      className={`sticky top-0 h-screen shrink-0 border-r border-slate-200/80 bg-white text-slate-900 flex flex-col transition-[width] duration-200 z-30 shadow-xs ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Sidebar Brand Header */}
      <div className="h-16 px-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        {!collapsed ? (
          <div className="flex items-center gap-3 min-w-0">
            {/* Compact Icon Container */}
            <div className="w-8 h-8 rounded-xl bg-indigo-50/80 border border-indigo-100 flex items-center justify-center shrink-0 shadow-xs">
              <EduConnectLogo variant="icon" width={20} height={20} className="object-contain" />
            </div>

            {/* Typography & Badge */}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm text-slate-900 tracking-tight leading-none">
                  EduConnect
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 leading-none">
                  B2B
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium leading-none mt-1 truncate">
                School Treasury
              </span>
            </div>
          </div>
        ) : (
          <div className="mx-auto">
            <div className="w-8 h-8 rounded-xl bg-indigo-50/80 border border-indigo-100 flex items-center justify-center shrink-0 shadow-xs">
              <EduConnectLogo variant="icon" width={20} height={20} className="object-contain" />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
          className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 transition-colors shrink-0"
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto space-y-1 p-3 scrollbar-thin">
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
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${
                  active
                    ? "bg-indigo-50/90 text-indigo-700 font-bold border border-indigo-200/60 shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                {item.num && !collapsed && (
                  <span className={`text-[10px] font-mono w-4 shrink-0 tabular-nums ${active ? "text-indigo-500 font-bold" : "text-slate-400"}`}>
                    {item.num}
                  </span>
                )}
                <Icon size={16} className={`shrink-0 ${active ? "text-indigo-700" : "text-slate-500"}`} />
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
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${
                  active
                    ? "bg-indigo-50/70 text-indigo-700 font-bold border border-indigo-200/40"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                {item.num && !collapsed && (
                  <span className={`text-[10px] font-mono w-4 shrink-0 tabular-nums ${active ? "text-indigo-500 font-bold" : "text-slate-400"}`}>
                    {item.num}
                  </span>
                )}
                <Icon size={16} className={`shrink-0 ${active ? "text-indigo-700" : "text-slate-500"}`} />
                {!collapsed && (
                  <>
                    <span className="truncate flex-1 text-left">{item.label}</span>
                    {isOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                  </>
                )}
              </button>

              {/* Submenu */}
              {isOpen && !collapsed && (
                <div className="ml-6 space-y-1 pl-2.5 border-l border-slate-200">
                  {item.children.map((child) => {
                    const childActive = isLeafActive(child);
                    const ChildIcon = child.icon;
                    return (
                      <Link
                        key={child.id}
                        href={child.href}
                        id={child.id}
                        aria-current={childActive ? "page" : undefined}
                        className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          childActive
                            ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/60 shadow-xs"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                        }`}
                      >
                        <ChildIcon size={15} className={`shrink-0 ${childActive ? "text-indigo-600" : "text-slate-400"}`} />
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
        <div className="pt-2 pb-1 border-t border-slate-100 my-2" />

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
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                active
                  ? "bg-indigo-50/90 text-indigo-700 font-bold border border-indigo-200/60 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
              }`}
            >
              <Icon size={16} className={`shrink-0 ${active ? "text-indigo-700" : "text-slate-500"}`} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer: SNAP BI status & Logout */}
      <div className="border-t border-slate-100 p-3 space-y-2.5 bg-white">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
            <div className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </div>
            <div className="truncate flex-1">
              <p className="text-[10px] text-slate-400 leading-tight">Host-to-Host Gateway</p>
              <span className="text-[11px] text-slate-700 font-bold">SNAP BI Active (H2H)</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center p-1.5" title="SNAP BI Active (H2H)">
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </div>
        )}

        <button
          type="button"
          id="school-logout-sidebar-btn"
          onClick={() => handleLogout("/login")}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors border border-rose-200/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-500"
        >
          <LogOut size={16} className="shrink-0 text-rose-500" />
          {!collapsed && <span className="truncate">Keluar / Switch User</span>}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
