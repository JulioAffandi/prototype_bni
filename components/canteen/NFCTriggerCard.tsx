"use client";

import { useState, useCallback } from "react";
import { Nfc, CreditCard, X, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cachePaguSnapshot, queueOfflineTransaction, evaluateOfflineApproval } from "@/lib/offlineQueue";

interface MenuItem {
  menu: string;
  qty: number;
  price: number;
}

interface NFCTriggerCardProps {
  merchantId: string;
  totalAmount: number;
  items: MenuItem[];
  onSuccess?: (result: TransactionResult) => void;
  onError?: (error: string) => void;
}

interface TransactionResult {
  transaction_id: string;
  status: string;
  is_emergency: boolean;
  sisa_pagu: number;
}

// Demo students for NFC simulator (only shown when NEXT_PUBLIC_NFC_SIMULATOR_ENABLED=true)
const DEMO_STUDENTS = [
  { name: "Akbar Pratama", uid_hash: "demo-uid-akbar-001", uid_last4: "A001" },
  { name: "Siti Rahayu", uid_hash: "demo-uid-siti-002", uid_last4: "A002" },
  { name: "Budi Santoso", uid_hash: "demo-uid-budi-003", uid_last4: "A003" },
  { name: "Maya Putri", uid_hash: "demo-uid-maya-004", uid_last4: "A004" },
];

type TxState = "idle" | "waiting" | "processing" | "success" | "error" | "rejected";

