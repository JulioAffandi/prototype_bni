"use client";

import { useState } from "react";
import { Megaphone, CheckCircle2, Clock, QrCode, ShieldCheck, Printer, X, CreditCard } from "lucide-react";

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
  const [selectedReceipt, setSelectedReceipt] = useState<FormattedCampaignInvoice | null>(null);
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
        setSelectedReceipt(updatedInv);
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
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            toastMessage.type === "success"
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-500"
              : "bg-destructive/15 border-destructive/30 text-destructive"
          }`}
        >
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="p-1 hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* List of Campaign Invoices */}
      <div className="glass rounded-2xl overflow-hidden border border-portal-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-portal-surface-alt border-b border-portal-border text-portal-muted">
              <tr>
                <th className="p-3.5 font-semibold">Nama Event / Iuran</th>
                <th className="p-3.5 font-semibold">Siswa (Anak)</th>
                <th className="p-3.5 font-semibold text-right">Nominal</th>
                <th className="p-3.5 font-semibold text-center">Batas Waktu</th>
                <th className="p-3.5 font-semibold text-center">Status</th>
                <th className="p-3.5 font-semibold text-center">Aksi / Kuitansi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-portal-border/50 text-portal-text">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-portal-muted">
                    Belum ada tagihan iuran event/kegiatan untuk anak Anda.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-portal-surface-alt/40 transition-colors">
                    <td className="p-3.5">
                      <p className="font-bold text-portal-text">{inv.campaign_title}</p>
                      <span className="px-2 py-0.5 rounded bg-portal-surface-alt border border-portal-border text-[10px] text-portal-muted font-semibold">
                        {inv.category}
                      </span>
                    </td>
                    <td className="p-3.5 font-semibold text-portal-text">{inv.student_name}</td>
                    <td className="p-3.5 text-right font-bold text-portal-primary">{formatRupiah(inv.amount)}</td>
                    <td className="p-3.5 text-center text-portal-muted">{inv.due_date}</td>
                    <td className="p-3.5 text-center">
                      {inv.status === "PAID" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>LUNAS</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                          <Clock className="w-3 h-3" />
                          <span>BELUM DIBAYAR</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      {inv.status === "PAID" ? (
                        <button
                          type="button"
                          onClick={() => setSelectedReceipt(inv)}
                          className="inline-flex items-center gap-1 rounded-portal border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Kuitansi</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedInvoice(inv)}
                          className="inline-flex items-center gap-1 rounded-portal bg-portal-primary px-3 py-1 text-[11px] font-bold text-portal-primary-foreground hover:opacity-90 transition-opacity shadow-sm"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Bayar</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Confirmation Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-portal-surface text-portal-text rounded-2xl p-6 max-w-md w-full space-y-4 border border-portal-border shadow-2xl">
            <div className="flex items-start justify-between border-b border-portal-border pb-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-portal-muted font-semibold">Konfirmasi Pembayaran Iuran</p>
                <h3 className="text-base font-bold text-portal-text">{selectedInvoice.campaign_title}</h3>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="p-1 text-portal-muted hover:text-portal-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-portal-surface-alt border border-portal-border space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-portal-border/50">
                <span className="text-portal-muted">Nama Siswa (Anak):</span>
                <span className="font-bold text-portal-text">{selectedInvoice.student_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-portal-border/50">
                <span className="text-portal-muted">Nominal Iuran:</span>
                <span className="font-bold text-portal-primary">{formatRupiah(selectedInvoice.amount)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-portal-border/50">
                <span className="text-portal-muted">Saldo Dompet BNI Saat Ini:</span>
                <span className="font-bold text-emerald-500">{formatRupiah(walletBalance)}</span>
              </div>
              <div className="flex justify-between py-1 pt-2 font-bold text-sm">
                <span>Sisa Saldo Setelah Bayar:</span>
                <span className={walletBalance >= selectedInvoice.amount ? "text-portal-text" : "text-destructive"}>
                  {formatRupiah(walletBalance - selectedInvoice.amount)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-emerald-500">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Metode Pembayaran: BNI Direct Debit (Autodebit Instan)</span>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-portal-border text-xs">
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 rounded-portal border border-portal-border font-semibold text-portal-muted hover:text-portal-text"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={processing || walletBalance < selectedInvoice.amount}
                onClick={handlePayInvoice}
                className="px-4 py-2 rounded-portal bg-portal-primary text-portal-primary-foreground font-bold hover:opacity-90 disabled:opacity-50 shadow-md"
              >
                {processing ? "Memproses..." : "Konfirmasi Bayar dari Saldo BNI"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Digital Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-portal-surface text-portal-text rounded-2xl p-6 max-w-md w-full space-y-4 border border-portal-border shadow-2xl">
            <div className="flex items-start justify-between border-b border-portal-border pb-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-portal-muted">VALO School · BNI Receipt</p>
                <h3 className="text-base font-bold text-portal-text">Kuitansi Digital Event</h3>
              </div>
              <button onClick={() => setSelectedReceipt(null)} className="p-1 text-portal-muted hover:text-portal-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-portal-surface-alt border border-portal-border text-center space-y-3">
              <div className="w-28 h-28 mx-auto bg-white p-2 rounded-xl border flex items-center justify-center">
                <div className="w-full h-full border-2 border-dashed border-portal-primary flex flex-col items-center justify-center text-[10px] text-portal-primary font-mono font-bold">
                  <QrCode className="w-12 h-12 mb-1" />
                  <span>EVENT-QR</span>
                </div>
              </div>

              <p className="text-[11px] font-mono text-portal-muted break-all">
                Hash: {selectedReceipt.receipt_qr_hash || `VALO-EVENT-${selectedReceipt.id.slice(0, 12)}`}
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-portal-border/50">
                <span className="text-portal-muted">Event / Iuran:</span>
                <span className="font-bold text-portal-text">{selectedReceipt.campaign_title}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-portal-border/50">
                <span className="text-portal-muted">Siswa:</span>
                <span className="font-bold text-portal-text">{selectedReceipt.student_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-portal-border/50">
                <span className="text-portal-muted">Nominal Dibayar:</span>
                <span className="font-bold text-portal-primary">{formatRupiah(selectedReceipt.amount)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-portal-border/50">
                <span className="text-portal-muted">Waktu Lunas:</span>
                <span className="text-portal-text">{selectedReceipt.paid_at ? new Date(selectedReceipt.paid_at).toLocaleString("id-ID") : "-"}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-emerald-500 pt-1">
              <ShieldCheck className="w-4 h-4" />
              <span>BNI H2H Ref: {selectedReceipt.bni_h2h_reference || `BNI-EVENT-${selectedReceipt.id.slice(0, 8)}`}</span>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-portal-border">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 rounded-portal border border-portal-border text-xs font-semibold text-portal-text hover:bg-portal-surface-alt transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Kuitansi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
