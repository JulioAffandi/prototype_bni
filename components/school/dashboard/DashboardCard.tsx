import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

interface DashboardCardProps {
  title?: string;
  subtitle?: string;
  actionUrl?: string;
  actionLabel?: string;
  headerSlot?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function DashboardCard({
  title,
  subtitle,
  actionUrl,
  actionLabel = "Lihat Detail",
  headerSlot,
  children,
  className = "",
}: DashboardCardProps) {
  return (
    <div className={`bg-[var(--color-fin-card)] border border-[var(--color-fin-card-border)] rounded-[var(--radius-fin)] p-5 shadow-sm transition-all hover:border-slate-700/80 ${className}`}>
      {(title || headerSlot) && (
        <div className="flex items-center justify-between mb-4 pb-1">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-100 tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {headerSlot ? (
            headerSlot
          ) : actionUrl ? (
            <Link
              href={actionUrl}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-fin-primary)] hover:underline"
            >
              <span>{actionLabel}</span>
              <ArrowUpRight size={14} />
            </Link>
          ) : null}
        </div>
      )}
      {children}
    </div>
  );
}
