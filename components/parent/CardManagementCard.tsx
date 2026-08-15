"use client";

import { useState } from "react";
import { CreditCard, ShieldAlert, ShieldCheck, ShieldOff, AlertTriangle, Loader2 } from "lucide-react";

interface CardManagementCardProps {
  studentId: string;
  studentName: string;
  nfcUidLast4?: string | null;
  cardStatus: "active" | "lost_reported" | "blocked" | "graduated" | "transferred_out";
  onStatusUpdated?: (newStatus: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; icon: typeof CreditCard }> = {
  active:          { label: "Kartu Aktif",      badgeClass: "badge-paid",    icon: ShieldCheck },
  lost_reported:   { label: "Dilaporkan Hilang", badgeClass: "badge-failed",  icon: ShieldAlert },
  blocked:         { label: "Kartu Diblokir",   badgeClass: "badge-failed",  icon: ShieldOff },
  graduated:       { label: "Lulus",            badgeClass: "badge-offline", icon: CreditCard },
  transferred_out: { label: "Pindah",           badgeClass: "badge-offline", icon: CreditCard },
};

export default function CardManagementCard({
  studentId,
  studentName,
  nfcUidLast4 = "????",
  cardStatus: initialStatus,
  onStatusUpdated,
}: CardManagementCardProps) {
  const [status, setStatus] = useState(initialStatus);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentConfig = STATUS_CONFIG[status] ?? STATUS_CONFIG.active;
  const StatusIcon = currentConfig.icon;

  async function handleReportLost() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/students/${studentId}/card/report-lost`, {
        method: "POST",
      });

      const data = await res.json() as { status?: string; message?: string; error?: string };

      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? "Gagal melaporkan kartu hilang");
      }

      setStatus("lost_reported");
      setShowConfirm(false);
      onStatusUpdated?.("lost_reported");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-5 border border-border/60 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">Kartu NFC Pelajar</h3>
            <p className="text-xs text-muted-foreground">{studentName}</p>
          </div>
        </div>

        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${currentConfig.badgeClass}`}>
          <StatusIcon className="w-3.5 h-3.5" />
          {currentConfig.label}
        </span>
      </div>

      {/* Card Info Box */}
      <div className="p-4 rounded-xl bg-muted/60 border border-border/50 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Masked Card UID</p>
          <p className="font-mono text-lg font-bold text-foreground tracking-widest">
            •••• •••• •••• {nfcUidLast4 || "----"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-muted-foreground">Tipe Identitas</p>
          <p className="text-xs font-semibold text-primary">KTP NFC Siswa</p>
        </div>
      </div>

      {/* Actions */}
      {status === "active" ? (
        <button
          id={`report-lost-btn-${studentId}`}
          onClick={() => setShowConfirm(true)}
          className="w-full py-2.5 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-xs font-bold hover:bg-destructive/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <ShieldAlert className="w-4 h-4" />
          Laporkan Kartu Hilang / Blokir
        </button>
      ) : (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/25 text-xs text-destructive flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Kartu Telah Diberhentikan</p>
            <p className="text-destructive/80 mt-0.5">
              Seluruh transaksi kantin dengan kartu ini ditolak otomatis. Hubungi tata usaha sekolah untuk penerbitan kartu pengganti.
            </p>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-destructive/20 text-destructive flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="font-bold text-base text-foreground">Blokir Kartu NFC Siswa?</h3>
              <p className="text-xs text-muted-foreground">
                Tindakan ini akan <strong>segera memblokir</strong> kartu NFC milik <strong className="text-foreground">{studentName}</strong>. Transaksi kantin tidak dapat dilakukan hingga kartu baru diterbitkan oleh sekolah.
              </p>
            </div>

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/25 p-2.5 rounded-xl font-medium">
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl border border-border bg-background text-foreground text-xs font-semibold hover:bg-muted transition-all"
              >
                Batal
              </button>
              <button
                id="confirm-report-lost-btn"
                type="button"
                onClick={handleReportLost}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold hover:bg-destructive/90 transition-all flex items-center justify-center gap-1.5 shadow-md"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Memblokir...
                  </>
                ) : (
                  "Ya, Blokir Kartu"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
