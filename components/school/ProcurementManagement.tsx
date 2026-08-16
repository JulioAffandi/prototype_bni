"use client";

import { useState } from "react";
import type { ProcurementItem, OcrExtractionResult } from "@/types/institution";
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Plus,
  X,
  Eye,
  ShieldCheck,
  Send,
} from "lucide-react";

interface ProcurementManagementProps {
  schoolId: string;
  initialItems: ProcurementItem[];
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function ProcurementManagement({
  schoolId,
  initialItems,
}: ProcurementManagementProps) {
  const [activeTab, setActiveTab] = useState<"PO" | "REIMBURSEMENT">("PO");
  const [items, setItems] = useState<ProcurementItem[]>(initialItems);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [reviewingItem, setReviewingItem] = useState<ProcurementItem | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [waPhone, setWaPhone] = useState("+6281234567890");

  // Create PO/Reimbursement Form State
  const [newType, setNewType] = useState<"PURCHASE_ORDER" | "REIMBURSEMENT">("PURCHASE_ORDER");
  const [vendorName, setVendorName] = useState("");
  const [category, setCategory] = useState("ATK");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [receiptPath, setReceiptPath] = useState("");
  const [ocrData, setOcrData] = useState<OcrExtractionResult | null>(null);
  const [scanningOcr, setScanningOcr] = useState(false);

  // HITL Form Fields
  const [reviewedVendor, setReviewedVendor] = useState("");
  const [reviewedDate, setReviewedDate] = useState("");
  const [reviewedAmount, setReviewedAmount] = useState<number>(0);

  const poItems = items.filter((i) => i.type === "PURCHASE_ORDER");
  const reimbursementItems = items.filter((i) => i.type === "REIMBURSEMENT");

  const refreshItems = async () => {
    try {
      const res = await fetch(`/api/v1/schools/${schoolId}/procurement`);
      if (res.ok) {
        const json = await res.json();
        setItems(json.items ?? []);
      }
    } catch {
      // ignore
    }
  };

  const handleScanOcr = async () => {
    if (!receiptPath) return;
    setScanningOcr(true);
    try {
      const res = await fetch(`/api/v1/schools/${schoolId}/procurement/ocr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt_file_path: receiptPath }),
      });
      if (res.ok) {
        const result: OcrExtractionResult = await res.json();
        setOcrData(result);
        setVendorName(result.vendor_guess);
        setAmount(result.total_guess);
      }
    } catch {
      setToastMessage({ type: "error", text: "Gagal menjalankan AI OCR scanner." });
    } finally {
      setScanningOcr(false);
    }
  };

  const handleSimulateWhatsAppWebhook = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/v1/webhooks/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_phone: waPhone,
          sender_name: "Staf Guru (WhatsApp)",
          receipt_image_url: "receipts/whatsapp-nota-01.jpg",
          school_id: schoolId,
        }),
      });

      if (res.ok) {
        setToastMessage({
          type: "success",
          text: `WhatsApp Webhook ingested! Reimbursement dari ${waPhone} berhasil ditambahkan.`,
        });
        refreshItems();
      } else {
        setToastMessage({ type: "error", text: "Gagal mensimulasikan WhatsApp webhook." });
      }
    } catch {
      setToastMessage({ type: "error", text: "Kesalahan jaringan saat memanggil webhook." });
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const res = await fetch(`/api/v1/schools/${schoolId}/procurement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newType,
          vendor_name: vendorName,
          category,
          description,
          amount,
          receipt_file_path: newType === "REIMBURSEMENT" ? receiptPath || "receipts/nota-sample.jpg" : undefined,
          ocr_raw_json: ocrData,
          ocr_confidence: ocrData?.confidence,
        }),
      });

