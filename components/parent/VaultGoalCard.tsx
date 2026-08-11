"use client";

import { TrendingUp, Target, Sparkles } from "lucide-react";

interface VaultGoalCardProps {
  studentName: string;
  vaultBalance: number;
  goalName: string;
  goalTarget: number;
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function VaultGoalCard({
  studentName,
  vaultBalance,
  goalName,
  goalTarget,
}: VaultGoalCardProps) {
  const progress = goalTarget > 0 ? Math.min(100, (vaultBalance / goalTarget) * 100) : 0;
  const remaining = Math.max(0, goalTarget - vaultBalance);
  const isCompleted = vaultBalance >= goalTarget;

  return (
    <div className="glass rounded-2xl p-5 relative overflow-hidden card-hover">
      {/* Background decoration */}
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-primary/5" />
      <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-accent/5" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Student Goal Vault</h3>
              <p className="text-xs text-muted-foreground">{studentName}</p>
            </div>
          </div>
          {isCompleted && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full badge-settled text-xs">
              <Sparkles className="w-3 h-3" />
              <span>Tercapai!</span>
            </div>
          )}
        </div>

        {/* Balance */}
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-0.5">Saldo Terkumpul</p>
          <p className="text-3xl font-bold gradient-text">{formatRupiah(vaultBalance)}</p>
        </div>

        {/* Goal progress */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium">{goalName}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Target: {formatRupiah(goalTarget)}</span>
            <span className="font-semibold text-primary">{Math.round(progress)}%</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full progress-fill relative"
              style={{ width: `${progress}%` }}
            >
              {/* Shimmer on progress bar */}
              <div className="absolute inset-0 rounded-full overflow-hidden">
                <div className="absolute inset-0 w-full h-full animate-pulse opacity-30 bg-white rounded-full" />
              </div>
            </div>
          </div>
          {!isCompleted && (
            <p className="text-xs text-muted-foreground mt-1">
              Kurang <span className="font-semibold text-foreground">{formatRupiah(remaining)}</span> lagi
            </p>
          )}
        </div>

        {/* Info */}
        <div className="p-3 rounded-xl bg-muted/50 text-xs text-muted-foreground">
          Sisa pagu harian yang tidak terpakai otomatis disimpan ke Vault setiap pukul 23:59 WIB.
          Pencairan memerlukan persetujuan orang tua (Dual Control).
        </div>
      </div>
    </div>
  );
}
