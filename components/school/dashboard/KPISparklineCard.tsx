"use client";

import React from "react";
import { Wallet, TrendingUp, TrendingDown, CheckCircle2, AlertCircle, type LucideIcon } from "lucide-react";
import { Sparkline } from "./Sparkline";
import { TrendPill } from "./TrendPill";
import { CHART_COLORS } from "@/lib/school/chart-theme";

interface KPISparklineCardProps {
  id: string;
  label: string;
  sublabel: string;
  formattedValue: string;
  deltaPct: number;
  comparisonLabel: string;
  series: number[];
  accent?: "primary" | "outflow" | "net" | "warning" | "danger";
  invertPolarity?: boolean;
  className?: string;
}

const iconMap: Record<string, LucideIcon> = {
  "cash-position": Wallet,
  "total-inflow": TrendingUp,
  "total-outflow": TrendingDown,
  "tuition-collection": CheckCircle2,
  outstanding: AlertCircle,
};

export function KPISparklineCard({
  id,
  label,
  sublabel,
  formattedValue,
  deltaPct,
  comparisonLabel,
  series,
  accent = "primary",
  invertPolarity = false,
  className = "",
}: KPISparklineCardProps) {
  const Icon = iconMap[id] || Wallet;

  let strokeColor: string = CHART_COLORS.INFLOW;
  let iconBg = "bg-indigo-50 text-indigo-700 border-indigo-100";

  if (accent === "outflow") {
    strokeColor = CHART_COLORS.OUTFLOW;
    iconBg = "bg-orange-50 text-orange-700 border-orange-200";
  } else if (accent === "net") {
    strokeColor = CHART_COLORS.INFLOW;
    iconBg = "bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (accent === "warning") {
    strokeColor = CHART_COLORS.ATTENTION;
    iconBg = "bg-amber-50 text-amber-700 border-amber-200";
  } else if (accent === "danger") {
    strokeColor = CHART_COLORS.CRITICAL;
    iconBg = "bg-rose-50 text-rose-700 border-rose-200";
  }

  return (
    <div
      className={`bg-white border border-slate-200/80 rounded-2xl p-3.5 flex flex-col justify-between shadow-xs transition-all hover:border-slate-300 ${className}`}
    >
      {/* Top row: Label + Icon */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate" title={label}>
          {label}
        </span>
        <div className={`p-1 rounded-md border ${iconBg} shrink-0`}>
          <Icon size={14} />
        </div>
      </div>

      {/* Middle: Big formatted value */}
      <div className="my-auto py-0.5 min-w-0">
        <div className="text-xl font-extrabold text-slate-900 tracking-tight tabular-nums leading-none truncate">
          {formattedValue}
        </div>
      </div>

      {/* Bottom: Sparkline + Trend pill */}
      <div className="flex items-center justify-between gap-2 shrink-0 mt-auto pt-1">
        <div className="flex-1 min-w-0 h-5">
          <Sparkline data={series} stroke={strokeColor} height={20} />
        </div>
        <div className="shrink-0">
          <TrendPill deltaPct={deltaPct} comparisonLabel={comparisonLabel} invertPolarity={invertPolarity} compact />
        </div>
      </div>
    </div>
  );
}
