"use client";

import { useState } from "react";
import { X, Sparkles, Megaphone, Users, Calendar, DollarSign, CheckCircle2 } from "lucide-react";

interface CreateCampaignModalProps {
  schoolId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateCampaignModal({
  schoolId,
  onClose,
  onSuccess,
}: CreateCampaignModalProps) {
  const [title, setTitle] = useState("Iuran Peringatan HUT RI ke-81");
  const [category, setCategory] = useState<"KEGIATAN" | "BUKU" | "SERAGAM" | "LAINNYA">("KEGIATAN");
  const [amount, setAmount] = useState<number>(50000);
  const [dueDate, setDueDate] = useState("2026-08-31");
  const [targetScope, setTargetScope] = useState<"ALL" | "GRADE_LEVEL">("ALL");
  const [targetGrade, setTargetGrade] = useState<number>(7);
  const [description, setDescription] = useState("Iuran partisipasi kegiatan lomba dan panggung gembira HUT RI.");
  const [processing, setProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);

    const payload = {
      title,
      category,
      amount,
      due_date: dueDate,
      target_scope: targetScope,
      target_filter: targetScope === "GRADE_LEVEL" ? { grade_level: targetGrade } : {},
      description,
      is_mandatory: true,
    };

    try {
      const res = await fetch(`/api/v1/schools/${schoolId}/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (res.ok && json.invoices_created > 0) {
        setToastMessage({
          type: "success",
          text: `Berhasil membuat event dan menerbitkan tagihan ke ${json.invoices_created} siswa.`,
        });
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else if (res.ok) {
        setToastMessage({
          type: "error",
          text: json.warning || "Kampanye dibuat, namun tidak ada siswa yang ditemukan di sekolah ini.",
        });
      } else {
        setToastMessage({ type: "error", text: json.detail || json.error || "Gagal menerbitkan event." });
      }
    } catch {
      setToastMessage({ type: "error", text: "Kesalahan jaringan saat menerbitkan event." });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-portal-surface text-portal-text rounded-2xl p-6 max-w-lg w-full space-y-4 border border-portal-border shadow-2xl relative">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-portal-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-portal-primary/15 flex items-center justify-center text-portal-primary">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-portal-text">Buat Event &amp; Iuran Baru</h3>
              <p className="text-xs text-portal-muted">Penerbitan tagihan massal &amp; notifikasi in-app ke orang tua</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-portal-muted hover:text-portal-text">
            <X className="w-5 h-5" />
          </button>
        </div>

        {toastMessage && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              toastMessage.type === "success"
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-500 font-semibold"
                : "bg-destructive/15 border-destructive/30 text-destructive font-semibold"
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="text-portal-muted font-semibold">Judul Event / Tagihan:</label>
            <input
              type="text"
              required
              placeholder="e.g. Iuran Peringatan HUT RI ke-81"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-2 text-portal-text font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-portal-muted font-semibold">Kategori Tagihan:</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-2 text-portal-text font-semibold"
              >
                <option value="KEGIATAN">KEGIATAN (Event/Lomba/HUT)</option>
                <option value="BUKU">BUKU (Paket Buku / Modul)</option>
                <option value="SERAGAM">SERAGAM (Paket Olahraga/Seragam)</option>
                <option value="LAINNYA">LAINNYA (Uang Gedung/Study Tour)</option>
              </select>
            </div>

            <div>
              <label className="text-portal-muted font-semibold">Nominal per Siswa (IDR):</label>
              <input
                type="number"
                required
                min={1000}
                step={5000}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-2 text-portal-text font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-portal-muted font-semibold">Batas Waktu Pembayaran (Due Date):</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-2 text-portal-text font-semibold"
              />
            </div>

            <div>
              <label className="text-portal-muted font-semibold">Target Siswa:</label>
              <select
                value={targetScope}
                onChange={(e) => setTargetScope(e.target.value as any)}
                className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-2 text-portal-text font-semibold"
              >
                <option value="ALL">Semua Siswa Terdaftar</option>
                <option value="GRADE_LEVEL">Spesifik Tingkat Kelas</option>
              </select>
            </div>
          </div>

          {targetScope === "GRADE_LEVEL" && (
            <div>
              <label className="text-portal-muted font-semibold">Pilih Tingkat Kelas:</label>
              <select
                value={targetGrade}
                onChange={(e) => setTargetGrade(Number(e.target.value))}
                className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-2 text-portal-text font-semibold"
              >
                <option value={7}>Kelas 7</option>
                <option value={8}>Kelas 8</option>
                <option value={9}>Kelas 9</option>
                <option value={10}>Kelas 10</option>
                <option value={11}>Kelas 11</option>
                <option value={12}>Kelas 12</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-portal-muted font-semibold">Deskripsi / Catatan Event:</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-2 text-portal-text"
            />
          </div>

          {/* Live Preview Box */}
          <div className="p-3.5 rounded-xl bg-portal-surface-alt border border-portal-primary/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-portal-primary" />
              <div>
                <p className="font-bold text-portal-text">Estimasi Target Penerbitan:</p>
                <p className="text-[11px] text-portal-muted">
                  Tagihan &amp; notifikasi akan otomatis dikirim ke seluruh wali murid {targetScope === "ALL" ? "semua kelas" : `kelas ${targetGrade}`}.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-portal-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-portal border border-portal-border text-xs font-semibold text-portal-muted hover:text-portal-text"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={processing}
              className="px-5 py-2 rounded-portal bg-portal-primary text-portal-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity"
            >
              {processing ? "Menerbitkan Tagihan..." : "Terbitkan Event & Send Notif"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
