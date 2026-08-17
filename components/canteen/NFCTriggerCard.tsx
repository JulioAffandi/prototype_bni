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
  /** "compact" trims padding so the reader fits inside the POS order sidebar. */
  variant?: "default" | "compact";
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
  variant = "default",
}: NFCTriggerCardProps) {
  const [txState, setTxState] = useState<TxState>("idle");
  const [showSimulator, setShowSimulator] = useState(false);
  const [result, setResult] = useState<TransactionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const simulatorEnabled = process.env.NEXT_PUBLIC_NFC_SIMULATOR_ENABLED === "true";
  const isCompact = variant === "compact";

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

  const isDisabled = txState === "processing" || totalAmount <= 0;

  return (
    <div className="relative">
      {/* ── Main NFC trigger card ── */}
      <button
        type="button"
        id="nfc-trigger-card"
        onClick={handleCardTap}
        disabled={isDisabled}
        aria-label="Tempelkan Kartu KTA NFC Siswa"
        className={`w-full overflow-hidden rounded-2xl border-2 transition-all duration-300 ${
          txState === "success"
            ? "border-emerald-400 bg-emerald-50"
            : txState === "rejected" || txState === "error"
            ? "border-red-300 bg-red-50"
            : totalAmount <= 0
            ? "border-dashed border-slate-200 bg-slate-50"
            : "cursor-pointer border-dashed border-orange-300 bg-orange-50/60 hover:border-orange-400 hover:bg-orange-50 active:scale-[0.99]"
        } ${totalAmount <= 0 ? "cursor-not-allowed" : ""}`}
      >
        <div className={`flex flex-col items-center gap-3 ${isCompact ? "p-5" : "p-8"}`}>
          {/* NFC wave animation */}
          {(txState === "idle" || txState === "waiting") && (
            <div
              className={`relative flex items-center justify-center ${
                isCompact ? "h-16 w-16" : "h-20 w-20"
              } ${totalAmount <= 0 ? "text-slate-300" : "text-orange-400"}`}
            >
              {/* Wave rings — inherit currentColor */}
              <div className={`nfc-wave-ring ${isCompact ? "h-16 w-16" : "h-20 w-20"}`} />
              <div className={`nfc-wave-ring ${isCompact ? "h-16 w-16" : "h-20 w-20"}`} />
              <div className={`nfc-wave-ring ${isCompact ? "h-16 w-16" : "h-20 w-20"}`} />
              {/* Center icon */}
              <div
                className={`nfc-pulse absolute flex items-center justify-center rounded-full border-2 ${
                  isCompact ? "h-12 w-12" : "h-14 w-14"
                } ${
                  totalAmount <= 0
                    ? "border-slate-200 bg-slate-100"
                    : "border-orange-300 bg-white shadow-sm"
                }`}
              >
                <Nfc
                  className={`${isCompact ? "h-6 w-6" : "h-7 w-7"} ${
                    totalAmount <= 0 ? "text-slate-400" : "text-orange-500"
                  }`}
                />
              </div>
            </div>
          )}

          {txState === "processing" && (
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-purple-200 bg-purple-50">
              <Loader2 className="h-7 w-7 animate-spin text-[#7357C7]" />
            </div>
          )}

          {txState === "success" && (
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-200 bg-white">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
          )}

          {(txState === "rejected" || txState === "error") && (
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-red-200 bg-white">
              <XCircle className="h-7 w-7 text-red-500" />
            </div>
          )}

          {/* Status text */}
          <div className="text-center">
            {txState === "idle" && (
              <>
                <p
                  className={`text-sm font-bold ${
                    totalAmount <= 0 ? "text-slate-400" : "text-orange-600"
                  }`}
                >
                  Tempelkan Kartu KTA NFC Siswa
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {totalAmount > 0 ? (
                    <>
                      Siap memproses{" "}
                      <span className="font-extrabold text-slate-900">
                        {formatRupiah(totalAmount)}
                      </span>
                    </>
                  ) : (
                    "Pilih menu terlebih dahulu"
                  )}
                </p>
              </>
            )}
            {txState === "waiting" && (
              <p className="text-sm font-bold text-orange-600">Menunggu kartu...</p>
            )}
            {txState === "processing" && (
              <p className="text-sm font-bold text-[#7357C7]">Membaca Kartu NFC Siswa...</p>
            )}
            {txState === "success" && result && (
              <>
                <p className="text-sm font-bold text-emerald-700">
                  {result.status === "OFFLINE_QUEUED" ? "Antre Offline" : "Transaksi Berhasil"}
                </p>
                {result.is_emergency && (
                  <p className="mt-0.5 text-xs font-semibold text-amber-600">
                    Mode Darurat Digunakan
                  </p>
                )}
                {result.sisa_pagu > 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    Sisa pagu:{" "}
                    <span className="font-bold text-emerald-700">
                      {formatRupiah(result.sisa_pagu)}
                    </span>
                  </p>
                )}
                <p className="mt-1 font-mono text-[10px] text-slate-400">
                  {result.transaction_id.slice(0, 18)}
                </p>
              </>
            )}
            {(txState === "rejected" || txState === "error") && (
              <>
                <p className="text-sm font-bold text-red-600">
                  {txState === "rejected" ? "Transaksi Ditolak" : "Terjadi Kesalahan"}
                </p>
                <p className="mt-1 text-xs text-slate-500">{errorMsg}</p>
              </>
            )}
          </div>

          {/* Reset button */}
          {txState !== "idle" && txState !== "processing" && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                reset();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  reset();
                }
              }}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900"
            >
              <X className="h-3.5 w-3.5" />
              <span>Transaksi Baru</span>
            </span>
          )}
        </div>
      </button>

      {/* ── NFC Simulator Bottom Sheet (§2.3) ── */}
      {simulatorEnabled && showSimulator && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => {
              setShowSimulator(false);
              setTxState("idle");
            }}
          />

          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-slate-200 bg-white p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-slate-200" />
            <div className="mb-1 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[#7357C7]" />
              <h3 className="text-sm font-bold text-slate-900">Pilih Siswa (Simulator)</h3>
            </div>
            <p className="mb-4 text-xs text-slate-500">
              Mode demo aktif. Fitur ini dinonaktifkan di produksi.
            </p>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {DEMO_STUDENTS.map((student) => (
                <button
                  type="button"
                  key={student.uid_hash}
                  id={`sim-student-${student.uid_last4}`}
                  onClick={() => processTransaction(student.uid_hash)}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-orange-300 hover:bg-orange-50/50"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-orange-200 bg-orange-50">
                    <CreditCard className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{student.name}</p>
                    <p className="text-xs text-slate-500">UID: ****{student.uid_last4}</p>
                  </div>
                </button>
              ))}
            </div>
            <button
              type="button"
              id="sim-close-btn"
              onClick={() => {
                setShowSimulator(false);
                setTxState("idle");
              }}
              className="mt-4 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-900"
            >
              Batal
            </button>
          </div>
        </>
      )}
    </div>
  );
}
