import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface TrendPillProps {
  deltaPct: number;
  comparisonLabel: string;
  invertPolarity?: boolean;
}

export function TrendPill({
  deltaPct,
  comparisonLabel,
  invertPolarity = false,
}: TrendPillProps) {
  if (isNaN(deltaPct) || deltaPct === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">
          <Minus size={12} />
          <span>0,0%</span>
        </span>
        <span className="text-[11px] text-slate-400 truncate">{comparisonLabel}</span>
      </div>
    );
  }

  const isPositive = deltaPct > 0;
  // If positive & invertPolarity (e.g. outflow up) => bad
  // If negative & invertPolarity (e.g. outflow down) => good
  const isGood = invertPolarity ? !isPositive : isPositive;

  const bgClass = isGood
    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
    : "bg-rose-500/15 text-rose-400 border border-rose-500/20";

  const Icon = isPositive ? TrendingUp : TrendingDown;
  const absFormatted = Math.abs(deltaPct).toFixed(1).replace(".", ",");

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold tabular-nums ${bgClass}`}>
        <Icon size={12} />
        <span>{isPositive ? "+" : "-"}{absFormatted}%</span>
      </span>
      <span className="text-[11px] text-slate-400 truncate">{comparisonLabel}</span>
    </div>
  );
}
