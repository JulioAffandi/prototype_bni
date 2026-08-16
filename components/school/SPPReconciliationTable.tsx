"use client";

import { useState } from "react";
import type { FeeCategory } from "@/types/institution";
import CreateCampaignModal from "./CreateCampaignModal";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  QrCode,
  ShieldCheck,
  Printer,
  X,
  Search,
  Plus,
  Megaphone,
} from "lucide-react";

interface FormattedInvoice {
  id: string;
  student_id: string;
  period: string;
  amount: number;
  status: string;
  due_date: string;
  paid_at: string | null;
  retry_count: number;
  bni_h2h_reference: string | null;
  fee_category_id: string;
  receipt_qr_hash: string | null;
  student_name: string;
  category_label: string;
  category_code: string;
}

interface SPPReconciliationTableProps {
  schoolId: string;
  initialPeriod: string;
  availablePeriods: string[];
  initialInvoices: FormattedInvoice[];
  feeCategories: FeeCategory[];
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function SPPReconciliationTable({
  schoolId,
  initialPeriod,
  availablePeriods,
  initialInvoices,
  feeCategories,
}: SPPReconciliationTableProps) {
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod);
  const [selectedCategoryCode, setSelectedCategoryCode] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState<FormattedInvoice | null>(null);
  const [showCampaignModal, setShowCampaignModal] = useState(false);

  const filteredInvoices = initialInvoices.filter((inv) => {
    const matchesPeriod = inv.period === selectedPeriod;
    const matchesCategory = selectedCategoryCode === "ALL" || inv.category_code === selectedCategoryCode;
    const matchesSearch =
      inv.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.category_label.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPeriod && matchesCategory && matchesSearch;
  });

  const paidTotal = filteredInvoices
    .filter((inv) => inv.status === "PAID")
    .reduce((sum, inv) => sum + inv.amount, 0);

