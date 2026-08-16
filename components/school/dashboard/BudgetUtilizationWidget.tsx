import React from "react";
import { DashboardCard } from "./DashboardCard";
import { formatCompactIDR } from "@/lib/format";
import { AlertTriangle } from "lucide-react";
import type { BudgetRow } from "@/lib/school/dashboard-types";

interface BudgetUtilizationWidgetProps {
  rows: BudgetRow[];
  fiscalYear: string;
}

export function BudgetUtilizationWidget({ rows, fiscalYear }: BudgetUtilizationWidgetProps) {
  return (
    <DashboardCard
      title={`Utilisasi Anggaran Unit (TA ${fiscalYear})`}
      subtitle="Realisasi pengadaan & payroll vs plafon anggaran per unit"
    >
      <div className="space-y-3.5">
        {rows.map((row) => {
          const util = Math.round(row.utilizationPct);
          const isOver = row.isOverBudget || util > 100;
          const barColor = isOver
            ? "bg-rose-500"
            : util > 85
            ? "bg-amber-500"
            : "bg-[var(--color-fin-primary)]";

          return (
            <div key={row.unit} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-semibold text-slate-200 truncate">{row.unitLabel}</span>
                  {isOver && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 text-[10px] font-bold border border-rose-500/30">
                      <AlertTriangle size={10} />
                      <span>{util}% OVER</span>
                    </span>
                  )}
                </div>
                <div className="text-[11px] tabular-nums font-mono">
                  <span className="text-slate-100 font-semibold">{formatCompactIDR(row.actualAmount)}</span>
                  <span className="text-slate-500"> / {formatCompactIDR(row.budgetAmount)}</span>
                </div>
              </div>

              {/* Bar */}
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
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
