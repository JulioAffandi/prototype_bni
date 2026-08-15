"use client";

import { Loader2, CheckCircle2 } from "lucide-react";

const TOOL_LABELS: Record<string, string> = {
  getPaguStatusToday: "Mengecek pagu harian",
  getChildSpendingSummary: "Merekap belanja kantin",
  getVaultProgress: "Membaca saldo vault",
  getPendingSPP: "Mengecek tagihan SPP",
  getTodaySalesMetrics: "Menghitung omzet & transaksi",
  getTopSellingItems: "Menganalisis menu terlaris",
  getMenuStockStatus: "Mengecek sisa stok menu",
  getSettlementStatus: "Mengecek status settlement BNI",
  getRecentTapAnomalies: "Mendiagnosis anomali tap",
  getSPPCollectionRate: "Menghitung collection rate SPP",
  getUnpaidSPPList: "Mencari daftar tunggakan SPP",
  getAutoDebitFailureLog: "Merekap kegagalan auto-debit",
  getEscrowLedgerBalance: "Membaca ledger escrow & Giro",
  getStudentCardStats: "Menghitung statistik kartu",
  getMerchantPayoutStatus: "Audit status payout kantin",
};

export function ToolInvocationBadge({
  toolName,
  state,
}: {
  toolName: string;
  state: "call" | "result";
}) {
  const label = TOOL_LABELS[toolName] ?? `Menjalankan ${toolName}`;
  const isDone = state === "result";

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-violet-950/40 border border-violet-500/20 text-violet-300 my-1">
      {isDone ? (
        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
      ) : (
        <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />
      )}
      <span>{label}</span>
    </div>
  );
}
