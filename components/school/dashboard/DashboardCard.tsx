import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

interface DashboardCardProps {
  title?: string;
  subtitle?: string;
  actionUrl?: string;
  actionLabel?: string;
  headerSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function DashboardCard({
  title,
  subtitle,
  actionUrl,
  actionLabel = "Lihat Detail",
  headerSlot,
  footerSlot,
  children,
  className = "",
}: DashboardCardProps) {
  return (
    <div
      className={`bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col h-full min-h-0 justify-between overflow-hidden transition-all hover:border-slate-300 ${className}`}
    >
      {(title || subtitle || headerSlot || actionUrl) && (
        <div className="flex items-center justify-between shrink-0 mb-3 gap-2">
          <div className="min-w-0 flex-1">
            {title && <h3 className="text-sm font-bold text-slate-900 tracking-tight truncate">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
          {headerSlot ? (
            <div className="shrink-0">{headerSlot}</div>
          ) : actionUrl ? (
            <Link
              href={actionUrl}
              className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              <span>{actionLabel}</span>
              <ArrowUpRight size={14} />
            </Link>
          ) : null}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 w-full min-h-0 flex flex-col overflow-hidden">
        {children}
      </div>

      {/* Footer / Action Bar */}
      {footerSlot && (
        <div className="shrink-0 pt-3 border-t border-slate-100 mt-auto">
          {footerSlot}
        </div>
      )}
    </div>
  );
}
