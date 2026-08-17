"use client";

import { useState } from "react";
import {
  Megaphone,
  CheckCircle2,
  Clock,
  QrCode,
  ShieldCheck,
  X,
  CreditCard,
  Building2,
  Loader2,
} from "lucide-react";
import SppPaymentSuccessModal, { SppReceiptData } from "./SppPaymentSuccessModal";

export interface FormattedCampaignInvoice {
  id: string;
  campaign_id: string;
  student_name: string;
  campaign_title: string;
  category: string;
  amount: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  bni_h2h_reference: string | null;
  receipt_qr_hash: string | null;
}

interface ParentCampaignInvoicesTabProps {
  invoices: FormattedCampaignInvoice[];
  parentWalletBalance: number;
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function ParentCampaignInvoicesTab({
  invoices: initialInvoices,
  parentWalletBalance: initialWalletBalance,
}: ParentCampaignInvoicesTabProps) {
  const [invoices, setInvoices] = useState<FormattedCampaignInvoice[]>(initialInvoices);
  const [walletBalance, setWalletBalance] = useState<number>(initialWalletBalance);
  const [selectedInvoice, setSelectedInvoice] = useState<FormattedCampaignInvoice | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<SppReceiptData | null>(null);
  const [processing, setProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handlePayInvoice = async () => {
    if (!selectedInvoice) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/v1/parents/campaign-invoices/${selectedInvoice.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        const json = await res.json();
        setToastMessage({ type: "success", text: json.message || "Pembayaran iuran berhasil!" });
        setWalletBalance(json.new_balance);

        const updatedInv: FormattedCampaignInvoice = {
          ...selectedInvoice,
          status: "PAID",
          paid_at: new Date().toISOString(),
          bni_h2h_reference: json.bni_h2h_reference,
          receipt_qr_hash: json.receipt_qr_hash,
        };

        setInvoices((prev) => prev.map((item) => (item.id === selectedInvoice.id ? updatedInv : item)));
        setSelectedInvoice(null);
        setSelectedReceipt({
          id: updatedInv.id,
          title: updatedInv.campaign_title,
          studentName: updatedInv.student_name,
          amount: updatedInv.amount,
          paidAt: updatedInv.paid_at || new Date().toISOString(),
          bniReference: updatedInv.bni_h2h_reference || `BNI-H2H-${Date.now().toString().slice(-6)}`,
          receiptQrHash: updatedInv.receipt_qr_hash || `SNAP-QR-${updatedInv.id.slice(0, 8)}`,
          category: updatedInv.category,
        });
      } else {
        const json = await res.json();
        setToastMessage({ type: "error", text: json.message || json.error || "Gagal melakukan pembayaran." });
      }
    } catch {
      setToastMessage({ type: "error", text: "Kesalahan jaringan saat melakukan pembayaran." });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {toastMessage && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-bold shadow-sm ${
            toastMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="p-1 hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* List of Campaign Invoices Card List */}
      <div className="space-y-3">
        {invoices.length === 0 ? (
          <div className="rounded-[1.75rem] border border-portal-border bg-portal-surface p-8 text-center shadow-portal-card space-y-2">
            <Megaphone className="w-10 h-10 text-portal-muted/60 mx-auto mb-2" />
            <p className="font-bold text-sm text-portal-text">Belum Ada Iuran Kegiatan</p>
            <p className="text-xs text-portal-muted">
              Tagihan kegiatan atau ekstrakurikuler sekolah akan muncul di sini.
            </p>
          </div>
        ) : (
          invoices.map((inv) => {
            const isPaid = inv.status === "PAID";
            return (
              <div
                key={inv.id}
                className="rounded-[1.75rem] border border-portal-border bg-portal-surface p-4 sm:p-5 shadow-portal-card space-y-3"
              >
                <div className="flex items-start justify-between gap-3 border-b border-portal-border/60 pb-3">
                  <div className="min-w-0">
                    <span className="px-2 py-0.5 rounded-md bg-purple-50 text-portal-primary border border-purple-100 text-[10px] font-bold uppercase tracking-wider">
                      {inv.category}
                    </span>
                    <h3 className="font-extrabold text-sm text-portal-text mt-1 truncate">
                      {inv.campaign_title}
                    </h3>
                    <p className="text-[11px] text-portal-muted font-medium mt-0.5">
                      Siswa: <span className="text-portal-text font-bold">{inv.student_name}</span>
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm font-black text-portal-primary block">
                      {formatRupiah(inv.amount)}
                    </span>
                    <span className="text-[10px] text-portal-muted">Batas: {inv.due_date}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <div>
                    {isPaid ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 size={13} />
                        <span>Lunas</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock size={13} />
                        <span>Belum Bayar</span>
                      </span>
                    )}
                  </div>

                  <div>
                    {isPaid ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedReceipt({
                            id: inv.id,
                            title: inv.campaign_title,
                            studentName: inv.student_name,
                            amount: inv.amount,
                            paidAt: inv.paid_at || new Date().toISOString(),
                            bniReference: inv.bni_h2h_reference || `BNI-EVT-${inv.id.slice(0, 6)}`,
                            receiptQrHash: inv.receipt_qr_hash || `SNAP-QR-${inv.id.slice(0, 8)}`,
                            category: inv.category,
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
                      >
                        <QrCode size={14} />
                        <span>Kuitansi Digital</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedInvoice(inv)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-portal-primary px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 transition-opacity shadow-sm"
                      >
                        <CreditCard size={14} />
                        <span>Bayar Sekarang</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Payment Confirmation Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-portal-surface text-portal-text rounded-[1.75rem] p-6 max-w-md w-full space-y-4 border border-portal-border shadow-2xl animate-fade-in">
            <div className="flex items-start justify-between border-b border-portal-border pb-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-portal-muted font-bold">
                  Konfirmasi Pembayaran Iuran
                </p>
                <h3 className="text-sm font-extrabold text-portal-text">{selectedInvoice.campaign_title}</h3>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="p-1 text-portal-muted hover:text-portal-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-portal-surface-alt border border-portal-border space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-portal-border/60">
                <span className="text-portal-muted">Nama Siswa:</span>
                <span className="font-bold text-portal-text">{selectedInvoice.student_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-portal-border/60">
                <span className="text-portal-muted">Nominal Iuran:</span>
                <span className="font-bold text-portal-primary">{formatRupiah(selectedInvoice.amount)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-portal-border/60">
                <span className="text-portal-muted">Saldo Dompet BNI:</span>
                <span className="font-bold text-emerald-600">{formatRupiah(walletBalance)}</span>
              </div>
              <div className="flex justify-between py-1 pt-1.5 font-bold text-sm">
                <span>Sisa Saldo Setelah Bayar:</span>
                <span className={walletBalance >= selectedInvoice.amount ? "text-portal-text" : "text-red-500"}>
                  {formatRupiah(walletBalance - selectedInvoice.amount)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Metode: BNI Direct Debit (Autodebet Instan)</span>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-portal-border text-xs">
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2.5 rounded-2xl border border-portal-border font-bold text-portal-muted hover:text-portal-text"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={processing || walletBalance < selectedInvoice.amount}
                onClick={handlePayInvoice}
                className="px-4 py-2.5 rounded-2xl bg-portal-primary text-white font-bold hover:opacity-90 disabled:opacity-50 shadow-portal-glow flex items-center gap-1.5"
              >
                {processing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  "Konfirmasi Bayar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Digital Receipt Modal Component */}
      <SppPaymentSuccessModal receipt={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
    </div>
  );
}
