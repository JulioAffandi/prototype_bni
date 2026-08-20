import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface TrendPillProps {
  deltaPct: number;
  comparisonLabel: string;
  invertPolarity?: boolean;
  compact?: boolean;
}

export function TrendPill({
  deltaPct,
  comparisonLabel,
  invertPolarity = false,
  compact = false,
}: TrendPillProps) {
  if (isNaN(deltaPct) || deltaPct === 0) {
    return (
      <div className="flex items-center gap-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 font-semibold border border-slate-200 text-[10px]">
          <Minus size={10} />
          <span>0%</span>
        </span>
        {!compact && <span className="text-[10px] text-slate-400 truncate">{comparisonLabel}</span>}
      </div>
    );
  }

  const isPositive = deltaPct > 0;
  // If positive & invertPolarity (e.g. outflow up) => bad
  // If negative & invertPolarity (e.g. outflow down) => good
  const isGood = invertPolarity ? !isPositive : isPositive;

  const bgClass = isGood
    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
    : "bg-rose-50 text-rose-700 border border-rose-200";

  const Icon = isPositive ? TrendingUp : TrendingDown;
  const absFormatted = Math.abs(deltaPct).toFixed(1).replace(".", ",");

  return (
    <div className="flex items-center gap-1 text-xs">
      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${bgClass}`}>
        <Icon size={10} />
        <span>{isPositive ? "+" : "-"}{absFormatted}%</span>
      </span>
      {!compact && <span className="text-[10px] text-slate-400 truncate">{comparisonLabel}</span>}
    </div>
  );
}
