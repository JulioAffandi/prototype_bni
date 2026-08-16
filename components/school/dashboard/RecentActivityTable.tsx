import React from "react";
import { DashboardCard } from "./DashboardCard";
import { StatusBadge } from "./StatusBadge";
import { formatCompactIDR, formatDateID } from "@/lib/format";
import { ArrowDownLeft, ArrowUpRight, FileText } from "lucide-react";
import type { ActivityRow } from "@/lib/school/dashboard-types";

interface RecentActivityTableProps {
  rows: ActivityRow[];
}

export function RecentActivityTable({ rows }: RecentActivityTableProps) {
  return (
    <DashboardCard
      title="Aktivitas Transaksi Keuangan Terbaru"
      subtitle="10 transaksi jurnal ledger terdaftar dengan referensi BNI H2H"
      actionUrl="/school/audit"
      actionLabel="Lihat Semua Audit Log"
    >
      {rows.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400">
          Belum ada aktivitas transaksi pada periode ini.
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-3">Kategori</th>
                <th className="py-2.5 px-3">Deskripsi Transaksi</th>
                <th className="py-2.5 px-3">Referensi BNI / Akun</th>
                <th className="py-2.5 px-3 text-right">Nominal</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rows.map((row) => {
                const isIncome = row.isIncome;
                const sign = isIncome ? "+" : "-";
                const amountColor = isIncome ? "text-emerald-400" : "text-slate-200";
                const Icon = isIncome ? ArrowDownLeft : ArrowUpRight;
                const iconColor = isIncome ? "text-emerald-400 bg-emerald-500/10" : "text-orange-400 bg-orange-500/10";

                return (
                  <tr key={row.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-3 px-3 text-slate-300 font-medium whitespace-nowrap">
                      {formatDateID(row.date)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-200">
                        <span className={`p-1 rounded ${iconColor}`}>
                          <Icon size={12} />
                        </span>
                        {row.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300 max-w-xs truncate">
                      {row.description}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-slate-300">
                        <FileText size={12} className="text-slate-500 shrink-0" />
                        <span>{row.reference || "BNI-H2H-STD"}</span>
                      </span>
                    </td>
                    <td className={`py-3 px-3 text-right font-semibold font-mono text-xs tabular-nums whitespace-nowrap ${amountColor}`}>
                      {sign}{formatCompactIDR(row.amount)}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
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
