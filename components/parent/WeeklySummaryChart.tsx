"use client";

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { TrendingUp, Calendar } from "lucide-react";
import { formatRupiah } from "@/lib/format";

export interface DaySpending {
  day: string; // 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'
  date?: string;
  amount: number;
}

interface WeeklySummaryChartProps {
  data?: DaySpending[];
  studentName?: string;
}

const DEFAULT_WEEKLY_DATA: DaySpending[] = [
  { day: "Sen", amount: 15000 },
  { day: "Sel", amount: 22000 },
  { day: "Rab", amount: 18000 },
  { day: "Kam", amount: 25000 },
  { day: "Jum", amount: 20000 },
  { day: "Sab", amount: 12000 },
  { day: "Min", amount: 0 },
];

export default function WeeklySummaryChart({
  data = DEFAULT_WEEKLY_DATA,
  studentName = "Anak",
}: WeeklySummaryChartProps) {
  const chartData = data.length === 7 ? data : DEFAULT_WEEKLY_DATA;
  const totalWeekly = chartData.reduce((acc, curr) => acc + curr.amount, 0);
  const activeDaysCount = chartData.filter((d) => d.amount > 0).length || 1;
  const dailyAverage = Math.round(totalWeekly / activeDaysCount);
  const maxAmount = Math.max(...chartData.map((d) => d.amount), 1);

  return (
    <div className="rounded-[1.5rem] border border-portal-border bg-portal-surface p-4 sm:p-5 shadow-portal-card space-y-3.5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-portal-muted">
            <Calendar size={13} className="text-portal-primary" />
            <span>Pengeluaran Kantin Mingguan</span>
          </div>
          <p className="text-xs text-portal-muted mt-0.5">
            Total {studentName}: <span className="font-bold text-portal-text">{formatRupiah(totalWeekly)}</span>
          </p>
        </div>

        <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
          <TrendingUp size={12} />
          <span>Rata-rata: {formatRupiah(dailyAverage)}/hari</span>
        </div>
      </div>

      {/* Chart container */}
      <div className="h-40 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#64748B", fontWeight: 600 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 9, fill: "#94A3B8" }}
              tickFormatter={(val) => (val >= 1000 ? `${val / 1000}k` : `${val}`)}
            />
            <Tooltip
              cursor={{ fill: "rgba(115, 87, 199, 0.06)", radius: 8 }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const dataItem = payload[0].payload as DaySpending;
                  return (
                    <div className="rounded-xl border border-portal-border bg-portal-surface p-2 shadow-lg text-xs">
                      <p className="font-bold text-portal-text">{dataItem.day}</p>
                      <p className="font-extrabold text-portal-primary">{formatRupiah(dataItem.amount)}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="amount" radius={[8, 8, 4, 4]} maxBarSize={32}>
              {chartData.map((entry, index) => {
                const isMax = entry.amount === maxAmount && entry.amount > 0;
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={isMax ? "#F97316" : entry.amount > 0 ? "#7357C7" : "#E2E8F0"}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
