"use client";

import {
  ResponsiveContainer,
  ComposedChart,
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
import type { ForecastPoint } from "@/lib/school/dashboard-types";
import { Sparkles } from "lucide-react";

interface PaymentForecastChartProps {
  points: ForecastPoint[];
  expectedNext30Days: number;
  confidenceLevel: "High" | "Medium" | "Low";
}

export function PaymentForecastChart({
  points,
  expectedNext30Days,
  confidenceLevel,
}: PaymentForecastChartProps) {
  const formattedData = points.map((pt) => ({
    ...pt,
    formattedDate: formatDateID(pt.date),
  }));

  const confidenceBadgeColor =
    confidenceLevel === "High"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : confidenceLevel === "Medium"
      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
      : "bg-rose-500/15 text-rose-400 border-rose-500/30";

  return (
    <DashboardCard
      title="Proyeksi Penerimaan SPP (30 Hari)"
      subtitle="Model proyeksi berbasis historis rasio pembayaran siswa"
      headerSlot={
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${confidenceBadgeColor}`}>
            <Sparkles size={12} />
            <span>Confidence: {confidenceLevel}</span>
          </span>
        </div>
      }
    >
      <div className="mb-2 flex items-center justify-between text-xs border-b border-slate-800 pb-2">
        <span className="text-slate-400">Estimasi Terkumpul 30 Hari:</span>
        <span className="font-extrabold text-emerald-400 text-sm tabular-nums">
          {formatCompactIDR(expectedNext30Days)}
        </span>
      </div>

      <div className="h-[220px] w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={formattedData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
            <XAxis dataKey="formattedDate" stroke="#64748B" fontSize={10} tickLine={false} />
            <YAxis
              stroke="#64748B"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatCompactIDR(v)}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                return (
                  <div className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 shadow-lg text-xs space-y-1">
                    <p className="font-semibold text-slate-200">{label}</p>
                    {payload.map((entry: any) => (
                      <div key={entry.dataKey} className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">{entry.name}:</span>
                        <span className="font-semibold text-slate-100 tabular-nums">
                          {formatCompactIDR(entry.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 10 }} />
            <Bar
              name="Tagihan Jatuh Tempo"
              dataKey="upcomingBilling"
              fill={CHART_COLORS.INFLOW_SOFT}
              stroke={CHART_COLORS.INFLOW}
              radius={[4, 4, 0, 0]}
            />
            <Line
              type="monotone"
              name="Proyeksi Kas Masuk"
              dataKey="expectedCollection"
              stroke={CHART_COLORS.NET}
              strokeWidth={2}
              dot={{ r: 3, fill: CHART_COLORS.NET }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </DashboardCard>
  );
}