  const unpaidTotal = filteredInvoices
    .filter((inv) => inv.status !== "PAID")
    .reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <div className="space-y-6">
      {/* Category Tabs & Filter Bar */}
      <div className="glass p-5 rounded-2xl space-y-4 border border-portal-border">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedCategoryCode("ALL")}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategoryCode === "ALL"
                ? "bg-portal-primary text-portal-primary-foreground shadow-sm"
                : "bg-portal-surface-alt text-portal-muted hover:text-portal-text border border-portal-border"
            }`}
          >
            Semua Kategori Fee
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategoryCode("SPP_BULANAN")}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategoryCode === "SPP_BULANAN"
                ? "bg-portal-primary text-portal-primary-foreground shadow-sm"
                : "bg-portal-surface-alt text-portal-muted hover:text-portal-text border border-portal-border"
            }`}
          >
            SPP Bulanan
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategoryCode("UANG_GEDUNG")}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategoryCode === "UANG_GEDUNG"
                ? "bg-portal-primary text-portal-primary-foreground shadow-sm"
                : "bg-portal-surface-alt text-portal-muted hover:text-portal-text border border-portal-border"
            }`}
          >
            Uang Gedung
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategoryCode("SERAGAM")}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategoryCode === "SERAGAM"
                ? "bg-portal-primary text-portal-primary-foreground shadow-sm"
                : "bg-portal-surface-alt text-portal-muted hover:text-portal-text border border-portal-border"
            }`}
          >
            Seragam Sekolah
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategoryCode("KEGIATAN")}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategoryCode === "KEGIATAN"
                ? "bg-portal-primary text-portal-primary-foreground shadow-sm"
                : "bg-portal-surface-alt text-portal-muted hover:text-portal-text border border-portal-border"
            }`}
          >
            Kegiatan &amp; Ekskul
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-portal-border">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <label className="text-xs font-semibold text-portal-muted">Periode:</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="rounded-portal border border-portal-border bg-portal-surface px-3 py-1.5 text-xs text-portal-text focus:outline-none focus:ring-2 focus:ring-portal-primary font-bold"
            >
              {availablePeriods.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-portal-muted absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari siswa atau tagihan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-portal border border-portal-border bg-portal-surface text-xs text-portal-text placeholder:text-portal-muted focus:outline-none focus:ring-2 focus:ring-portal-primary"
              />
            </div>

            <button
              type="button"
              id="btn-create-event-campaign"
              onClick={() => setShowCampaignModal(true)}
              className="flex items-center justify-center gap-1.5 rounded-portal bg-portal-primary px-3.5 py-1.5 text-xs font-bold text-portal-primary-foreground hover:opacity-90 whitespace-nowrap shadow-sm transition-opacity"
            >
              <Plus className="w-4 h-4" />
              <span>+ Buat Event / Iuran Baru</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass p-4 rounded-2xl border border-portal-border flex items-center justify-between">
          <div>
            <p className="text-xs text-portal-muted">Total Tertagih ({selectedPeriod})</p>
            <p className="text-xl font-bold text-emerald-500">{formatRupiah(paidTotal)}</p>
          </div>
          <CheckCircle2 className="w-8 h-8 text-emerald-500/30" />
        </div>

        <div className="glass p-4 rounded-2xl border border-portal-border flex items-center justify-between">
          <div>
            <p className="text-xs text-portal-muted">Belum Lunas / Overdue</p>
            <p className="text-xl font-bold text-amber-500">{formatRupiah(unpaidTotal)}</p>
          </div>
          <Clock className="w-8 h-8 text-amber-500/30" />
        </div>
      </div>

      {/* Reconciliation Table */}
      <div className="glass rounded-2xl overflow-hidden border border-portal-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-portal-surface-alt border-b border-portal-border text-portal-muted">
              <tr>
                <th className="p-3.5 font-semibold">Siswa &amp; NISN</th>
                <th className="p-3.5 font-semibold">Kategori Fee</th>
                <th className="p-3.5 font-semibold text-right">Nominal</th>
                <th className="p-3.5 font-semibold text-center">Jatuh Tempo</th>
                <th className="p-3.5 font-semibold text-center">Status</th>
                <th className="p-3.5 font-semibold text-center">Kuitansi Digital</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-portal-border/50 text-portal-text">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-portal-muted">
                    Tidak ada tagihan yang sesuai dengan filter filter.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((item) => (
                  <tr key={item.id} className="hover:bg-portal-surface-alt/40 transition-colors">
                    <td className="p-3.5">
                      <p className="font-semibold text-portal-text">{item.student_name}</p>
                      <p className="text-[11px] font-mono text-portal-muted">Period {item.period}</p>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-0.5 rounded-md bg-portal-surface-alt border border-portal-border text-[11px] font-semibold text-portal-text">
                        {item.category_label}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-bold text-portal-text">{formatRupiah(item.amount)}</td>
                    <td className="p-3.5 text-center text-portal-muted">{item.due_date}</td>
                    <td className="p-3.5 text-center">
                      {item.status === "PAID" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>PAID</span>
                        </span>
                      ) : item.status === "UNPAID" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                          <Clock className="w-3 h-3" />
                          <span>UNPAID</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-destructive/15 text-destructive border border-destructive/30">
                          <AlertTriangle className="w-3 h-3" />
                          <span>FAILED</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      {item.status === "PAID" ? (
                        <button
                          type="button"
                          onClick={() => setSelectedReceipt(item)}
                          className="inline-flex items-center gap-1 rounded-portal border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Kuitansi QR</span>
                        </button>
                      ) : (
                        <span className="text-portal-muted text-[11px]">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Digital Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-portal-surface text-portal-text rounded-2xl p-6 max-w-md w-full space-y-4 border border-portal-border shadow-2xl">
            <div className="flex items-start justify-between border-b border-portal-border pb-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-portal-muted">VALO School · BNI H2H Receipt</p>
                <h3 className="text-base font-bold text-portal-text">Kuitansi Pembayaran Digital</h3>
              </div>
              <button onClick={() => setSelectedReceipt(null)} className="p-1 text-portal-muted hover:text-portal-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-portal-surface-alt border border-portal-border text-center space-y-3">
              <div className="w-28 h-28 mx-auto bg-white p-2 rounded-xl border flex items-center justify-center">
                {/* Visual QR Code representation */}
                <div className="w-full h-full border-2 border-dashed border-portal-primary flex flex-col items-center justify-center text-[10px] text-portal-primary font-mono font-bold">
                  <QrCode className="w-12 h-12 mb-1" />
                  <span>BNI-H2H-QR</span>
                </div>
              </div>

              <p className="text-[11px] font-mono text-portal-muted break-all">
                Hash: {selectedReceipt.receipt_qr_hash || `VALO-RECEIPT-${selectedReceipt.id.slice(0, 12)}`}
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-portal-border/50">
                <span className="text-portal-muted">Nama Siswa:</span>
                <span className="font-bold text-portal-text">{selectedReceipt.student_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-portal-border/50">
                <span className="text-portal-muted">Kategori Tagihan:</span>
                <span className="font-semibold text-portal-text">{selectedReceipt.category_label}</span>
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
              <span>Verified SNAP BI BNI Reference: {selectedReceipt.bni_h2h_reference || `H2H-REF-${selectedReceipt.id.slice(0, 8)}`}</span>
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

      {showCampaignModal && (
        <CreateCampaignModal
          schoolId={schoolId}
          onClose={() => setShowCampaignModal(false)}
          onSuccess={() => window.location.reload()}
        />
      )}
    </div>
  );
}
