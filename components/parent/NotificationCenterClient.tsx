"use client";

import { useState } from "react";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  Utensils,
  PlusCircle,
  Receipt,
  ShieldAlert,
  Calendar,
  Check,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

export interface NotificationRecord {
  id: string;
  type: "TOPUP_SUCCESS" | "CANTEEN_TAP" | "SPP_REMINDER" | "LIMIT_ALERT" | "GENERAL";
  title: string;
  message: string;
  actionUrl: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationCenterClientProps {
  initialNotifications: NotificationRecord[];
}

export default function NotificationCenterClient({
  initialNotifications,
}: NotificationCenterClientProps) {
  const [notifications, setNotifications] = useState<NotificationRecord[]>(initialNotifications);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const markSingleAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const filtered = notifications.filter((n) => {
    if (activeFilter === "ALL") return true;
    if (activeFilter === "TOPUP") return n.type === "TOPUP_SUCCESS";
    if (activeFilter === "CANTEEN") return n.type === "CANTEEN_TAP";
    if (activeFilter === "SPP") return n.type === "SPP_REMINDER";
    if (activeFilter === "LIMIT") return n.type === "LIMIT_ALERT";
    return true;
  });

  // Group into Hari Ini vs Sebelumnya
  const now = new Date();
  const todayStr = now.toDateString();

  const todayItems: NotificationRecord[] = [];
  const earlierItems: NotificationRecord[] = [];

  filtered.forEach((n) => {
    const itemDate = new Date(n.createdAt);
    if (itemDate.toDateString() === todayStr) {
      todayItems.push(n);
    } else {
      earlierItems.push(n);
    }
  });

  const getNotificationIcon = (type: NotificationRecord["type"]) => {
    switch (type) {
      case "TOPUP_SUCCESS":
        return <PlusCircle size={16} className="text-emerald-600" />;
      case "CANTEEN_TAP":
        return <Utensils size={16} className="text-purple-600" />;
      case "SPP_REMINDER":
        return <Receipt size={16} className="text-[#F97316]" />;
      case "LIMIT_ALERT":
        return <AlertTriangle size={16} className="text-amber-600" />;
      default:
        return <Info size={16} className="text-portal-primary" />;
    }
  };

  const getNotificationBg = (type: NotificationRecord["type"]) => {
    switch (type) {
      case "TOPUP_SUCCESS":
        return "bg-emerald-50 border-emerald-100";
      case "CANTEEN_TAP":
        return "bg-purple-50 border-purple-100";
      case "SPP_REMINDER":
        return "bg-orange-50 border-orange-100";
      case "LIMIT_ALERT":
        return "bg-amber-50 border-amber-100";
      default:
        return "bg-purple-50 border-purple-100";
    }
  };

  const renderItem = (item: NotificationRecord) => {
    const d = new Date(item.createdAt);
    const timeStr = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    const dateStr = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });

    return (
      <Link
        key={item.id}
        href={item.actionUrl || "/dashboard"}
        onClick={() => markSingleAsRead(item.id)}
        className={`flex items-start justify-between gap-3 p-3.5 rounded-2xl border transition-all ${
          !item.isRead
            ? "bg-purple-50/40 border-purple-200/80 shadow-sm"
            : "bg-portal-surface-alt/60 hover:bg-portal-surface-alt border-portal-border/60"
        }`}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-2xl border flex items-center justify-center shrink-0 mt-0.5 ${getNotificationBg(
              item.type
            )}`}
          >
            {getNotificationIcon(item.type)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-portal-text truncate">{item.title}</h4>
              {!item.isRead && (
                <span className="w-2 h-2 rounded-full bg-portal-accent shrink-0 animate-pulse" />
              )}
            </div>
            <p className="text-[11px] text-portal-muted leading-relaxed mt-0.5">{item.message}</p>
            <span className="text-[10px] text-portal-muted font-medium mt-1 block">
              {dateStr}, {timeStr} WIB
            </span>
          </div>
        </div>

        <ChevronRight size={15} className="text-portal-muted shrink-0 mt-2" />
      </Link>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header Actions & Filter Pills */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: "ALL", label: "Semua" },
            { id: "TOPUP", label: "Top Up" },
            { id: "CANTEEN", label: "Kantin" },
            { id: "SPP", label: "SPP" },
            { id: "LIMIT", label: "Pagu" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                activeFilter === tab.id
                  ? "bg-portal-primary text-white border-portal-primary shadow-sm"
                  : "bg-portal-surface border-portal-border text-portal-muted hover:text-portal-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllAsRead}
            className="text-[11px] font-bold text-portal-primary hover:underline whitespace-nowrap ml-2 shrink-0"
          >
            Tandai Dibaca
          </button>
        )}
      </div>

      {/* Notifications Groups */}
      {filtered.length === 0 ? (
        <div className="rounded-[1.75rem] border border-portal-border bg-portal-surface p-8 text-center shadow-portal-card space-y-2">
          <Bell className="w-10 h-10 text-portal-muted/50 mx-auto mb-2" />
          <p className="font-bold text-sm text-portal-text">Tidak Ada Notifikasi</p>
          <p className="text-xs text-portal-muted">
            Pemberitahuan transaksi jajan, top up, dan tagihan SPP akan tampil di sini.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Hari Ini */}
          {todayItems.length > 0 && (
            <div className="rounded-[1.75rem] border border-portal-border bg-portal-surface p-4 sm:p-5 shadow-portal-card space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-portal-muted border-b border-portal-border pb-2">
                Hari Ini
              </h3>
              <div className="space-y-2.5">{todayItems.map(renderItem)}</div>
            </div>
          )}

          {/* Sebelumnya */}
          {earlierItems.length > 0 && (
            <div className="rounded-[1.75rem] border border-portal-border bg-portal-surface p-4 sm:p-5 shadow-portal-card space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-portal-muted border-b border-portal-border pb-2">
                Sebelumnya
              </h3>
              <div className="space-y-2.5">{earlierItems.map(renderItem)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
