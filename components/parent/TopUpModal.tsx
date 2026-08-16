"use client";

import { useState } from "react";
import { X, CheckCircle2, Building2, CreditCard, Sparkles } from "lucide-react";

interface TopUpModalProps {
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
}

const PRESET_AMOUNTS = [50000, 100000, 250000, 500000];

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function TopUpModal({ onClose, onSuccess }: TopUpModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number>(100000);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [channel, setChannel] = useState<string>("BNI_VA_INSTANT");
  const [processing, setProcessing] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const activeAmount = customAmount ? Number(customAmount) : selectedAmount;

  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAmount || activeAmount <= 0) {
      setToast({ type: "error", text: "Pilih atau masukkan nominal yang valid." });
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch("/api/v1/parents/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: activeAmount,
          channel,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setToast({
          type: "success",
          text: `Top-Up Berhasil! Reference: ${json.reference}`,
        });
        onSuccess(json.new_balance);
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        const json = await res.json();
        setToast({ type: "error", text: json.message || json.error || "Top-up gagal." });
      }
    } catch {
      setToast({ type: "error", text: "Kesalahan jaringan saat melakukan top-up." });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-portal-surface text-portal-text rounded-2xl p-6 max-w-md w-full space-y-5 border border-portal-border shadow-2xl relative">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-portal-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-portal-primary/15 flex items-center justify-center text-portal-primary">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-portal-text">Top-Up Saldo Instan</h3>
              <p className="text-[11px] text-portal-muted">BNI Virtual Account &amp; Direct Debit SNAP BI</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-portal-muted hover:text-portal-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast alert */}
        {toast && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              toast.type === "success"
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-500 font-semibold"
                : "bg-destructive/15 border-destructive/30 text-destructive font-semibold"
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toast.text}</span>
          </div>
        )}

        <form onSubmit={handleTopUpSubmit} className="space-y-4 text-xs">
          {/* Quick Preset Buttons */}
          <div className="space-y-1.5">
            <label className="text-portal-muted font-semibold">Pilih Nominal Top-Up:</label>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_AMOUNTS.map((amt) => {
                const isSelected = !customAmount && selectedAmount === amt;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setSelectedAmount(amt);
                      setCustomAmount("");
                    }}
                    className={`py-2.5 px-3 rounded-xl border font-bold text-center transition-all ${
                      isSelected
                        ? "bg-portal-primary text-portal-primary-foreground border-portal-primary shadow-sm"
                        : "bg-portal-surface-alt border-portal-border text-portal-text hover:border-portal-primary/50"
                    }`}
                  >
                    {formatRupiah(amt)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Input */}
          <div className="space-y-1">
            <label className="text-portal-muted font-medium">Atau Nominal Lainnya (IDR):</label>
            <input
              type="number"
              placeholder="Masukkan nominal custom e.g. 75000"
              min={10000}
              step={10000}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="w-full rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-2 text-portal-text font-bold text-sm focus:outline-none focus:ring-2 focus:ring-portal-primary"
            />
          </div>

          {/* Payment Channel Selection */}
          <div className="space-y-1.5">
            <label className="text-portal-muted font-semibold">Metode Pembayaran BNI:</label>
            <div className="p-3 rounded-xl bg-portal-surface-alt border border-portal-primary/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-portal-primary" />
                <div>
                  <p className="font-bold text-portal-text">BNI Virtual Account (Otomatis Masuk)</p>
                  <p className="text-[10px] text-portal-muted">BNI Mobile Banking / ATM H2H SNAP BI</p>
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-portal-primary" />
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex justify-end gap-3 pt-3 border-t border-portal-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-portal border border-portal-border text-xs font-semibold text-portal-muted hover:text-portal-text transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={processing}
              className="px-5 py-2 rounded-portal bg-portal-primary text-portal-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity shadow-md"
            >
              {processing ? "Memproses..." : `Konfirmasi & Bayar ${activeAmount ? formatRupiah(activeAmount) : ""}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
