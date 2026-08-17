"use client";

import { useState } from "react";
import {
  Utensils,
  CreditCard,
  Calendar,
  Clock,
  ChevronDown,
  User,
  ShoppingBag,
  ArrowDownRight,
  TrendingUp,
  Receipt,
} from "lucide-react";
import { formatRupiah } from "@/lib/format";

export interface CardTapItem {
  id: string;
  studentId: string;
  studentName: string;
  merchantName: string;
  amount: number;
  status: string;
  createdAt: string;
  items?: Array<{ name: string; qty: number; price: number }> | null;
  terminalId?: string;
}

interface CardUsageHistoryClientProps {
  initialTaps: CardTapItem[];
  students: Array<{ id: string; fullName: string; studentNumber: string }>;
}

export default function CardUsageHistoryClient({
  initialTaps,
  students,
}: CardUsageHistoryClientProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || "ALL");

  const filteredTaps = initialTaps.filter((t) => {
    if (selectedStudentId !== "ALL" && t.studentId !== selectedStudentId) {
      return false;
    }
    return true;
  });

  const totalSpent = filteredTaps.reduce((acc, curr) => acc + curr.amount, 0);
  const totalTapsCount = filteredTaps.length;
  const avgPerTap = totalTapsCount > 0 ? Math.round(totalSpent / totalTapsCount) : 0;

  return (
    <div className="space-y-4">
      {/* 1. Child Filter Dropdown */}
      {students.length > 1 && (
        <div className="space-y-1.5">
          <label
            htmlFor="usage-student-filter"
            className="text-[11px] font-bold uppercase tracking-wider text-portal-muted flex items-center gap-1.5"
          >
            <User className="text-portal-primary" size={13} />
            Filter Siswa
          </label>
          <div className="relative">
            <select
              id="usage-student-filter"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full appearance-none rounded-2xl border border-portal-border bg-portal-surface px-4 py-2.5 text-xs font-bold text-portal-text focus:border-portal-primary focus:outline-none focus:ring-2 focus:ring-portal-primary/20 pr-10 shadow-portal-card cursor-pointer"
            >
              <option value="ALL" className="bg-white text-slate-900">
                Semua Anak ({initialTaps.length} Transaksi)
              </option>
              {students.map((st) => (
                <option key={st.id} value={st.id} className="bg-white text-slate-900">
                  {st.fullName} (NISN: {st.studentNumber})
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-portal-muted">
              <ChevronDown size={16} />
            </div>
          </div>
        </div>
      )}

      {/* 2. Usage Summary Banner Card */}
      <div className="rounded-[1.75rem] border border-portal-border bg-portal-surface p-5 shadow-portal-card space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-purple-50 text-portal-primary flex items-center justify-center">
              <CreditCard size={18} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-portal-muted font-bold">
                Total Pemakaian Kartu Bulan Ini
              </p>
              <h2 className="text-xl font-black text-portal-text">{formatRupiah(totalSpent)}</h2>
            </div>
          </div>

          <span className="text-[10px] font-bold text-portal-primary bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-100">
            {totalTapsCount}x Tap NFC
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-portal-border/60">
          <div className="bg-portal-surface-alt p-3 rounded-2xl border border-portal-border/60">
            <span className="text-[10px] uppercase tracking-wider text-portal-muted font-bold block">
              Frekuensi Tap
            </span>
            <p className="text-xs font-black text-portal-text mt-0.5">{totalTapsCount} Transaksi</p>
          </div>
          <div className="bg-portal-surface-alt p-3 rounded-2xl border border-portal-border/60">
            <span className="text-[10px] uppercase tracking-wider text-portal-muted font-bold block">
              Rata-rata per Transaksi
            </span>
            <p className="text-xs font-black text-portal-primary mt-0.5">{formatRupiah(avgPerTap)}</p>
          </div>
        </div>
      </div>

      {/* 3. Detailed Hourly Tap Breakdown List */}
      <div className="rounded-[1.75rem] border border-portal-border bg-portal-surface p-4 sm:p-5 space-y-3.5 shadow-portal-card">
        <div className="flex items-center justify-between border-b border-portal-border pb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-portal-muted">
            <Receipt size={13} className="text-portal-primary" />
            <span>Rincian Struk &amp; Jam Tap Kantin</span>
          </div>
          <span className="text-[11px] font-semibold text-portal-muted">
            {filteredTaps.length} Catatan
          </span>
        </div>

        {filteredTaps.length === 0 ? (
          <div className="py-8 text-center text-portal-muted text-xs space-y-1">
            <ShoppingBag className="mx-auto text-portal-muted/60 mb-2" size={28} />
            <p className="font-bold text-portal-text">Belum Ada Transaksi Kartu</p>
            <p className="text-[11px]">Riwayat tap kartu NFC di kasir kantin akan muncul di sini.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTaps.map((tap) => {
              const d = new Date(tap.createdAt);
              const dateStr = d.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              const timeStr = d.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={tap.id}
                  className="p-3.5 rounded-2xl bg-portal-surface-alt/70 hover:bg-portal-surface-alt border border-portal-border/70 space-y-2 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-purple-50 text-portal-primary flex items-center justify-center shrink-0">
                        <Utensils size={15} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-portal-text truncate">{tap.merchantName}</h4>
                        <p className="text-[10px] text-portal-muted flex items-center gap-1 mt-0.5">
                          <Clock size={11} />
                          <span>
                            {dateStr} • {timeStr} WIB
                          </span>
                          <span>•</span>
                          <span className="font-semibold text-portal-text/80">{tap.studentName}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-red-500 block">
                        -{formatRupiah(tap.amount)}
                      </span>
                      <span className="text-[9px] font-bold text-emerald-600 uppercase">
                        {tap.status || "SETTLED"}
                      </span>
                    </div>
                  </div>

                  {/* Itemized Breakdown if available */}
                  {tap.items && tap.items.length > 0 && (
                    <div className="pt-1.5 border-t border-portal-border/40 text-[11px] text-portal-muted space-y-0.5">
                      {tap.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>
                            {item.qty}x {item.name}
                          </span>
                          <span className="font-mono text-portal-text">{formatRupiah(item.price)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
