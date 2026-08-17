"use client";

import { useState } from "react";
import {
  Utensils,
  PlusCircle,
  Receipt,
  RotateCcw,
  ShoppingBag,
  Calendar,
  ChevronRight,
  Filter,
} from "lucide-react";
import { formatRupiah } from "@/lib/format";

export interface UnifiedTransactionItem {
  id: string;
  title: string;
  category: "JAJAN" | "TOPUP" | "SPP" | "REFUND" | "OTHER";
  amount: number; // positive for credit (topup/refund), negative for debit (jajan/spp)
  status: string;
  created_at: string;
  studentName?: string;
  reference?: string;
}

interface TransactionHistoryClientProps {
  initialTransactions: UnifiedTransactionItem[];
}

export default function TransactionHistoryClient({
  initialTransactions,
}: TransactionHistoryClientProps) {
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const categories = [
    { id: "ALL", label: "Semua" },
    { id: "JAJAN", label: "Jajan Kantin" },
    { id: "TOPUP", label: "Top Up" },
    { id: "SPP", label: "SPP & Iuran" },
    { id: "REFUND", label: "Refund" },
  ];

  // Filter items
  const filtered = initialTransactions.filter((tx) => {
    if (activeCategory !== "ALL" && tx.category !== activeCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        tx.title.toLowerCase().includes(q) ||
        (tx.studentName && tx.studentName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Group by Month
  const monthMap = new Map<string, UnifiedTransactionItem[]>();
  filtered.forEach((tx) => {
    const d = new Date(tx.created_at);
    const monthKey = d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, []);
    }
    monthMap.get(monthKey)!.push(tx);
  });

  const months = Array.from(monthMap.keys());

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "JAJAN":
        return <Utensils size={16} className="text-purple-600" />;
      case "TOPUP":
        return <PlusCircle size={16} className="text-emerald-600" />;
      case "SPP":
        return <Receipt size={16} className="text-orange-600" />;
      case "REFUND":
        return <RotateCcw size={16} className="text-blue-600" />;
      default:
        return <ShoppingBag size={16} className="text-portal-muted" />;
    }
  };

  const getCategoryBg = (cat: string) => {
    switch (cat) {
      case "JAJAN":
        return "bg-purple-50 border-purple-100";
      case "TOPUP":
        return "bg-emerald-50 border-emerald-100";
      case "SPP":
        return "bg-orange-50 border-orange-100";
      case "REFUND":
        return "bg-blue-50 border-blue-100";
      default:
        return "bg-slate-50 border-slate-100";
    }
  };

  return (
    <div className="space-y-4">
      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCategory(c.id)}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border ${
              activeCategory === c.id
                ? "bg-portal-primary text-white border-portal-primary shadow-sm"
                : "bg-portal-surface border-portal-border text-portal-muted hover:text-portal-text hover:bg-portal-surface-alt"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Transaction List Grouped by Month */}
      {months.length === 0 ? (
        <div className="rounded-[1.75rem] border border-portal-border bg-portal-surface p-8 text-center shadow-portal-card space-y-2">
          <ShoppingBag className="w-10 h-10 text-portal-muted/50 mx-auto mb-2" />
          <p className="font-bold text-sm text-portal-text">Tidak Ada Riwayat Transaksi</p>
          <p className="text-xs text-portal-muted">
            Belum ada transaksi yang sesuai dengan filter yang dipilih.
          </p>
        </div>
      ) : (
        months.map((month) => {
          const items = monthMap.get(month) || [];
          return (
            <div
              key={month}
              className="rounded-[1.75rem] border border-portal-border bg-portal-surface p-4 sm:p-5 shadow-portal-card space-y-3"
            >
              <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-portal-muted border-b border-portal-border pb-2.5">
                <Calendar size={13} className="text-portal-primary" />
                <span>{month}</span>
              </div>

              <div className="space-y-2">
                {items.map((tx) => {
                  const isCredit = tx.amount > 0;
                  const txDate = new Date(tx.created_at);
                  const timeStr = txDate.toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const dayStr = txDate.toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                  });

                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-portal-surface-alt/70 hover:bg-portal-surface-alt border border-portal-border/60 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${getCategoryBg(
                            tx.category
                          )}`}
                        >
                          {getCategoryIcon(tx.category)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-portal-text truncate">{tx.title}</p>
                          <p className="text-[10px] text-portal-muted flex items-center gap-1 mt-0.5">
                            <span>{dayStr}, {timeStr} WIB</span>
                            {tx.studentName && (
                              <>
                                <span>•</span>
                                <span className="font-semibold text-portal-text/80">{tx.studentName}</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-xs font-black block ${
                            isCredit ? "text-emerald-600" : "text-red-500"
                          }`}
                        >
                          {isCredit ? `+${formatRupiah(tx.amount)}` : `-${formatRupiah(Math.abs(tx.amount))}`}
                        </span>
                        <span className="text-[9px] font-bold text-portal-muted uppercase">
                          {tx.status || "BERHASIL"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
