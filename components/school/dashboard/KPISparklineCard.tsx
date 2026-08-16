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
}: KPISparklineCardProps) {
  const Icon = iconMap[id] || Wallet;

  let strokeColor: string = CHART_COLORS.INFLOW;
  let iconBg = "bg-indigo-500/15 text-indigo-400 border-indigo-500/30";

  if (accent === "outflow") {
    strokeColor = CHART_COLORS.OUTFLOW;
    iconBg = "bg-orange-500/15 text-orange-400 border-orange-500/30";
  } else if (accent === "net") {
    strokeColor = CHART_COLORS.NET;
    iconBg = "bg-lime-500/15 text-lime-400 border-lime-500/30";
  } else if (accent === "warning") {
    strokeColor = CHART_COLORS.ATTENTION;
    iconBg = "bg-amber-500/15 text-amber-400 border-amber-500/30";
  } else if (accent === "danger") {
    strokeColor = CHART_COLORS.CRITICAL;
    iconBg = "bg-rose-500/15 text-rose-400 border-rose-500/30";
  }

  return (
    <div className="bg-[var(--color-fin-card)] border border-[var(--color-fin-card-border)] rounded-[var(--radius-fin)] p-4 flex flex-col justify-between shadow-sm transition-all hover:border-slate-700/80">
      {/* Top row: icon + title */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-medium text-slate-400 truncate">{label}</span>
          <div className={`p-1.5 rounded-md border ${iconBg} shrink-0`}>
            <Icon size={16} />
          </div>
        </div>

        {/* Big formatted value */}
        <div className="text-lg xl:text-xl font-extrabold text-white tracking-tight tabular-nums my-0.5">
          {formattedValue}
        </div>
        <p className="text-[11px] text-slate-500 mb-2 truncate">{sublabel}</p>
      </div>

      {/* Sparkline & Trend pill */}
      <div className="space-y-2 mt-1">
        <Sparkline data={series} stroke={strokeColor} height={32} />
        <TrendPill deltaPct={deltaPct} comparisonLabel={comparisonLabel} invertPolarity={invertPolarity} />
      </div>
    </div>
  );
}
