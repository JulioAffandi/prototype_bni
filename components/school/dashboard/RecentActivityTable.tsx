import React from "react";
import { DashboardCard } from "./DashboardCard";
import { StatusBadge } from "./StatusBadge";
import { formatCompactIDR, formatDateID } from "@/lib/format";
import { ArrowDownLeft, ArrowUpRight, FileText } from "lucide-react";
import type { ActivityRow } from "@/lib/school/dashboard-types";

interface RecentActivityTableProps {
  rows: ActivityRow[];
  className?: string;
}

export function RecentActivityTable({ rows, className = "" }: RecentActivityTableProps) {
  return (
    <DashboardCard
      title="Aktivitas Transaksi Ledger"
      subtitle="10 transaksi jurnal ledger real-time BNI H2H"
      actionUrl="/school/audit"
      actionLabel="Audit Log"
      className={className}
      footerSlot={
        <div className="flex items-center justify-between text-xs pt-0.5">
          <span className="text-[11px] text-slate-500">Menampilkan {rows.length} transaksi terakhir</span>
          <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Sinkronisasi Otomatis Active</span>
          </span>
        </div>
      }
    >
      {rows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs text-slate-500">
          Belum ada aktivitas transaksi pada periode ini.
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-100 scrollbar-thin">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-xs">
              <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-2 px-2.5">Waktu</th>
                <th className="py-2 px-2.5">Kategori</th>
                <th className="py-2 px-2.5">Deskripsi</th>
                <th className="py-2 px-2.5 text-right">Nominal</th>
                <th className="py-2 px-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((row) => {
                const isIncome = row.isIncome;
                const sign = isIncome ? "+" : "-";
                const amountColor = isIncome ? "text-emerald-600 font-bold" : "text-slate-900 font-bold";
                const Icon = isIncome ? ArrowDownLeft : ArrowUpRight;
                const iconColor = isIncome
                  ? "text-emerald-700 bg-emerald-50 border border-emerald-200/80"
                  : "text-orange-700 bg-orange-50 border border-orange-200/80";

                return (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2 px-2.5 text-slate-500 text-[11px] whitespace-nowrap">
                      {formatDateID(row.date)}
                    </td>
                    <td className="py-2 px-2.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-800 text-[11px]">
                        <span className={`p-0.5 rounded ${iconColor}`}>
                          <Icon size={11} />
                        </span>
                        <span>{row.category}</span>
                      </span>
                    </td>
                    <td className="py-2 px-2.5 text-slate-600 max-w-[140px] truncate text-[11px]" title={row.description}>
                      {row.description}
                    </td>
                    <td className={`py-2 px-2.5 text-right font-mono text-[11px] tabular-nums whitespace-nowrap ${amountColor}`}>
                      {sign}{formatCompactIDR(row.amount)}
                    </td>
                    <td className="py-2 px-2 text-center whitespace-nowrap">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardCard>
  );
}