export default function NFCTriggerCard({
  merchantId,
  totalAmount,
  items,
  onSuccess,
  onError,
}: NFCTriggerCardProps) {
  const [txState, setTxState] = useState<TxState>("idle");
  const [showSimulator, setShowSimulator] = useState(false);
  const [result, setResult] = useState<TransactionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  const simulatorEnabled = process.env.NEXT_PUBLIC_NFC_SIMULATOR_ENABLED === "true";

  function formatRupiah(amount: number) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  }

  const processTransaction = useCallback(
    async (nfcUidHash: string) => {
      setShowSimulator(false);
      setTxState("processing");
      setErrorMsg(null);

      const idempotencyKey = crypto.randomUUID();

      try {
        if (!navigator.onLine) {
          // Offline path (§8.2)
          const approval = await evaluateOfflineApproval(nfcUidHash, totalAmount);
          if (!approval.approved) {
            setTxState("rejected");
            setErrorMsg(approval.reason ?? "Transaksi offline tidak dapat disetujui.");
            onError?.(approval.reason ?? "Offline rejected");
            return;
          }

          const localTxUuid = crypto.randomUUID();
          await queueOfflineTransaction({
            local_tx_uuid: localTxUuid,
            nfc_uid_hash: nfcUidHash,
            merchant_id: merchantId,
            amount: totalAmount,
            items,
            created_at_local: Date.now(),
            pagu_snapshot: 0,
          });

          setResult({
            transaction_id: localTxUuid,
            status: "OFFLINE_QUEUED",
            is_emergency: false,
            sisa_pagu: 0,
          });
          setTxState("success");
          return;
        }

        // Online path
        const res = await fetch("/api/v1/transactions/canteen", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            nfc_uid_hash: nfcUidHash,
            merchant_id: merchantId,
            amount: totalAmount,
            items,
          }),
        });

        const data = await res.json() as TransactionResult & { error?: string; message?: string; sisa_pagu?: number };

        if (!res.ok) {
          if (res.status === 402 || res.status === 429) {
            setTxState("rejected");
            setErrorMsg(data.message ?? "Pagu tidak mencukupi.");
          } else if (res.status === 423) {
            setTxState("rejected");
            setErrorMsg("Kartu diblokir. Hubungi admin sekolah.");
          } else {
            throw new Error(data.message ?? "Transaksi gagal");
          }
          onError?.(errorMsg ?? "Transaction failed");
          return;
        }

        // Cache updated pagu for offline use
        if (data.sisa_pagu !== undefined) {
          await cachePaguSnapshot(nfcUidHash, data.sisa_pagu, totalAmount + data.sisa_pagu);
        }

        setResult(data);
        setTxState("success");
        onSuccess?.(data);
      } catch {
        setTxState("error");
        setErrorMsg("Terjadi kesalahan jaringan. Periksa koneksi Anda.");
        onError?.("Network error");
      }
    },
    [merchantId, totalAmount, items, onSuccess, onError, errorMsg],
  );

  function handleCardTap() {
    if (totalAmount <= 0) return;
    if (simulatorEnabled) {
      setShowSimulator(true);
      setTxState("waiting");
    } else {
      // In production: real NFC read would trigger here via Web NFC API / native bridge
      setTxState("waiting");
    }
  }

  function reset() {
    setTxState("idle");
    setResult(null);
    setErrorMsg(null);
    setShowSimulator(false);
  }

  return (
    <div className="relative">
      {/* ── Main NFC trigger card ── */}
      <button
        id="nfc-trigger-card"
        onClick={handleCardTap}
        disabled={txState === "processing" || totalAmount <= 0}
        aria-label="Tempelkan Kartu KTP NFC Siswa"
        className={`w-full rounded-2xl border-2 transition-all duration-300 overflow-hidden ${
          txState === "success"
            ? "border-primary bg-primary/10"
            : txState === "rejected"
            ? "border-destructive bg-destructive/10"
            : txState === "error"
            ? "border-destructive/50 bg-destructive/5"
            : "border-dashed border-primary/40 bg-primary/5 hover:border-primary hover:bg-primary/10 active:scale-[0.98]"
        } ${totalAmount <= 0 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <div className="p-8 flex flex-col items-center gap-4">
          {/* NFC wave animation */}
          {(txState === "idle" || txState === "waiting") && (
            <div className="relative flex items-center justify-center w-20 h-20">
              {/* Wave rings */}
              <div className="nfc-wave-ring w-20 h-20" />
              <div className="nfc-wave-ring w-20 h-20" />
              <div className="nfc-wave-ring w-20 h-20" />
              {/* Center icon */}
              <div className="absolute w-14 h-14 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center nfc-pulse">
                <Nfc className="w-7 h-7 text-primary" />
              </div>
            </div>
          )}

          {txState === "processing" && (
            <div className="w-14 h-14 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            </div>
          )}

          {txState === "success" && (
            <div className="w-14 h-14 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-primary" />
            </div>
          )}

          {(txState === "rejected" || txState === "error") && (
            <div className="w-14 h-14 rounded-full bg-destructive/15 border border-destructive/30 flex items-center justify-center">
              <XCircle className="w-7 h-7 text-destructive" />
            </div>
          )}

          {/* Status text */}
          <div className="text-center">
            {txState === "idle" && (
              <>
                <p className="font-semibold text-primary">Tempelkan Kartu KTP NFC Siswa</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Total: <span className="font-bold text-foreground">{formatRupiah(totalAmount)}</span>
                </p>
              </>
            )}
            {txState === "waiting" && (
              <p className="font-semibold text-primary">Menunggu kartu...</p>
            )}
            {txState === "processing" && (
              <p className="font-semibold">Memproses transaksi...</p>
            )}
            {txState === "success" && result && (
              <>
                <p className="font-semibold text-primary">
                  {result.status === "OFFLINE_QUEUED" ? "Antre Offline" : "Transaksi Berhasil"}
                </p>
                {result.is_emergency && (
                  <p className="text-xs text-accent mt-0.5">Mode Darurat Digunakan</p>
                )}
                {result.sisa_pagu > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Sisa pagu: <span className="font-semibold text-primary">{formatRupiah(result.sisa_pagu)}</span>
                  </p>
                )}
              </>
            )}
            {(txState === "rejected" || txState === "error") && (
              <>
                <p className="font-semibold text-destructive">
                  {txState === "rejected" ? "Transaksi Ditolak" : "Terjadi Kesalahan"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
              </>
            )}
          </div>

          {/* Reset button */}
          {txState !== "idle" && txState !== "processing" && (
            <button
              id="nfc-reset-btn"
              onClick={(e) => { e.stopPropagation(); reset(); }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-full px-3 py-1.5 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Transaksi Baru</span>
            </button>
          )}
        </div>
      </button>

      {/* ── NFC Simulator Bottom Sheet (§2.3) ── */}
      {simulatorEnabled && showSimulator && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => { setShowSimulator(false); setTxState("idle"); }}
          />

          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-card border-t border-border p-6 animate-in slide-in-from-bottom duration-300">
            <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-5" />
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-5 h-5 text-accent" />
              <h3 className="font-semibold">Pilih Siswa (Simulator)</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Mode demo aktif. Fitur ini dinonaktifkan di produksi.
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {DEMO_STUDENTS.map((student) => (
                <button
                  key={student.uid_hash}
                  id={`sim-student-${student.uid_last4}`}
                  onClick={() => processTransaction(student.uid_hash)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{student.name}</p>
                    <p className="text-xs text-muted-foreground">UID: ****{student.uid_last4}</p>
                  </div>
                </button>
              ))}
            </div>
            <button
              id="sim-close-btn"
              onClick={() => { setShowSimulator(false); setTxState("idle"); }}
              className="w-full mt-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Batal
            </button>
          </div>
        </>
      )}
    </div>
  );
}