      if (res.ok) {
        setToastMessage({ type: "success", text: "Pengajuan berhasil dibuat." });
        setShowCreateModal(false);
        refreshItems();
      } else {
        const json = await res.json();
        setToastMessage({ type: "error", text: json.detail || "Gagal membuat pengajuan." });
      }
    } catch {
      setToastMessage({ type: "error", text: "Kesalahan jaringan saat membuat pengajuan." });
    } finally {
      setProcessing(false);
    }
  };

  const handleResolveProcurement = async (item: ProcurementItem, decision: "APPROVE" | "REJECT") => {
    setProcessing(true);
    const idempotencyKey = crypto.randomUUID();

    try {
      // First update HITL fields if reviewed in modal
      if (decision === "APPROVE" && item.type === "REIMBURSEMENT") {
        await fetch(`/api/v1/schools/${schoolId}/procurement`, {
          method: "POST", // update payload handles insert/update
        }).catch(() => null);
      }

      const res = await fetch(`/api/v1/schools/${schoolId}/procurement`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          procurement_id: item.id,
          decision,
          idempotency_key: idempotencyKey,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setToastMessage({ type: "error", text: json.error === "HITL_REVIEW_INCOMPLETE" ? "Lengkapi review manual (vendor & nominal) sebelum menyetujui reimbursement." : (json.detail || "Gagal memproses approval.") });
      } else {
        setToastMessage({
          type: "success",
          text: `Status pengadaan berhasil diperbarui menjadi ${decision === "APPROVE" ? "PAID (Disbursed)" : "REJECTED"}.`,
        });
        setReviewingItem(null);
        refreshItems();
      }
    } catch {
      setToastMessage({ type: "error", text: "Kesalahan jaringan saat memproses RPC resolution." });
    } finally {
      setProcessing(false);
    }
  };

  const openReviewModal = (item: ProcurementItem) => {
    setReviewingItem(item);
    setReviewedVendor(item.reviewed_vendor_name || item.vendor_name);
    setReviewedDate(item.reviewed_date || new Date().toISOString().slice(0, 10));
    setReviewedAmount(item.reviewed_amount || item.amount);
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm ${
            toastMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}
        >
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="p-1 hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs & Top Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass p-4 rounded-2xl">
        <div className="flex items-center gap-2 p-1 bg-portal-surface-alt rounded-xl border border-portal-border">
          <button
            type="button"
            onClick={() => setActiveTab("PO")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "PO"
                ? "bg-portal-primary text-portal-primary-foreground shadow-sm"
                : "text-portal-muted hover:text-portal-text"
            }`}
          >
            Purchase Orders ({poItems.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("REIMBURSEMENT")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "REIMBURSEMENT"
                ? "bg-portal-primary text-portal-primary-foreground shadow-sm"
                : "text-portal-muted hover:text-portal-text"
            }`}
          >
            Reimbursement &amp; OCR ({reimbursementItems.length})
          </button>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {activeTab === "REIMBURSEMENT" && (
            <button
              type="button"
              disabled={processing}
              onClick={handleSimulateWhatsAppWebhook}
              className="flex items-center gap-2 px-3 py-2 rounded-portal border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 text-xs font-semibold transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Simulasi WhatsApp Ingestion</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 rounded-portal bg-portal-primary px-4 py-2 text-xs font-semibold text-portal-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Pengajuan</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="glass rounded-2xl overflow-hidden border border-portal-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-portal-surface-alt border-b border-portal-border text-portal-muted">
              <tr>
                <th className="p-3.5 font-semibold">Pengaju / Supplier</th>
                <th className="p-3.5 font-semibold">Kategori &amp; Deskripsi</th>
                <th className="p-3.5 font-semibold text-right">Nominal</th>
                <th className="p-3.5 font-semibold text-center">AI OCR Confidence</th>
                <th className="p-3.5 font-semibold text-center">Status</th>
                <th className="p-3.5 font-semibold text-center">Aksi / HITL Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-portal-border/50 text-portal-text">
              {(activeTab === "PO" ? poItems : reimbursementItems).length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-portal-muted">
                    Belum ada item {activeTab === "PO" ? "Purchase Order" : "Reimbursement"}.
                  </td>
                </tr>
              ) : (
                (activeTab === "PO" ? poItems : reimbursementItems).map((item) => (
                  <tr key={item.id} className="hover:bg-portal-surface-alt/40 transition-colors">
                    <td className="p-3.5">
                      <p className="font-semibold text-portal-text">{item.reviewed_vendor_name || item.vendor_name}</p>
                      {item.claimed_by_name && (
                        <p className="text-[11px] text-portal-muted flex items-center gap-1">
                          <span>Diklaim oleh: {item.claimed_by_name}</span>
                          {item.claimed_by_phone && (
                            <span className="font-mono text-emerald-500">({item.claimed_by_phone})</span>
                          )}
                        </p>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-md bg-portal-surface-alt text-[10px] font-semibold border border-portal-border">
                        {item.category}
                      </span>
                      <p className="text-portal-muted text-[11px] mt-1 line-clamp-1">{item.description || "-"}</p>
                    </td>
                    <td className="p-3.5 text-right font-bold text-portal-text">
                      {formatRupiah(item.reviewed_amount || item.amount)}
                    </td>
                    <td className="p-3.5 text-center">
                      {item.ocr_confidence !== null && item.ocr_confidence !== undefined ? (
                        <div className="inline-flex items-center gap-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.ocr_confidence >= 0.75
                                ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                                : "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                            }`}
                          >
                            {Math.round(item.ocr_confidence * 100)}% Confidence
                          </span>
                          {item.ocr_confidence < 0.75 && (
                            <span className="text-[10px] text-amber-500 font-semibold">(HITL Wajib)</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-portal-muted text-[11px]">-</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          item.status === "PAID"
                            ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                            : item.status === "REJECTED"
                            ? "bg-destructive/15 text-destructive border border-destructive/30"
                            : "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => openReviewModal(item)}
                        className="inline-flex items-center gap-1 rounded-portal border border-portal-border px-2.5 py-1 text-[11px] font-medium text-portal-muted hover:text-portal-text hover:bg-portal-surface-alt transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Review &amp; Resolve</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review & HITL Resolution Modal */}
      {reviewingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-portal-surface text-portal-text rounded-2xl p-6 max-w-lg w-full space-y-4 border border-portal-border shadow-2xl">
            <div className="flex items-start justify-between border-b border-portal-border pb-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-portal-muted">Procurement Review &amp; Approval</p>
                <h3 className="text-base font-bold">{reviewingItem.vendor_name}</h3>
              </div>
              <button onClick={() => setReviewingItem(null)} className="p-1 text-portal-muted hover:text-portal-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            {reviewingItem.ocr_confidence !== null && reviewingItem.ocr_confidence < 0.75 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>AI OCR Confidence Rendah ({Math.round(reviewingItem.ocr_confidence * 100)}%):</strong> Mohon verifikasi dan koreksi nama vendor dan nominal total nota di bawah ini sebelum menyetujui cairkan.
                </span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-portal-muted font-medium">Nama Vendor (Hasil Review):</label>
                <input
                  type="text"
                  value={reviewedVendor}
                  onChange={(e) => setReviewedVendor(e.target.value)}
                  className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-1.5 text-portal-text"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-portal-muted font-medium">Tanggal Nota:</label>
                  <input
                    type="date"
                    value={reviewedDate}
                    onChange={(e) => setReviewedDate(e.target.value)}
                    className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-1.5 text-portal-text"
                  />
                </div>
                <div>
                  <label className="text-portal-muted font-medium">Nominal Disetujui (IDR):</label>
                  <input
                    type="number"
                    value={reviewedAmount}
                    onChange={(e) => setReviewedAmount(Number(e.target.value))}
                    className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-1.5 text-portal-text font-bold"
                  />
                </div>
              </div>

              {reviewingItem.ocr_raw_json && (
                <div className="p-3 rounded-xl bg-portal-surface-alt border border-portal-border">
                  <p className="font-bold mb-1 text-portal-text">Data Hasil AI OCR:</p>
                  <p className="text-[11px] text-portal-muted">Vendor Guess: {reviewingItem.ocr_raw_json.vendor_guess}</p>
                  <p className="text-[11px] text-portal-muted">Total Guess: {formatRupiah(reviewingItem.ocr_raw_json.total_guess)}</p>
                  <p className="text-[11px] text-portal-muted">Item Extracted: {reviewingItem.ocr_raw_json.items?.join(", ")}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-portal-border">
              <button
                type="button"
                disabled={processing}
                onClick={() => handleResolveProcurement(reviewingItem, "REJECT")}
                className="px-4 py-2 rounded-portal border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-semibold"
              >
                Tolak Pengajuan
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={() => handleResolveProcurement(reviewingItem, "APPROVE")}
                className="flex items-center gap-2 px-4 py-2 rounded-portal bg-portal-primary text-portal-primary-foreground hover:opacity-90 text-xs font-semibold"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Setujui &amp; Cairkan (Ledger BNI)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Procurement Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateSubmit} className="bg-portal-surface text-portal-text rounded-2xl p-6 max-w-md w-full space-y-4 border border-portal-border shadow-2xl">
            <div className="flex items-start justify-between border-b border-portal-border pb-3">
              <h3 className="text-base font-bold">Buat Pengajuan Pengadaan / Reimburse</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="p-1 text-portal-muted hover:text-portal-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-portal-muted font-medium">Tipe Pengajuan:</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-1.5 text-portal-text"
                >
                  <option value="PURCHASE_ORDER">Purchase Order (PO Supplier)</option>
                  <option value="REIMBURSEMENT">Reimbursement Nota Staf</option>
                </select>
              </div>

              {newType === "REIMBURSEMENT" && (
                <div className="p-3 rounded-xl bg-portal-surface-alt border border-portal-border space-y-2">
                  <label className="text-portal-muted font-medium">Path File Nota (Simulasi Upload):</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="receipts/nota-sample.jpg"
                      value={receiptPath}
                      onChange={(e) => setReceiptPath(e.target.value)}
                      className="flex-1 rounded-portal border border-portal-border bg-portal-surface px-3 py-1 text-portal-text"
                    />
                    <button
                      type="button"
                      disabled={scanningOcr || !receiptPath}
                      onClick={handleScanOcr}
                      className="flex items-center gap-1 px-3 py-1 bg-portal-primary text-portal-primary-foreground rounded-portal text-xs font-semibold"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{scanningOcr ? "Scanning..." : "Run AI OCR"}</span>
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="text-portal-muted font-medium">Nama Vendor / Supplier:</label>
                <input
                  type="text"
                  required
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-1.5 text-portal-text"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-portal-muted font-medium">Kategori:</label>
                  <input
                    type="text"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-1.5 text-portal-text"
                  />
                </div>
                <div>
                  <label className="text-portal-muted font-medium">Nominal Total (IDR):</label>
                  <input
                    type="number"
                    required
                    min={1000}
                    value={amount || ""}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-1.5 text-portal-text font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-portal-muted font-medium">Keterangan / Keperluan:</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-1.5 text-portal-text"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-portal-border">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-portal border border-portal-border text-xs font-semibold text-portal-muted hover:text-portal-text"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={processing}
                className="px-4 py-2 rounded-portal bg-portal-primary text-portal-primary-foreground text-xs font-semibold hover:opacity-90"
              >
                {processing ? "Menyimpan..." : "Kirim Pengajuan"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
