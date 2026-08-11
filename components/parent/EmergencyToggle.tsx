"use client";

import { useState } from "react";
import {
  ShieldCheck,
  ShieldOff,
  AlertTriangle,
  Info,
  Zap,
} from "lucide-react";

interface EmergencyToggleProps {
  studentId: string;
  studentName: string;
  emergencyApprove: boolean;
  emergencyLimit: number;
  emergencyUsedToday: boolean;
  overdraftCount7d: number;
  onToggle?: (newValue: boolean) => void;
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function EmergencyToggle({
  studentId,
  studentName,
  emergencyApprove,
  emergencyLimit,
  emergencyUsedToday,
  overdraftCount7d,
  onToggle,
}: EmergencyToggleProps) {
  const [isOn, setIsOn] = useState(emergencyApprove);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFrequentOverdraft = overdraftCount7d > 2;

  async function handleToggle() {
    setSaving(true);
    setError(null);
    const newValue = !isOn;

    try {
      const res = await fetch(`/api/v1/students/${studentId}/emergency-toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emergency_approve: newValue }),
      });

      if (!res.ok) throw new Error("Gagal mengubah pengaturan darurat");

      setIsOn(newValue);
      onToggle?.(newValue);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isOn ? "bg-primary/15" : "bg-muted"}`}>
            {isOn ? (
              <ShieldCheck className="w-4 h-4 text-primary" />
            ) : (
              <ShieldOff className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-sm">Emergency Auto-Approval</h3>
            <p className="text-xs text-muted-foreground">{studentName}</p>
          </div>
        </div>

        {/* Toggle switch */}
        <button
          id={`emergency-toggle-${studentId}`}
          onClick={handleToggle}
          disabled={saving}
          aria-pressed={isOn}
          aria-label={`${isOn ? "Nonaktifkan" : "Aktifkan"} Emergency Auto-Approval`}
          className={`relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60 ${
            isOn ? "bg-primary" : "bg-muted border border-border"
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full shadow-md transition-transform duration-300 ${
              isOn ? "translate-x-6 bg-white" : "translate-x-0.5 bg-muted-foreground"
            }`}
          />
        </button>
      </div>

      {/* Status indicators */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Batas Overdraft Darurat</span>
          <span className="font-semibold">{formatRupiah(emergencyLimit)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Status Hari Ini</span>
          <span className={`font-medium ${emergencyUsedToday ? "text-accent" : "text-primary"}`}>
            {emergencyUsedToday ? "Sudah digunakan" : "Belum digunakan"}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Overdraft 7 hari</span>
          <span className={`font-medium ${isFrequentOverdraft ? "text-destructive" : "text-foreground"}`}>
            {overdraftCount7d}x
          </span>
        </div>
      </div>

      {/* Frequent overdraft warning */}
      {isFrequentOverdraft && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/25 mb-4">
          <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-destructive">Pola Overdraft Sering Terdeteksi</p>
            <p className="text-xs text-destructive/80 mt-0.5">
              Anak Anda telah menggunakan mode darurat {overdraftCount7d}x dalam 7 hari terakhir.
              Pertimbangkan menaikkan pagu harian.
            </p>
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/50">
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-accent" />
            Berlaku maks. 1x per hari — overdraft kedua otomatis ditolak.
          </p>
          <p>Ditagihkan sebagai piutang talangan yang dipotong dari pengisian pagu berikutnya.</p>
        </div>
      </div>

      {error && <p className="text-xs text-destructive mt-3">{error}</p>}
    </div>
  );
}
