import React from "react";
import { DashboardCard } from "./DashboardCard";
import { formatCompactIDR, formatPct } from "@/lib/format";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface TuitionCollectionWidgetProps {
  totalBilling: number;
  collectedAmount: number;
  outstandingAmount: number;
  overdueAmount: number;
  collectionRatePct: number;
}

export function TuitionCollectionWidget({
  totalBilling,
  collectedAmount,
  outstandingAmount,
  overdueAmount,
  collectionRatePct,
}: TuitionCollectionWidgetProps) {
  const boundedRate = Math.min(100, Math.max(0, collectionRatePct));

  return (
    <DashboardCard
      title="Rekonsiliasi & Collection Rate SPP"
      subtitle="Realisasi penerimaan SPP siswa vs target penagihan berjalan"
      actionUrl="/school/spp"
      actionLabel="Detail SPP"
    >
      <div className="space-y-4">
        {/* Main Rate Display */}
        <div className="flex items-end justify-between">
          <div>
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums">
              {boundedRate.toFixed(1).replace(".", ",")}%
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Terkumpul: <span className="font-bold text-emerald-600">{formatCompactIDR(collectedAmount)}</span> dari {formatCompactIDR(totalBilling)}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500 font-medium">Tunggakan SPP</span>
            <p className="text-sm font-bold text-rose-600 tabular-nums">
              {formatCompactIDR(outstandingAmount)}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="h-3.5 w-full rounded-full bg-slate-100 p-0.5 overflow-hidden border border-slate-200/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-emerald-500 transition-all duration-500"
              style={{ width: `${boundedRate}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <CheckCircle2 size={12} />
              <span>{boundedRate.toFixed(1)}% Lunas</span>
            </span>
            <span className="flex items-center gap-1 text-rose-600 font-semibold">
              <AlertCircle size={12} />
              <span>Overdue: {formatCompactIDR(overdueAmount)}</span>
            </span>
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}
