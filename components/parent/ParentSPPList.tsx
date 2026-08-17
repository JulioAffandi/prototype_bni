"use client";

import { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  CreditCard,
  Building2,
  Loader2,
  X,
  FileText,
  ShieldCheck,
} from "lucide-react";
import type { invoice_status_t } from "@/types/database";

type SPPStatus = invoice_status_t;

export interface ParentInvoice {
  id: string;
  student_id: string;
  student_name: string;
  period: string;
  amount: number;
  status: SPPStatus;
  due_date: string;
  paid_at: string | null;
  retry_count: number;
}

interface ParentSPPListProps {
  initialInvoices: ParentInvoice[];
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

const STATUS_CONFIG: Record<
  string,
  { icon: typeof CheckCircle2; label: string; badgeClass: string; iconClass: string }
> = {
  PAID: {
    icon: CheckCircle2,
    label: "Lunas",
    badgeClass: "bg-emerald-50 text-emerald-600 border-emerald-200",
    iconClass: "text-emerald-600",
  },
  UNPAID: {
    icon: Clock,
    label: "Belum Bayar",
    badgeClass: "bg-amber-50 text-amber-600 border-amber-200",
    iconClass: "text-amber-600",
  },
  FAILED: {
    icon: XCircle,
    label: "Gagal Auto-Debit",
    badgeClass: "bg-red-50 text-red-600 border-red-200",
    iconClass: "text-red-600",
  },
  OVERDUE: {
    icon: AlertTriangle,
    label: "Terlambat",
    badgeClass: "bg-red-50 text-red-600 border-red-200",
    iconClass: "text-red-600",
  },
  DRAFT: {
    icon: Clock,
    label: "Draft",
    badgeClass: "bg-slate-50 text-slate-600 border-slate-200",
    iconClass: "text-slate-500",
  },
  CANCELLED: {
    icon: XCircle,
    label: "Batal",
    badgeClass: "bg-slate-50 text-slate-600 border-slate-200",
    iconClass: "text-slate-500",
  },
};

export default function ParentSPPList({ initialInvoices }: ParentSPPListProps) {
  const [invoices, setInvoices] = useState<ParentInvoice[]>(initialInvoices);
  const [payInvoice, setPayInvoice] = useState<ParentInvoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"va" | "autodebit">("autodebit");
  const [paying, setPaying] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Group by period
  const periodMap = new Map<string, ParentInvoice[]>();
  for (const inv of invoices) {
    if (!periodMap.has(inv.period)) periodMap.set(inv.period, []);
    periodMap.get(inv.period)!.push(inv);
  }
  const periods = Array.from(periodMap.keys()).sort((a, b) => b.localeCompare(a));

  async function handleConfirmPayment() {
    if (!payInvoice) return;
    setPaying(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/spp/${payInvoice.id}/pay`, {
        method: "POST",
      });

      const data = (await res.json()) as {
        success?: boolean;
        invoice?: { paid_at: string; bni_h2h_reference: string };
        message?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? "Gagal memproses pembayaran SPP");
      }

      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === payInvoice.id
            ? { ...inv, status: "PAID", paid_at: data.invoice?.paid_at || new Date().toISOString() }
            : inv
        )
      );

      setSuccessMsg(
        `Pembayaran SPP ${payInvoice.student_name} (${formatRupiah(
          payInvoice.amount
        )}) BERHASIL di-settle via BNI H2H!`
      );
      setPayInvoice(null);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="space-y-4">
      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {periods.length === 0 && (
        <div className="rounded-[1.75rem] border border-portal-border bg-portal-surface p-8 text-center shadow-portal-card space-y-2">
          <FileText className="w-10 h-10 text-portal-muted/60 mx-auto mb-2" />
          <p className="font-bold text-sm text-portal-text">Belum Ada Tagihan SPP</p>
          <p className="text-xs text-portal-muted">
            Tagihan SPP bulanan sekolah akan muncul di sini secara otomatis.
          </p>
        </div>
      )}

      {periods.map((period) => {
        const periodInvoices = periodMap.get(period) ?? [];
        const allPaid = periodInvoices.every((i) => i.status === "PAID");

        return (
          <div
            key={period}
            className="rounded-[1.75rem] border border-portal-border bg-portal-surface p-4 sm:p-5 shadow-portal-card space-y-3.5"
          >
            <div className="flex items-center justify-between border-b border-portal-border pb-2.5">
              <h2 className="font-extrabold text-sm text-portal-text">
                SPP{" "}
                {new Date(period + "-01").toLocaleDateString("id-ID", {
                  month: "long",
                  year: "numeric",
                })}
              </h2>
              {allPaid && (
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-bold">
                  <CheckCircle2 className="w-3 h-3" />
                  Semua Lunas
                </span>
              )}
            </div>

            <div className="space-y-2.5">
              {periodInvoices.map((inv) => {
                const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.UNPAID;
                const Icon = cfg.icon;
                const isUnpaid = ["UNPAID", "FAILED", "OVERDUE"].includes(inv.status);

                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between py-2.5 border-b border-portal-border/60 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-portal-surface-alt border border-portal-border flex items-center justify-center shrink-0">
                        <Icon className={`w-4 h-4 ${cfg.iconClass}`} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-portal-text">{inv.student_name}</p>
                        <p className="text-[10px] text-portal-muted mt-0.5">
                          {inv.paid_at
                            ? `Lunas ${new Date(inv.paid_at).toLocaleDateString("id-ID")}`
                            : `Jatuh tempo ${new Date(inv.due_date).toLocaleDateString("id-ID")}`}
                        </p>
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <p className="text-xs font-extrabold text-portal-text">
                        {formatRupiah(inv.amount)}
                      </p>
                      <div className="flex items-center justify-end gap-1.5">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md border font-bold ${cfg.badgeClass}`}
                        >
                          {cfg.label}
                        </span>

                        {isUnpaid && (
                          <button
                            id={`pay-spp-btn-${inv.id}`}
                            onClick={() => {
                              setPayInvoice(inv);
                              setError(null);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-portal-primary text-white text-[11px] font-bold hover:opacity-90 active:scale-95 transition-all shadow-sm flex items-center gap-1"
                          >
                            <CreditCard className="w-3 h-3" />
                            Bayar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Payment Modal */}
      {payInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-portal-surface border border-portal-border rounded-[1.75rem] w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-portal-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-purple-50 flex items-center justify-center text-portal-primary">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-portal-text">Pembayaran SPP BNI</h3>
                  <p className="text-[11px] text-portal-muted">
                    {payInvoice.student_name} · Periode {payInvoice.period}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayInvoice(null)}
                className="w-8 h-8 rounded-xl hover:bg-portal-surface-alt flex items-center justify-center text-portal-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Total display */}
            <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-100 text-center">
              <p className="text-xs text-portal-muted font-medium">Total Tagihan SPP</p>
              <p className="text-2xl font-black text-portal-primary mt-0.5">
                {formatRupiah(payInvoice.amount)}
              </p>
            </div>

            {/* Method selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-portal-text">
                Pilih Metode Pembayaran
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("autodebit")}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    paymentMethod === "autodebit"
                      ? "border-portal-primary bg-purple-50/60 shadow-sm"
                      : "border-portal-border bg-portal-surface-alt text-portal-muted hover:border-portal-primary/50"
                  }`}
                >
                  <p className="font-bold text-xs text-portal-text">BNI Direct Debit</p>
                  <p className="text-[10px] text-portal-muted mt-0.5">Autodebet Saldo BNI</p>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("va")}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    paymentMethod === "va"
                      ? "border-portal-primary bg-purple-50/60 shadow-sm"
                      : "border-portal-border bg-portal-surface-alt text-portal-muted hover:border-portal-primary/50"
                  }`}
                >
                  <p className="font-bold text-xs text-portal-text">BNI Virtual Account</p>
                  <p className="text-[10px] text-portal-muted mt-0.5">VA: 98812345...</p>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100">
              <ShieldCheck size={14} className="shrink-0" />
              <span>Transaksi diamankan protokol BNI H2H SNAP BI</span>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 p-2.5 rounded-xl font-medium">
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-2 border-t border-portal-border">
              <button
                type="button"
                onClick={() => setPayInvoice(null)}
                disabled={paying}
                className="flex-1 py-2.5 rounded-2xl border border-portal-border bg-portal-surface text-portal-muted text-xs font-bold hover:bg-portal-surface-alt transition-all"
              >
                Batal
              </button>
              <button
                id="confirm-pay-spp-btn"
                type="button"
                onClick={handleConfirmPayment}
                disabled={paying}
                className="flex-1 py-2.5 rounded-2xl bg-portal-primary text-white text-xs font-bold hover:opacity-95 transition-all flex items-center justify-center gap-1.5 shadow-portal-glow disabled:opacity-60"
              >
                {paying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memproses...
                  </>
                ) : (
                  "Konfirmasi Bayar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
