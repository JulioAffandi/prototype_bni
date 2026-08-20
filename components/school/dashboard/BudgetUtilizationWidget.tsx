import React from "react";
import { DashboardCard } from "./DashboardCard";
import { formatCompactIDR } from "@/lib/format";
import { AlertTriangle } from "lucide-react";
import type { BudgetRow } from "@/lib/school/dashboard-types";

interface BudgetUtilizationWidgetProps {
  rows: BudgetRow[];
  fiscalYear: string;
  className?: string;
}

export function BudgetUtilizationWidget({ rows, fiscalYear, className = "" }: BudgetUtilizationWidgetProps) {
  const totalBudget = rows.reduce((acc, r) => acc + r.budgetAmount, 0);
  const totalActual = rows.reduce((acc, r) => acc + r.actualAmount, 0);
  const overallPct = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;

  return (
    <DashboardCard
      title={`Utilisasi Anggaran (TA ${fiscalYear})`}
      subtitle="Realisasi pengadaan & payroll vs plafon per unit"
      actionUrl="/school/financial"
      actionLabel="Pagu Unit"
      className={className}
      footerSlot={
        <div className="flex items-center justify-between text-xs pt-0.5">
          <span className="text-[11px] text-slate-500 font-medium">Total Realisasi Anggaran:</span>
          <span className="text-[11px] font-bold text-slate-900 tabular-nums">
            {formatCompactIDR(totalActual)} / {formatCompactIDR(totalBudget)}{" "}
            <span className="text-indigo-600 font-extrabold">({Math.round(overallPct)}%)</span>
          </span>
        </div>
      }
    >
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2.5">
        {rows.map((row) => {
          const util = Math.round(row.utilizationPct);
          const isOver = row.isOverBudget || util > 100;
          const barColor = isOver
            ? "bg-rose-500"
            : util > 85
            ? "bg-amber-500"
            : "bg-indigo-600";

          return (
            <div key={row.unit} className="p-2 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors border border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-semibold text-slate-800 text-xs truncate">{row.unitLabel}</span>
                  {isOver && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200 shrink-0">
                      <AlertTriangle size={10} />
                      <span>{util}% OVER</span>
                    </span>
                  )}
                </div>
                <div className="text-[11px] tabular-nums font-mono shrink-0">
                  <span className="text-slate-900 font-bold">{formatCompactIDR(row.actualAmount)}</span>
                  <span className="text-slate-400"> / {formatCompactIDR(row.budgetAmount)}</span>
                </div>
              </div>

              {/* Bar */}
              <div className="h-1.5 w-full bg-slate-200/70 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${Math.min(100, util)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </DashboardCard>
  );
}
