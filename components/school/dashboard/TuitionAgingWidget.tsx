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
        return "bg-emerald-500";
      case "d1_30":
        return "bg-indigo-600";
      case "d31_60":
        return "bg-amber-500";
      case "d61_90":
        return "bg-orange-500";
      case "d90_plus":
        return "bg-rose-500";
    }
  };

  return (
    <DashboardCard
      title="Umur Piutang SPP (Tuition Aging)"
      subtitle="Klasifikasi keterlambatan piutang berdasarkan jatuh tempo"
    >
      <div className="space-y-2">
        {buckets.map((b) => {
          const bgBar = getBucketColor(b.key);
          const pctText = b.percentage.toFixed(1).replace(".", ",");

          return (
            <div key={b.key} className="p-1.5 rounded-xl hover:bg-slate-50 transition-colors space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${bgBar}`} />
                  <span className="font-semibold text-slate-800">{b.label}</span>
                  <span className="text-[11px] text-slate-400">({b.count} inv)</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
                  <span className="text-slate-900 font-bold">{formatCompactIDR(b.amount)}</span>
                  <span className="text-slate-500 font-medium">({pctText}%)</span>
                </div>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
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
