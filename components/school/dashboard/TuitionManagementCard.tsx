"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, AlertCircle, Clock, PieChart, ShieldCheck } from "lucide-react";
import { DashboardCard } from "./DashboardCard";
import { formatCompactIDR } from "@/lib/format";
import type { AgingBucket } from "@/lib/school/dashboard-types";

interface TuitionManagementCardProps {
  totalBilling: number;
  collectedAmount: number;
  outstandingAmount: number;
  overdueAmount: number;
  collectionRatePct: number;
  buckets: AgingBucket[];
  className?: string;
}

export function TuitionManagementCard({
  totalBilling,
  collectedAmount,
  outstandingAmount,
  overdueAmount,
  collectionRatePct,
  buckets,
  className = "",
}: TuitionManagementCardProps) {
  const [activeTab, setActiveTab] = useState<"collection" | "aging">("collection");
  const boundedRate = Math.min(100, Math.max(0, collectionRatePct));

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
      default:
        return "bg-slate-400";
    }
  };

  return (
    <DashboardCard
      title="SPP Collection & Aging"
      subtitle="Realisasi penerimaan & klasifikasi umur piutang siswa"
      className={className}
      headerSlot={
        <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("collection")}
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
              activeTab === "collection"
                ? "bg-white text-indigo-700 font-bold shadow-xs border border-slate-200/60"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <PieChart size={12} />
            <span>Collection Rate</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("aging")}
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
              activeTab === "aging"
                ? "bg-white text-indigo-700 font-bold shadow-xs border border-slate-200/60"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Clock size={12} />
            <span>Umur Piutang</span>
          </button>
        </div>
      }
      footerSlot={
        <div className="flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <ShieldCheck size={13} className="text-emerald-600" />
            <span>Rekonsiliasi Otomatis VA BNI</span>
          </span>
          <Link
            href="/school/spp"
            className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800 hover:underline text-[11px]"
          >
            <span>Kelola Tagihan & SPP Siswa</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>
      }
    >
      <div className="flex-1 w-full min-h-0 flex flex-col justify-between py-1">
        {activeTab === "collection" ? (
          <div className="space-y-3.5 flex flex-col justify-between h-full">
            {/* Top Stat Row */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Total Tagihan</span>
                <p className="text-sm font-extrabold text-slate-900 tabular-nums mt-0.5">
                  {formatCompactIDR(totalBilling)}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-emerald-600 tracking-wider">Terkumpul</span>
                <p className="text-sm font-extrabold text-emerald-600 tabular-nums mt-0.5">
                  {formatCompactIDR(collectedAmount)}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-rose-600 tracking-wider">Tunggakan</span>
                <p className="text-sm font-extrabold text-rose-600 tabular-nums mt-0.5">
                  {formatCompactIDR(outstandingAmount)}
                </p>
              </div>
            </div>

            {/* Main Progress Indicator */}
            <div className="p-3 bg-indigo-50/40 border border-indigo-100/60 rounded-xl space-y-2">
              <div className="flex items-baseline justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-extrabold text-indigo-950 tabular-nums">
                    {boundedRate.toFixed(1).replace(".", ",")}%
                  </span>
                  <span className="text-xs font-bold text-indigo-700">Realisasi Penerimaan</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">
                  Target: 100%
                </span>
              </div>

              <div className="h-3 w-full rounded-full bg-slate-200/80 p-0.5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-emerald-500 transition-all duration-500"
                  style={{ width: `${boundedRate}%` }}
                />
              </div>

              <div className="flex justify-between text-[11px] pt-0.5">
                <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                  <CheckCircle2 size={12} />
                  <span>{formatCompactIDR(collectedAmount)} Lunas</span>
                </span>
                <span className="flex items-center gap-1 text-rose-600 font-semibold">
                  <AlertCircle size={12} />
                  <span>Overdue: {formatCompactIDR(overdueAmount)}</span>
                </span>
              </div>
            </div>

            {/* Quick Status Note */}
            <div className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-200/60">
              <span className="text-[11px] font-medium">Status Pembayaran Bulan Berjalan</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                <CheckCircle2 size={12} />
                <span>Kinerja Baik</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col justify-between space-y-2">
            <div className="space-y-1.5 overflow-y-auto pr-1">
              {buckets.map((b) => {
                const bgBar = getBucketColor(b.key);
                const pctText = b.percentage.toFixed(1).replace(".", ",");

                return (
                  <div
                    key={b.key}
                    className="p-1.5 px-2 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200/60 space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full ${bgBar} shrink-0`} />
                        <span className="font-semibold text-slate-800 text-xs truncate">{b.label}</span>
                        <span className="text-[10px] text-slate-400">({b.count} inv)</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums shrink-0">
                        <span className="text-slate-900 font-bold">{formatCompactIDR(b.amount)}</span>
                        <span className="text-slate-500 font-medium text-[10px]">({pctText}%)</span>
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

            <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-800">
              <span className="font-medium">Total Piutang Berjalan:</span>
              <span className="font-extrabold text-amber-900 tabular-nums">
                {formatCompactIDR(outstandingAmount)}
              </span>
            </div>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
