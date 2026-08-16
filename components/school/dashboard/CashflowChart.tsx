"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { DashboardCard } from "./DashboardCard";
import { CHART_COLORS } from "@/lib/school/chart-theme";
import { formatCompactIDR, formatDateID } from "@/lib/format";
import type { CashflowPoint } from "@/lib/school/dashboard-types";

interface CashflowChartProps {
  series: CashflowPoint[];
}

export function CashflowChart({ series }: CashflowChartProps) {
  const [activeSeries, setActiveSeries] = useState<"all" | "inflow" | "outflow">("all");

  const formattedData = series.map((pt) => ({
    ...pt,
    formattedDate: formatDateID(pt.date),
  }));

  return (
    <DashboardCard
      title="Cashflow Trend & Bank Giro Balance"
      subtitle="Arus kas masuk vs keluar berbasis jurnal ledger real-time BNI H2H"
      headerSlot={
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-md p-0.5 text-xs">
          {[
            { id: "all", label: "Semua" },
            { id: "inflow", label: "Penerimaan" },
            { id: "outflow", label: "Pengeluaran" },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setActiveSeries(mode.id as any)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                activeSeries === mode.id
                  ? "bg-slate-700 text-white font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="h-[280px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={formattedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.INFLOW} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS.INFLOW} stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.OUTFLOW} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS.OUTFLOW} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
            <XAxis
              dataKey="formattedDate"
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#334155" }}
            />
            <YAxis
              stroke="#64748B"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => formatCompactIDR(val)}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                return (
                  <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-lg text-xs space-y-1.5 min-w-40">
                    <p className="font-semibold text-slate-200">{label}</p>
                    {payload.map((entry: any) => (
                      <div key={entry.dataKey} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-1.5 text-slate-400">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                          {entry.name}:
                        </span>
                        <span className="font-semibold text-slate-100 tabular-nums">
                          {formatCompactIDR(entry.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ fontSize: 11, paddingTop: 0, paddingBottom: 10 }}
            />

            {(activeSeries === "all" || activeSeries === "inflow") && (
              <Area
                type="monotone"
                name="Kas Masuk (Inflow)"
                dataKey="inflow"
                stroke={CHART_COLORS.INFLOW}
                strokeWidth={2}
                fill="url(#inflowGrad)"
              />
            )}

            {(activeSeries === "all" || activeSeries === "outflow") && (
              <Area
                type="monotone"
                name="Kas Keluar (Outflow)"
                dataKey="outflow"
                stroke={CHART_COLORS.OUTFLOW}
                strokeWidth={2}
                fill="url(#outflowGrad)"
              />
            )}

            {activeSeries === "all" && (
              <Line
                type="monotone"
                name="Saldo Giro (Closing)"
                dataKey="closingBalance"
                stroke={CHART_COLORS.NET}
                strokeWidth={2}
                dot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </DashboardCard>
  );
}
