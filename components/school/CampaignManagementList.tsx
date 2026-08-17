"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  Megaphone,
  PencilLine,
  Plus,
  Target,
  Trash2,
  XCircle,
} from "lucide-react";
import EditCampaignModal from "./EditCampaignModal";

export interface CampaignWithStats {
  id: string;
  school_id: string;
  title: string;
  category: string;
  amount: number;
  due_date: string;
  target_scope: string;
  target_filter: Record<string, unknown> | null;
  description: string | null;
  status: string;
  created_at: string;
  stats: {
    totalStudents: number;
    paidStudents: number;
    totalCollected: number;
    targetAmount: number;
    progressPct: number;
  };
}

interface CampaignManagementListProps {
  schoolId: string;
  refreshKey: number;
  onCreate: () => void;
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function targetLabel(campaign: CampaignWithStats) {
  if (campaign.target_scope === "GRADE_LEVEL") {
    return `Kelas ${String(campaign.target_filter?.grade_level ?? "tertentu")}`;
  }
  if (campaign.target_scope === "CLASS_GROUP") {
    return `Rombel ${String(campaign.target_filter?.class_group ?? "tertentu")}`;
  }
  return "Semua Siswa";
}

export default function CampaignManagementList({
  schoolId,
  refreshKey,
  onCreate,
}: CampaignManagementListProps) {
  const [campaigns, setCampaigns] = useState<CampaignWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<CampaignWithStats | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/schools/${schoolId}/campaigns`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || result.error || "Gagal memuat campaign.");
      setCampaigns(result.campaigns ?? []);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Gagal memuat campaign." });
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns, refreshKey]);

  async function updateStatus(campaign: CampaignWithStats) {
    setActionId(campaign.id);
    try {
      const response = await fetch(`/api/v1/schools/${schoolId}/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || result.error || "Gagal menutup event.");
      setNotice({ type: "success", text: "Event berhasil ditutup." });
      await loadCampaigns();
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Gagal menutup event." });
    } finally {
      setActionId(null);
    }
  }

  async function deleteCampaign(campaign: CampaignWithStats) {
    const confirmed = window.confirm(
      `Hapus event "${campaign.title}"? Invoice yang belum dibayar akan dihapus. Histori pembayaran yang sudah lunas tetap dipertahankan.`
    );
    if (!confirmed) return;

    setActionId(campaign.id);
    try {
      const response = await fetch(`/api/v1/schools/${schoolId}/campaigns/${campaign.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || result.error || "Gagal menghapus event.");
      setNotice({ type: "success", text: result.message || "Event berhasil dihapus." });
      await loadCampaigns();
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Gagal menghapus event." });
    } finally {
      setActionId(null);
    }
  }

  function handleEditSuccess(message: string) {
    setEditingCampaign(null);
    setNotice({ type: "success", text: message });
    void loadCampaigns();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-portal-border bg-portal-surface-alt/40 p-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-portal-text">
            <Megaphone className="h-5 w-5 text-portal-primary" />
            Daftar Event &amp; Iuran Kegiatan
          </h2>
          <p className="mt-1 text-xs text-portal-muted">Pantau realisasi, perbarui detail, atau selesaikan campaign sekolah.</p>
        </div>
        <button type="button" onClick={onCreate} className="inline-flex items-center justify-center gap-2 rounded-portal bg-portal-primary px-4 py-2 text-xs font-bold text-portal-primary-foreground">
          <Plus className="h-4 w-4" /> Buat Event Baru
        </button>
      </div>

      {notice && (
        <div className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold ${notice.type === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
          {notice.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          <span>{notice.text}</span>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-48 items-center justify-center rounded-2xl border border-portal-border bg-portal-surface">
          <Loader2 className="h-6 w-6 animate-spin text-portal-primary" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-portal-border bg-portal-surface p-10 text-center">
          <Megaphone className="mx-auto h-9 w-9 text-portal-muted/50" />
          <p className="mt-3 font-bold text-portal-text">Belum ada event atau iuran kegiatan.</p>
          <p className="mt-1 text-xs text-portal-muted">Buat campaign pertama untuk menerbitkan tagihan massal.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {campaigns.map((campaign) => {
            const isActive = campaign.status === "ACTIVE";
            const isProcessing = actionId === campaign.id;
            return (
              <article key={campaign.id} className="overflow-hidden rounded-2xl border border-portal-border bg-portal-surface shadow-sm">
                <div className="border-b border-portal-border bg-portal-surface-alt/50 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-portal-primary/25 bg-portal-primary/10 px-2 py-0.5 text-[10px] font-bold text-portal-primary">{campaign.category}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${isActive ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : "border-portal-border bg-portal-surface-alt text-portal-muted"}`}>{isActive ? "AKTIF" : "SELESAI"}</span>
                      </div>
                      <h3 className="text-base font-bold text-portal-text">{campaign.title}</h3>
                      {campaign.description && <p className="mt-1 line-clamp-2 text-xs text-portal-muted">{campaign.description}</p>}
                    </div>
                    <div className="rounded-xl bg-portal-primary/10 p-2.5 text-portal-primary"><Megaphone className="h-5 w-5" /></div>
                  </div>
                </div>

                <div className="space-y-5 p-5">
                  <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                    <div><p className="flex items-center gap-1.5 text-portal-muted"><CircleDollarSign className="h-3.5 w-3.5" /> Nominal / siswa</p><p className="mt-1 font-bold text-portal-text">{formatRupiah(Number(campaign.amount))}</p></div>
                    <div><p className="flex items-center gap-1.5 text-portal-muted"><CalendarDays className="h-3.5 w-3.5" /> Jatuh tempo</p><p className="mt-1 font-bold text-portal-text">{new Date(`${campaign.due_date}T00:00:00`).toLocaleDateString("id-ID")}</p></div>
                    <div><p className="flex items-center gap-1.5 text-portal-muted"><Target className="h-3.5 w-3.5" /> Target</p><p className="mt-1 font-bold text-portal-text">{targetLabel(campaign)}</p></div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-end justify-between gap-3">
                      <div><p className="text-xs font-semibold text-portal-muted">Realisasi Pelunasan</p><p className="text-lg font-black text-portal-text">{campaign.stats.progressPct}%</p></div>
                      <p className="text-right text-[11px] text-portal-muted">{campaign.stats.paidStudents}/{campaign.stats.totalStudents} siswa lunas</p>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-portal-surface-alt">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500" style={{ width: `${Math.min(campaign.stats.progressPct, 100)}%` }} />
                    </div>
                    <p className="text-xs text-portal-muted">Terkumpul: <span className="font-bold text-emerald-500">{formatRupiah(campaign.stats.totalCollected)}</span> dari {formatRupiah(campaign.stats.targetAmount)}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 border-t border-portal-border pt-4">
                    <button type="button" onClick={() => setEditingCampaign(campaign)} className="inline-flex items-center gap-1.5 rounded-portal border border-portal-border px-3 py-1.5 text-[11px] font-semibold text-portal-text hover:bg-portal-surface-alt"><PencilLine className="h-3.5 w-3.5" /> Edit Event</button>
                    {isActive && <button type="button" disabled={isProcessing} onClick={() => void updateStatus(campaign)} className="inline-flex items-center gap-1.5 rounded-portal border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-500 disabled:opacity-50"><XCircle className="h-3.5 w-3.5" /> Tutup Event</button>}
                    <button type="button" disabled={isProcessing} onClick={() => void deleteCampaign(campaign)} className="inline-flex items-center gap-1.5 rounded-portal border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-[11px] font-semibold text-destructive disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Hapus Event</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editingCampaign && (
        <EditCampaignModal schoolId={schoolId} campaign={editingCampaign} onClose={() => setEditingCampaign(null)} onSuccess={handleEditSuccess} />
      )}
    </div>
  );
}
