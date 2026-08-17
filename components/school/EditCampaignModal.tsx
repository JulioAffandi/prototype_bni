"use client";

import { useState } from "react";
import { CheckCircle2, PencilLine, X } from "lucide-react";
import type { CampaignWithStats } from "./CampaignManagementList";

interface EditCampaignModalProps {
  schoolId: string;
  campaign: CampaignWithStats;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

type CampaignCategory = "KEGIATAN" | "BUKU" | "SERAGAM" | "LAINNYA";

export default function EditCampaignModal({
  schoolId,
  campaign,
  onClose,
  onSuccess,
}: EditCampaignModalProps) {
  const [title, setTitle] = useState(campaign.title);
  const [category, setCategory] = useState<CampaignCategory>(campaign.category as CampaignCategory);
  const [amount, setAmount] = useState(Number(campaign.amount));
  const [dueDate, setDueDate] = useState(campaign.due_date);
  const [description, setDescription] = useState(campaign.description ?? "");
  const [status, setStatus] = useState<"ACTIVE" | "CLOSED">(
    campaign.status === "CLOSED" ? "CLOSED" : "ACTIVE"
  );
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountLocked = campaign.stats.paidStudents > 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setProcessing(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/v1/schools/${schoolId}/campaigns/${campaign.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            category,
            amount,
            due_date: dueDate,
            description: description || null,
            status,
          }),
        }
      );
      const result = await response.json();

      if (!response.ok) {
        const message = result.error === "AMOUNT_LOCKED_AFTER_PAYMENT"
          ? "Nominal tidak dapat diubah karena sudah ada siswa yang membayar."
          : result.detail || result.error || "Gagal memperbarui event.";
        setError(message);
        return;
      }

      onSuccess("Perubahan event berhasil disimpan.");
    } catch {
      setError("Kesalahan jaringan saat memperbarui event.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg space-y-4 rounded-2xl border border-portal-border bg-portal-surface p-6 text-portal-text shadow-2xl">
        <div className="flex items-start justify-between border-b border-portal-border pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-portal-primary/15 text-portal-primary">
              <PencilLine className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold">Edit Event &amp; Iuran</h3>
              <p className="text-xs text-portal-muted">Perbarui detail campaign dan status penagihan.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-portal-muted hover:text-portal-text">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="font-semibold text-portal-muted">Judul Event</label>
            <input required minLength={3} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-2 font-semibold" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="font-semibold text-portal-muted">Kategori</label>
              <select value={category} onChange={(event) => setCategory(event.target.value as CampaignCategory)} className="mt-1 w-full rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-2 font-semibold">
                <option value="KEGIATAN">KEGIATAN</option>
                <option value="BUKU">BUKU</option>
                <option value="SERAGAM">SERAGAM</option>
                <option value="LAINNYA">LAINNYA</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-portal-muted">Nominal per Siswa</label>
              <input type="number" required min={1} disabled={amountLocked} value={amount} onChange={(event) => setAmount(Number(event.target.value))} className="mt-1 w-full rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-50" />
              {amountLocked && <p className="mt-1 text-[10px] text-amber-500">Terkunci karena sudah ada pembayaran.</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="font-semibold text-portal-muted">Batas Pembayaran</label>
              <input type="date" required value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1 w-full rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-2 font-semibold" />
            </div>
            <div>
              <label className="font-semibold text-portal-muted">Status Event</label>
              <select value={status} onChange={(event) => setStatus(event.target.value as "ACTIVE" | "CLOSED")} className="mt-1 w-full rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-2 font-semibold">
                <option value="ACTIVE">AKTIF</option>
                <option value="CLOSED">SELESAI</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold text-portal-muted">Deskripsi</label>
            <textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 w-full rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-2" />
          </div>

          <div className="flex justify-end gap-3 border-t border-portal-border pt-3">
            <button type="button" onClick={onClose} className="rounded-portal border border-portal-border px-4 py-2 font-semibold text-portal-muted hover:text-portal-text">Batal</button>
            <button type="submit" disabled={processing} className="inline-flex items-center gap-2 rounded-portal bg-portal-primary px-5 py-2 font-bold text-portal-primary-foreground disabled:opacity-60">
              <CheckCircle2 className="h-4 w-4" />
              {processing ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
