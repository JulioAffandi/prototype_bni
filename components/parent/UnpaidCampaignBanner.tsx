"use client";

import Link from "next/link";
import { Megaphone, ArrowRight, DollarSign, Calendar } from "lucide-react";

interface UnpaidCampaignInvoice {
  id: string;
  amount: number;
  student_name: string;
  campaign_title: string;
  due_date: string;
}

interface UnpaidCampaignBannerProps {
  unpaidInvoices: UnpaidCampaignInvoice[];
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function UnpaidCampaignBanner({
  unpaidInvoices,
}: UnpaidCampaignBannerProps) {
  if (unpaidInvoices.length === 0) return null;

  const firstInvoice = unpaidInvoices[0];

  return (
    <div className="rounded-2xl p-4 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
          <Megaphone className="w-5 h-5 animate-bounce" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-500 uppercase tracking-wider text-[10px] bg-amber-500/20 px-2 py-0.5 rounded-md">
              📢 {unpaidInvoices.length} Tagihan Iuran Baru
            </span>
          </div>
          <p className="font-bold text-sm text-foreground mt-1">
            {firstInvoice.campaign_title} ({formatRupiah(firstInvoice.amount)})
          </p>
          <p className="text-muted-foreground text-[11px]">
            Untuk siswa: <strong className="text-foreground">{firstInvoice.student_name}</strong> · Jatuh tempo: {firstInvoice.due_date}
          </p>
        </div>
      </div>

      <Link
        href="/spp?tab=kegiatan"
        className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-portal bg-amber-500 px-4 py-2 text-xs font-bold text-amber-950 hover:bg-amber-400 shadow-md transition-all whitespace-nowrap"
      >
        <span>Bayar Sekarang</span>
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
