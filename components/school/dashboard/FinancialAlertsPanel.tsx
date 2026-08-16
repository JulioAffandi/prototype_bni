import React from "react";
import Link from "next/link";
import { DashboardCard } from "./DashboardCard";
import { StatusBadge } from "./StatusBadge";
import { AlertOctagon, AlertTriangle, Info, ArrowUpRight } from "lucide-react";
import type { FinancialAlert } from "@/lib/school/dashboard-types";

interface FinancialAlertsPanelProps {
  alerts: FinancialAlert[];
}

export function FinancialAlertsPanel({ alerts }: FinancialAlertsPanelProps) {
  const getIcon = (severity: FinancialAlert["severity"]) => {
    switch (severity) {
      case "critical":
        return <AlertOctagon size={16} className="text-rose-400 shrink-0 mt-0.5" />;
      case "attention":
        return <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />;
      case "info":
        return <Info size={16} className="text-sky-400 shrink-0 mt-0.5" />;
    }
  };

  return (
    <DashboardCard
      title="Alerts & Mitigasi Risiko"
      subtitle="Deteksi otomatis variansi anggaran & keterlambatan SPP"
      actionUrl="/school/audit"
      actionLabel="Audit Log"
    >
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-slate-400 space-y-1">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-1">
            ✓
          </div>
          <p className="font-semibold text-slate-200">Seluruh indikator treasury normal</p>
          <p className="text-slate-500">Tidak ada anomali atau variansi kritis terdeteksi.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.slice(0, 4).map((alert) => (
            <div
              key={alert.id}
              className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 flex gap-2.5 items-start transition-all hover:border-slate-700"
            >
              {getIcon(alert.severity)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="text-xs font-semibold text-slate-200 truncate">{alert.title}</h4>
                  <StatusBadge status={alert.severity} />
                </div>
                <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                  {alert.description}
                </p>

                {alert.actionUrl && (
                  <Link
                    href={alert.actionUrl}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-fin-primary)] hover:underline mt-1.5"
                  >
                    <span>{alert.actionLabel || "Tindak Lanjuti"}</span>
                    <ArrowUpRight size={12} />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardCard>
  );
}
