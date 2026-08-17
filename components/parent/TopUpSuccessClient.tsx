"use client";

import React from "react";
import { CheckCircle2, ArrowRight, Home, Receipt, ShieldCheck, Copy, Check } from "lucide-react";
import Link from "next/link";
import { formatRupiah } from "@/lib/format";
import EduConnectLogo from "@/components/shared/EduConnectLogo";

interface TopUpSuccessClientProps {
  amount: number;
  newBalance: number;
  reference: string;
  paymentMethod?: string;
  onReset?: () => void;
}

export default function TopUpSuccessClient({
  amount,
  newBalance,
  reference,
  paymentMethod = "BNI Virtual Account Instant",
}: TopUpSuccessClientProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopyRef = () => {
    navigator.clipboard.writeText(reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-[1.75rem] border border-portal-border bg-portal-surface p-6 text-center space-y-4 shadow-portal-card animate-fade-in">
      {/* Top Success Badge */}
      <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 border border-emerald-200 mx-auto flex items-center justify-center shadow-sm">
        <CheckCircle2 size={36} />
      </div>

      <div>
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">
          <ShieldCheck size={13} />
          <span>TRANSAKSI SETTLED BNI</span>
        </span>
        <h2 className="text-xl font-black text-portal-text tracking-tight">
          Top Up Saldo Berhasil!
        </h2>
        <p className="text-xs text-portal-muted mt-0.5">
          Saldo rekening dompet utama telah berhasil diperbarui.
        </p>
      </div>

      {/* Top Up Nominal Display */}
      <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-100 space-y-1">
        <p className="text-xs text-portal-muted font-medium">Nominal Top Up</p>
        <p className="text-2xl sm:text-3xl font-black text-portal-primary">
          +{formatRupiah(amount)}
        </p>
      </div>

      {/* Transaction Details */}
      <div className="p-4 rounded-2xl bg-portal-surface-alt border border-portal-border space-y-2 text-xs text-left">
        <div className="flex justify-between py-1 border-b border-portal-border/60">
          <span className="text-portal-muted">Metode Pembayaran:</span>
          <span className="font-bold text-portal-text">{paymentMethod}</span>
        </div>
        <div className="flex justify-between items-center py-1 border-b border-portal-border/60">
          <span className="text-portal-muted">No. Referensi BNI:</span>
          <div className="flex items-center gap-1.5 font-mono font-bold text-portal-primary">
            <span>{reference}</span>
            <button
              type="button"
              onClick={handleCopyRef}
              className="p-1 hover:bg-slate-200 rounded text-portal-muted hover:text-portal-text"
              title="Salin referensi"
            >
              {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
            </button>
          </div>
        </div>
        <div className="flex justify-between py-1 border-b border-portal-border/60">
          <span className="text-portal-muted">Waktu Transaksi:</span>
          <span className="font-medium text-portal-text">
            {new Date().toLocaleString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })} WIB
          </span>
        </div>
        <div className="flex justify-between py-1 pt-1.5 font-bold text-sm">
          <span>Saldo Akhir Dompet:</span>
          <span className="text-emerald-600 font-extrabold">{formatRupiah(newBalance)}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex flex-col gap-2">
        <Link
          href="/dashboard"
          className="w-full py-3 rounded-2xl bg-portal-primary text-white text-xs font-bold hover:opacity-95 shadow-portal-glow flex items-center justify-center gap-1.5"
        >
          <Home size={14} />
          <span>Kembali ke Beranda</span>
        </Link>
        <Link
          href="/riwayat"
          className="w-full py-3 rounded-2xl border border-portal-border text-portal-muted text-xs font-bold hover:text-portal-text hover:bg-portal-surface-alt transition-colors flex items-center justify-center gap-1.5"
        >
          <Receipt size={14} />
          <span>Lihat Riwayat Transaksi</span>
        </Link>
      </div>
    </div>
  );
}
