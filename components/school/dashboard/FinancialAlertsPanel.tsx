"use client";

import React from "react";
import Link from "next/link";
import { DashboardCard } from "./DashboardCard";
import { StatusBadge } from "./StatusBadge";
import { AlertOctagon, AlertTriangle, Info, ArrowUpRight, Sparkles, Bot } from "lucide-react";
import type { FinancialAlert } from "@/lib/school/dashboard-types";

interface FinancialAlertsPanelProps {
  alerts: FinancialAlert[];
  className?: string;
}

export function FinancialAlertsPanel({ alerts, className = "" }: FinancialAlertsPanelProps) {
  const getIcon = (severity: FinancialAlert["severity"]) => {
    switch (severity) {
      case "critical":
        return <AlertOctagon size={15} className="text-rose-600 shrink-0 mt-0.5" />;
      case "attention":
        return <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />;
      case "info":
        return <Info size={15} className="text-blue-600 shrink-0 mt-0.5" />;
    }
  };

  const getCardBg = (severity: FinancialAlert["severity"]) => {
    switch (severity) {
      case "critical":
        return "bg-rose-50/70 border-rose-200/80 hover:border-rose-300";
      case "attention":
        return "bg-amber-50/70 border-amber-200/80 hover:border-amber-300";
      case "info":
        return "bg-blue-50/70 border-blue-200/80 hover:border-blue-300";
    }
  };

  const handleOpenAi = () => {
    const btn = document.getElementById("ai-chat-open-btn");
    if (btn) {
      btn.click();
    } else {
      window.location.href = "/school/ai";
    }
  };

  return (
    <DashboardCard
      title="Alerts & Mitigasi Risiko"
      subtitle="Deteksi anomali & mitigasi treasury"
      className={className}
      headerSlot={
        alerts.length > 0 ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-extrabold border border-rose-200">
            <span>{alerts.length} Perlu Aksi</span>
          </span>
        ) : null
      }
      footerSlot={
        <div className="pt-0.5">
          <button
            type="button"
            onClick={handleOpenAi}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-bold shadow-xs transition-all active:scale-98 cursor-pointer"
          >
            <Sparkles size={12} className="text-amber-300" />
            <span>Konsultasi AI Treasury</span>
          </button>
        </div>
      }
    >
      {alerts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-xs text-slate-500 space-y-1">
          <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mb-1 font-bold text-xs">
            ✓
          </div>
          <p className="font-bold text-slate-800 text-xs">Indikator Treasury Normal</p>
          <p className="text-slate-400 text-[10px]">Tidak ada variansi kritis terdeteksi.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-2 rounded-xl border flex gap-2 items-start transition-all ${getCardBg(alert.severity)}`}
            >
              {getIcon(alert.severity)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <h4 className="text-[11px] font-bold text-slate-900 truncate">{alert.title}</h4>
                  <StatusBadge status={alert.severity} />
                </div>
                <p className="text-[10px] text-slate-600 leading-snug line-clamp-2">
                  {alert.description}
                </p>

                {alert.actionUrl && (
                  <Link
                    href={alert.actionUrl}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 hover:underline mt-0.5"
                  >
                    <span>{alert.actionLabel || "Tindak Lanjuti"}</span>
                    <ArrowUpRight size={10} />
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
