"use client";

import { useState } from "react";
import { Bell, CheckCircle2, AlertTriangle, Info, ChevronRight, X } from "lucide-react";
import Link from "next/link";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  action_url: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationBellDropdownProps {
  initialNotifications: NotificationItem[];
}

export default function NotificationBellDropdown({
  initialNotifications,
}: NotificationBellDropdownProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  return (
    <div className="relative">
      <button
        type="button"
        id="btn-parent-notification-bell"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors relative"
        aria-label="Notifikasi"
      >
        <Bell className="w-5 h-5 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground font-bold text-[10px] flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-portal-surface border border-portal-border rounded-2xl shadow-2xl z-50 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-portal-border pb-2">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-portal-primary" />
              <h4 className="text-xs font-bold text-portal-text">Notifikasi Portal ({unreadCount} baru)</h4>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[10px] text-portal-primary font-semibold hover:underline"
              >
                Tandai semua dibaca
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto space-y-2">
            {notifications.length === 0 ? (
              <p className="text-xs text-portal-muted text-center py-4">Belum ada notifikasi.</p>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.action_url || "/spp"}
                  onClick={() => {
                    setNotifications((prev) =>
                      prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
                    );
                    setIsOpen(false);
                  }}
                  className={`block p-3 rounded-xl border transition-all text-xs ${
                    !n.is_read
                      ? "bg-portal-primary/10 border-portal-primary/30 font-medium"
                      : "bg-portal-surface-alt border-portal-border text-portal-muted hover:text-portal-text"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-bold text-portal-text">
                      {n.type === "PAYMENT_SUCCESS" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : n.type === "BILLING_ALERT" ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      ) : (
                        <Info className="w-3.5 h-3.5 text-portal-primary shrink-0" />
                      )}
                      <span>{n.title}</span>
                    </div>
                    <span className="text-[9px] text-portal-muted whitespace-nowrap">
                      {new Date(n.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-[11px] text-portal-muted mt-1 line-clamp-2">{n.message}</p>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
