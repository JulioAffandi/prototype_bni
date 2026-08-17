"use client";

import Link from "next/link";
import { PlusCircle, History, Receipt, SlidersHorizontal, CreditCard } from "lucide-react";

export default function QuickActionGrid() {
  const actions = [
    {
      href: "/topup",
      label: "Top Up",
      description: "Isi Saldo BNI",
      icon: PlusCircle,
      bgClass: "bg-purple-50 text-[#7357C7]",
      borderClass: "border-purple-100",
      id: "quick-action-topup",
    },
    {
      href: "/riwayat",
      label: "Riwayat",
      description: "Semua Transaksi",
      icon: History,
      bgClass: "bg-orange-50 text-[#F97316]",
      borderClass: "border-orange-100",
      id: "quick-action-riwayat",
    },
    {
      href: "/spp",
      label: "SPP & Iuran",
      description: "Tagihan Sekolah",
      icon: Receipt,
      bgClass: "bg-emerald-50 text-emerald-600",
      borderClass: "border-emerald-100",
      id: "quick-action-spp",
    },
    {
      href: "/pagu",
      label: "Atur Pagu",
      description: "Limit Jajan Harian",
      icon: SlidersHorizontal,
      bgClass: "bg-indigo-50 text-indigo-600",
      borderClass: "border-indigo-100",
      id: "quick-action-pagu",
    },
  ];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-portal-muted">
          Aksi Cepat
        </h3>
        <Link
          href="/kartu"
          className="text-xs font-semibold text-portal-primary hover:underline flex items-center gap-1"
        >
          <CreditCard size={13} />
          <span>Kelola Kartu NFC</span>
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <Link
              key={act.href}
              id={act.id}
              href={act.href}
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-portal-surface border border-portal-border shadow-portal-card hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 active:scale-95 group text-center"
            >
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-1.5 transition-transform group-hover:scale-110 ${act.bgClass} ${act.borderClass} border`}
              >
                <Icon size={20} strokeWidth={2.2} />
              </div>
              <span className="text-xs font-bold text-portal-text leading-tight group-hover:text-portal-primary transition-colors">
                {act.label}
              </span>
              <span className="text-[9px] text-portal-muted font-medium mt-0.5 leading-none line-clamp-1">
                {act.description}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
