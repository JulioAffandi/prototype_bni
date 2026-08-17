"use client";

import Link from "next/link";
import { Utensils, ArrowUpRight, ShoppingBag, Clock } from "lucide-react";
import { formatRupiah } from "@/lib/format";

export interface RecentTransactionItem {
  id: string;
  student_id?: string;
  student_name?: string;
  amount: number;
  status: string;
  created_at: string;
  merchants?: { name?: string | null } | null;
  description?: string;
  type?: "CANTEEN" | "TOPUP" | "SPP" | "OTHER";
}

interface RecentActivityCardProps {
  transactions: RecentTransactionItem[];
}

export default function RecentActivityCard({ transactions }: RecentActivityCardProps) {
  const displayItems = transactions.slice(0, 3);

  return (
    <div className="rounded-[1.5rem] border border-portal-border bg-portal-surface p-4 sm:p-5 shadow-portal-card space-y-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-portal-muted">
          <Clock size={13} className="text-portal-primary" />
          <span>Aktivitas Transaksi Terbaru</span>
        </div>
        <Link
          href="/riwayat"
          className="text-xs font-semibold text-portal-primary hover:underline flex items-center gap-0.5"
        >
          <span>Lihat Semua</span>
          <ArrowUpRight size={12} />
        </Link>
      </div>

      {displayItems.length === 0 ? (
        <div className="py-6 text-center text-portal-muted text-xs space-y-1">
          <ShoppingBag className="mx-auto text-portal-muted/60 mb-1" size={24} />
          <p className="font-semibold text-portal-text">Belum ada aktivitas transaksi</p>
          <p className="text-[11px]">Transaksi kantin dan top up saldo akan tercatat di sini.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {displayItems.map((tx) => {
            const isTopUp = tx.type === "TOPUP" || tx.amount < 0; // or credit
            const merchantName =
              tx.merchants?.name || tx.description || "Kantin Sekolah (Tap NFC)";
            const txDate = new Date(tx.created_at);
            const timeStr = txDate.toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const dateStr = txDate.toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
            });

            return (
              <div
                key={tx.id}
                className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-portal-surface-alt/70 border border-portal-border/60 hover:bg-portal-surface-alt transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-portal-primary shrink-0">
                    <Utensils size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-portal-text truncate">{merchantName}</p>
                    <p className="text-[10px] text-portal-muted flex items-center gap-1 mt-0.5">
                      <span>{dateStr}, {timeStr} WIB</span>
                      {tx.student_name && (
                        <>
                          <span>•</span>
                          <span className="font-medium text-portal-text/80">{tx.student_name}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-extrabold text-xs text-red-500">
                    -{formatRupiah(Math.abs(tx.amount))}
                  </span>
                  <span className="block text-[9px] font-semibold text-emerald-600 uppercase">
                    {tx.status || "BERHASIL"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
