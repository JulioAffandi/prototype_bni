import React from "react";
import { DashboardCard } from "./DashboardCard";
import { formatCompactIDR } from "@/lib/format";
import type { AgingBucket } from "@/lib/school/dashboard-types";

interface TuitionAgingWidgetProps {
  buckets: AgingBucket[];
}

export function TuitionAgingWidget({ buckets }: TuitionAgingWidgetProps) {
  const getBucketColor = (key: AgingBucket["key"]) => {
    switch (key) {
      case "current":
        return "bg-emerald-500 text-emerald-400";
      case "d1_30":
        return "bg-blue-500 text-blue-400";
      case "d31_60":
        return "bg-amber-500 text-amber-400";
      case "d61_90":
        return "bg-orange-500 text-orange-400";
      case "d90_plus":
        return "bg-rose-500 text-rose-400";
    }
  };

  return (
    <DashboardCard
      title="Umur Piutang SPP (Tuition Aging)"
      subtitle="Klasifikasi keterlambatan piutang berdasarkan jatuh tempo"
    >
      <div className="space-y-3">
        {buckets.map((b) => {
          const color = getBucketColor(b.key);
          const bgBar = color.split(" ")[0];
          const pctText = b.percentage.toFixed(1).replace(".", ",");

          return (
            <div key={b.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${bgBar}`} />
                  <span className="font-medium text-slate-200">{b.label}</span>
                  <span className="text-[11px] text-slate-500">({b.count} inv)</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
                  <span className="text-slate-100 font-semibold">{formatCompactIDR(b.amount)}</span>
                  <span className="text-slate-400 font-medium">({pctText}%)</span>
                </div>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${bgBar}`}
                  style={{ width: `${Math.min(100, Math.max(0, b.percentage))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </DashboardCard>
  );
}
