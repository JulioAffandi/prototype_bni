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
    badgeClass: "badge-paid",
    iconClass: "text-primary",
  },
  UNPAID: {
    icon: Clock,
    label: "Belum Bayar",
    badgeClass: "badge-unpaid",
    iconClass: "text-accent",
  },
  FAILED: {
    icon: XCircle,
    label: "Gagal Auto-Debit",
    badgeClass: "badge-failed",
    iconClass: "text-destructive",
  },
  OVERDUE: {
    icon: AlertTriangle,
    label: "Terlambat",
    badgeClass: "badge-overdue",
    iconClass: "text-destructive",
  },
  DRAFT: {
    icon: Clock,
    label: "Draft",
    badgeClass: "badge-unpaid",
    iconClass: "text-muted-foreground",
  },
  CANCELLED: {
    icon: XCircle,
    label: "Batal",
    badgeClass: "badge-failed",
    iconClass: "text-muted-foreground",
  },
};

export default function ParentSPPList({ initialInvoices }: ParentSPPListProps) {
  const [invoices, setInvoices] = useState<ParentInvoice[]>(initialInvoices);
  const [payInvoice, setPayInvoice] = useState<ParentInvoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"va" | "autodebit">("va");
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

      const data = await res.json() as { success?: boolean; invoice?: { paid_at: string; bni_h2h_reference: string }; message?: string; error?: string };

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

      setSuccessMsg(`Pembayaran SPP ${payInvoice.student_name} (${formatRupiah(payInvoice.amount)}) BERHASIL di-settle via BNI H2H!`);
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
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {periods.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center border border-border/60">
          <FileText className="w-10 h-10 text-muted-foreground/70 mx-auto mb-3" />
          <p className="font-bold text-foreground">Belum Ada Tagihan SPP</p>
          <p className="text-sm text-muted-foreground mt-1">
            Tagihan akan muncul setiap awal bulan secara otomatis.
          </p>
        </div>
      )}

      {periods.map((period) => {
        const periodInvoices = periodMap.get(period) ?? [];
        const allPaid = periodInvoices.every((i) => i.status === "PAID");

        return (
          <div key={period} className="glass rounded-2xl p-4 border border-border/60 space-y-3">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <h2 className="font-bold text-sm text-foreground">
                SPP {new Date(period + "-01").toLocaleDateString("id-ID", {
                  month: "long",
                  year: "numeric",
                })}
              </h2>
              {allPaid && (
                <span className="text-xs badge-paid px-2.5 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3 h-3" />
                  Semua Lunas
                </span>
              )}
            </div>

            <div className="space-y-3">
              {periodInvoices.map((inv) => {
                const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.UNPAID;
                const Icon = cfg.icon;
                const isUnpaid = ["UNPAID", "FAILED", "OVERDUE"].includes(inv.status);

                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between py-2 border-b border-border/40 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Icon className={`w-4 h-4 ${cfg.iconClass}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{inv.student_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {inv.paid_at
                            ? `Lunas ${new Date(inv.paid_at).toLocaleDateString("id-ID")}`
                            : `Jatuh tempo ${new Date(inv.due_date).toLocaleDateString("id-ID")}`}
                        </p>
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <p className="text-sm font-bold text-foreground">{formatRupiah(inv.amount)}</p>
                      <div className="flex items-center justify-end gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full inline-block ${cfg.badgeClass}`}>
                          {cfg.label}
                        </span>

                        {isUnpaid && (
                          <button
                            id={`pay-spp-btn-${inv.id}`}
                            onClick={() => {
                              setPayInvoice(inv);
                              setError(null);
                            }}
                            className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 active:scale-[0.98] transition-all shadow-sm flex items-center gap-1"
                          >
                            <CreditCard className="w-3 h-3" />
                            Bayar SPP
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Pembayaran SPP BNI H2H</h3>
                  <p className="text-xs text-muted-foreground">{payInvoice.student_name} · Periode {payInvoice.period}</p>
                </div>
              </div>
              <button
                onClick={() => setPayInvoice(null)}
                className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Total display */}
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/25 text-center">
              <p className="text-xs text-muted-foreground">Total Tagihan SPP</p>
              <p className="text-2xl font-black text-primary mt-0.5">{formatRupiah(payInvoice.amount)}</p>
            </div>

            {/* Method selection */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-foreground">Metode Pembayaran</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("va")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    paymentMethod === "va"
                      ? "border-primary bg-primary/10"
                      : "border-border/80 bg-background text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <p className="font-bold text-xs text-foreground">BNI Virtual Account</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">VA: 98812345{payInvoice.id.slice(0, 4)}</p>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("autodebit")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    paymentMethod === "autodebit"
                      ? "border-primary bg-primary/10"
                      : "border-border/80 bg-background text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <p className="font-bold text-xs text-foreground">BNI Auto-Debit Direct</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Debet Otomatis Rekening Wali</p>
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/25 p-2.5 rounded-xl font-medium">
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPayInvoice(null)}
                disabled={paying}
                className="flex-1 py-2.5 rounded-xl border border-border bg-background text-foreground text-xs font-semibold hover:bg-muted transition-all"
              >
                Batal
              </button>
              <button
                id="confirm-pay-spp-btn"
                type="button"
                onClick={handleConfirmPayment}
                disabled={paying}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-60"
              >
                {paying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memproses...
                  </>
                ) : (
                  "Simulasi Bayar H2H"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
