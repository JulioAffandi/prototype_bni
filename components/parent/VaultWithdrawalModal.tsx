"use client";

import { useState } from "react";
import { ArrowDownToLine, AlertCircle, Loader2, CheckCircle2, X } from "lucide-react";

interface VaultWithdrawalModalProps {
  studentId: string;
  studentName: string;
  vaultBalance: number;
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function VaultWithdrawalModal({
  studentId,
  studentName,
  vaultBalance: initialBalance,
}: VaultWithdrawalModalProps) {
  const [balance, setBalance] = useState(initialBalance);
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState<number>(initialBalance > 0 ? initialBalance : 50000);
  const [destinationAccount, setDestinationAccount] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    if (amount <= 0 || amount > balance) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/students/${studentId}/vault/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          destination_account: destinationAccount.trim() || undefined,
        }),
      });

      const data = await res.json() as { success?: boolean; withdrawal?: { amount: number }; message?: string; error?: string };

      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? "Gagal mengajukan pencairan tabungan");
      }

      const withdrawnAmt = data.withdrawal?.amount || amount;
      setBalance((prev) => Math.max(0, prev - withdrawnAmt));
      setSuccessMsg(`Permohonan pencairan ${formatRupiah(withdrawnAmt)} berhasil diajukan (Pending Confirmation BNI H2H).`);
      setShowModal(false);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-5 border border-border/60 space-y-3">
      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground">
          <ArrowDownToLine className="w-4 h-4 text-primary" />
          Cairkan Tabungan Vault
        </h3>
        <span className="text-xs text-muted-foreground">{studentName}</span>
      </div>

      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/50 border border-border/50">
        <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Pencairan memerlukan konfirmasi dua pihak (Dual Control). Dana dikembalikan langsung ke rekening BNI Orang Tua.
        </p>
      </div>

      {balance > 0 ? (
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-xs text-muted-foreground">Saldo Tersedia</p>
            <p className="font-bold text-lg text-foreground">{formatRupiah(balance)}</p>
          </div>
          <button
            id={`open-withdraw-modal-${studentId}`}
            onClick={() => {
              setAmount(balance);
              setError(null);
              setShowModal(true);
            }}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md flex items-center gap-1.5"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            Cairkan Dana
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">
          Belum ada saldo Vault yang dapat dicairkan
        </p>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ArrowDownToLine className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-base text-foreground">Pengajuan Pencairan Vault</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleWithdraw} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Nominal Pencairan (Saldo: {formatRupiah(balance)})
                </label>
                <input
                  type="number"
                  step={5000}
                  max={balance}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm mb-2"
                />
                <div className="flex gap-2">
                  {[0.25, 0.5, 0.75, 1].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setAmount(Math.floor(balance * pct))}
                      className="flex-1 py-1 rounded-lg text-[11px] font-semibold border border-border bg-muted/50 hover:bg-muted text-foreground transition-all"
                    >
                      {pct * 100}%
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Rekening Tujuan BNI (Opsional)
                </label>
                <input
                  type="text"
                  value={destinationAccount}
                  onChange={(e) => setDestinationAccount(e.target.value)}
                  placeholder="Contoh: 0123456789 (Rekening BNI Wali)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                />
              </div>

              {error && (
                <p className="text-xs text-destructive bg-destructive/10 border border-destructive/25 p-2.5 rounded-xl font-medium">
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl border border-border bg-background text-foreground text-xs font-semibold hover:bg-muted transition-all"
                >
                  Batal
                </button>
                <button
                  id="submit-withdraw-btn"
                  type="submit"
                  disabled={loading || amount <= 0 || amount > balance}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-1 shadow-md disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memproses...
                    </>
                  ) : (
                    "Konfirmasi Cairkan"
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
