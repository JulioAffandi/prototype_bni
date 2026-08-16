"use client";

import { useState } from "react";
import { Wallet, Plus, Building2, ShieldCheck } from "lucide-react";
import TopUpModal from "./TopUpModal";

interface ParentWalletCardProps {
  initialBalance: number;
  bniAccountNumber?: string;
  bniAccountName?: string;
  onBalanceUpdate?: (newBalance: number) => void;
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function ParentWalletCard({
  initialBalance,
  bniAccountNumber = "0987654321",
  bniAccountName = "Wali Siswa",
  onBalanceUpdate,
}: ParentWalletCardProps) {
  const [balance, setBalance] = useState<number>(initialBalance);
  const [showTopUpModal, setShowTopUpModal] = useState<boolean>(false);

  const handleTopUpSuccess = (newBalance: number) => {
    setBalance(newBalance);
    if (onBalanceUpdate) {
      onBalanceUpdate(newBalance);
    }
  };

  return (
    <>
      <div className="glass rounded-2xl p-5 border border-portal-border relative overflow-hidden bg-gradient-to-br from-portal-surface via-portal-surface-alt to-portal-surface shadow-md">
        {/* Top Decorative Glow */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-portal-primary/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-portal-primary/15 flex items-center justify-center text-portal-primary">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-portal-muted font-bold">
                  Saldo Rekening BNI / Dompet Utama
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-portal-surface-alt px-2 py-0.5 rounded-md border border-portal-border text-portal-text">
                    No. Rek: <strong className="text-portal-primary">{bniAccountNumber}</strong> ({bniAccountName})
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-baseline gap-3 pt-1">
              <span className="text-3xl font-extrabold text-portal-text tracking-tight">
                {formatRupiah(balance)}
              </span>
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                <ShieldCheck className="w-3 h-3" />
                <span>SNAP BI Active</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              id="btn-top-up-saldo-instan"
              onClick={() => setShowTopUpModal(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-portal bg-portal-primary px-5 py-2.5 text-xs font-bold text-portal-primary-foreground hover:opacity-90 shadow-md hover:shadow-lg transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>+ Top Up Saldo Instan</span>
            </button>
          </div>
        </div>
      </div>

      {showTopUpModal && (
        <TopUpModal
          onClose={() => setShowTopUpModal(false)}
          onSuccess={handleTopUpSuccess}
        />
      )}
    </>
  );
}
