"use client";

import { useState } from "react";
import { TrendingUp, Target, Sparkles, Pencil, Loader2, X } from "lucide-react";

interface VaultGoalCardProps {
  studentId?: string;
  studentName: string;
  vaultBalance: number;
  goalName: string;
  goalTarget: number;
  onGoalUpdated?: (newGoalName: string, newGoalTarget: number) => void;
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function VaultGoalCard({
  studentId,
  studentName,
  vaultBalance,
  goalName: initialGoalName,
  goalTarget: initialGoalTarget,
  onGoalUpdated,
}: VaultGoalCardProps) {
  const [goalName, setGoalName] = useState(initialGoalName);
  const [goalTarget, setGoalTarget] = useState(initialGoalTarget);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(initialGoalName);
  const [editTarget, setEditTarget] = useState(initialGoalTarget);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const progress = goalTarget > 0 ? Math.min(100, (vaultBalance / goalTarget) * 100) : 0;
  const remaining = Math.max(0, goalTarget - vaultBalance);
  const isCompleted = vaultBalance >= goalTarget;

  async function handleSaveGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/students/${studentId}/vault`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          savings_goal_name: editName.trim(),
          savings_goal_target: Number(editTarget),
        }),
      });

      if (!res.ok) {
        const data = await res.json() as { message?: string };
        throw new Error(data.message ?? "Gagal memperbarui target tabungan");
      }

      setGoalName(editName.trim());
      setGoalTarget(Number(editTarget));
      onGoalUpdated?.(editName.trim(), Number(editTarget));
      setShowEditModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  }

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

          <div className="flex items-center gap-2">
            {isCompleted && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full badge-settled text-xs">
                <Sparkles className="w-3 h-3" />
                <span>Tercapai!</span>
              </div>
            )}
            {studentId && (
              <button
                id={`edit-goal-btn-${studentId}`}
                onClick={() => {
                  setEditName(goalName);
                  setEditTarget(goalTarget);
                  setError(null);
                  setShowEditModal(true);
                }}
                className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-all text-xs flex items-center gap-1"
                title="Edit Target Tabungan"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Balance */}
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-0.5">Saldo Terkumpul</p>
          <p className="text-3xl font-bold gradient-text">{formatRupiah(vaultBalance)}</p>
        </div>

        {/* Goal progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium">{goalName}</span>
            </div>
            {studentId && (
              <button
                onClick={() => {
                  setEditName(goalName);
                  setEditTarget(goalTarget);
                  setError(null);
                  setShowEditModal(true);
                }}
                className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" /> Edit Target
              </button>
            )}
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

      {/* Edit Target Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-accent" />
                <h3 className="font-bold text-base text-foreground">Edit Target Tabungan</h3>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Nama Impian / Target</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Contoh: Beli Sepeda Baru"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Target Nominal (Rp)</label>
                <input
                  type="number"
                  step={10000}
                  value={editTarget}
                  onChange={(e) => setEditTarget(Number(e.target.value))}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm mb-2"
                />
                <div className="flex gap-2">
                  {[100000, 300000, 500000, 1000000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setEditTarget(preset)}
                      className={`flex-1 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                        editTarget === preset
                          ? "bg-accent text-accent-foreground border-accent"
                          : "bg-muted/50 text-muted-foreground border-border/60 hover:text-foreground"
                      }`}
                    >
                      Rp {(preset / 1000).toLocaleString("id-ID")}k
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-xs text-destructive bg-destructive/10 border border-destructive/25 p-2 rounded-xl">
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={saving}
                  className="flex-1 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-semibold hover:bg-muted transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving || !editName.trim()}
                  className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-1 shadow-md"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyimpan...
                    </>
                  ) : (
                    "Simpan Target"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

