"use client";

import React from "react";
import { CheckCircle2, QrCode, ShieldCheck, Printer, X, Download } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import EduConnectLogo from "@/components/shared/EduConnectLogo";

export interface SppReceiptData {
  id: string;
  title: string;
  studentName: string;
  amount: number;
  paidAt: string;
  bniReference: string;
  receiptQrHash: string;
  category?: string;
}

interface SppPaymentSuccessModalProps {
  receipt: SppReceiptData | null;
  onClose: () => void;
}

export default function SppPaymentSuccessModal({
  receipt,
  onClose,
}: SppPaymentSuccessModalProps) {
  if (!receipt) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-portal-surface text-portal-text rounded-[1.75rem] p-6 max-w-md w-full space-y-4 border border-portal-border shadow-2xl animate-fade-in">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-portal-border pb-3">
          <div className="flex items-center gap-2">
            <EduConnectLogo variant="icon" width={28} height={28} />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-portal-muted font-bold">
                Kuitansi Resmi BNI H2H
              </p>
              <h3 className="text-sm font-extrabold text-portal-text">Bukti Pembayaran Lunas</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-portal-muted hover:bg-portal-surface-alt hover:text-portal-text transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* QR Code Stamp Box */}
        <div className="p-4 rounded-2xl bg-portal-surface-alt border border-portal-border text-center space-y-2.5">
          <div className="w-24 h-24 mx-auto bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center">
            <div className="w-full h-full border-2 border-dashed border-portal-primary flex flex-col items-center justify-center text-[9px] text-portal-primary font-mono font-bold">
              <QrCode size={40} className="mb-0.5" />
              <span>VERIFIED</span>
            </div>
          </div>

          <div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 size={12} />
              <span>TERVERIFIKASI SNAP BI</span>
            </span>
            <p className="text-[10px] font-mono text-portal-muted mt-1 break-all">
              {receipt.receiptQrHash || `BNI-SNAP-H2H-${receipt.id.slice(0, 12)}`}
            </p>
          </div>
        </div>

        {/* Receipt Line Items */}
        <div className="space-y-2 text-xs">
          <div className="flex justify-between py-1.5 border-b border-portal-border/60">
            <span className="text-portal-muted">Jenis Tagihan:</span>
            <span className="font-bold text-portal-text text-right">{receipt.title}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-portal-border/60">
            <span className="text-portal-muted">Nama Siswa:</span>
            <span className="font-bold text-portal-text">{receipt.studentName}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-portal-border/60">
            <span className="text-portal-muted">Nominal Lunas:</span>
            <span className="font-extrabold text-portal-primary text-sm">
              {formatRupiah(receipt.amount)}
            </span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-portal-border/60">
            <span className="text-portal-muted">Waktu Transaksi:</span>
            <span className="font-medium text-portal-text">
              {new Date(receipt.paidAt).toLocaleString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })} WIB
            </span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-portal-muted">Referensi BNI:</span>
            <span className="font-mono font-bold text-portal-text">{receipt.bniReference}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-3 border-t border-portal-border">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 py-2.5 rounded-2xl border border-portal-border text-xs font-bold text-portal-text hover:bg-portal-surface-alt transition-colors flex items-center justify-center gap-1.5"
          >
            <Printer size={14} />
            <span>Cetak</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-2xl bg-portal-primary text-white text-xs font-bold hover:opacity-95 shadow-portal-glow transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
