"use client";

import { useState, useCallback } from "react";
import { SlidersHorizontal, Info } from "lucide-react";

interface PaguSliderProps {
  studentId: string;
  studentName: string;
  currentLimit: number;
  currentUsed: number;
  onUpdate?: (newLimit: number) => void;
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

const PRESET_VALUES = [10000, 15000, 20000, 25000, 30000, 50000];
const MIN = 5000;
const MAX = 200000;
const STEP = 1000;

export default function PaguSlider({
  studentId,
  studentName,
  currentLimit,
  currentUsed,
  onUpdate,
}: PaguSliderProps) {
  const [value, setValue] = useState(currentLimit);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Top Section Progress Bar: actual usage vs current limit
  const usagePct = Math.min(100, (currentUsed / Math.max(1, currentLimit)) * 100);
  const sisaPagu = Math.max(0, currentLimit - currentUsed);

  // Bottom Section Slider Fill: target limit relative to range [MIN, MAX]
  const sliderFillPct = Math.min(100, Math.max(0, ((value - MIN) / (MAX - MIN)) * 100));

  const hasChanged = value !== currentLimit;

  const handleSave = useCallback(async () => {
    if (value === currentLimit) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/students/${studentId}/pagu`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_limit: value }),
      });

      if (!res.ok) {
        const data = await res.json() as { message?: string };
        throw new Error(data.message ?? "Gagal menyimpan pagu");
      }

      onUpdate?.(value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  }, [studentId, value, currentLimit, onUpdate]);

  return (
    <div className="glass rounded-2xl p-5 space-y-6 border border-border/60">
      {/* Component Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
            <SlidersHorizontal className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">{studentName}</h3>
            <p className="text-xs text-muted-foreground">Monitoring &amp; Pengaturan Pagu Jajan</p>
          </div>
        </div>
      </div>

      {/* 1. TOP SECTION — Penggunaan Hari Ini (Usage Progress Bar) */}
      <div className="bg-muted/50 border border-border/60 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-muted-foreground uppercase tracking-wider">
            Penggunaan Hari Ini
          </span>
          <span className="font-bold text-foreground">
            Terpakai: <span className="text-primary">{formatRupiah(currentUsed)}</span> dari {formatRupiah(currentLimit)}
          </span>
        </div>

        {/* Dedicated Usage Progress Bar */}
        <div className="h-3 w-full bg-muted rounded-full overflow-hidden border border-border/40 p-0.5">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-500 shadow-sm"
            style={{ width: `${usagePct}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs pt-1">
          <span className="text-muted-foreground font-medium">Sisa Pagu Hari Ini:</span>
          <span className="font-bold text-emerald-500">{formatRupiah(sisaPagu)}</span>
        </div>
      </div>

      {/* 2. BOTTOM SECTION — Atur Batas Pagu Harian (Interactive Slider) */}
      <div className="space-y-4 pt-1">
        <div className="flex items-center justify-between">
          <label htmlFor={`pagu-slider-${studentId}`} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Atur Batas Pagu Harian
          </label>
          {hasChanged && (
            <span className="text-[11px] text-amber-500 font-semibold bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
              Belum Disimpan
            </span>
          )}
        </div>

        {/* Display target value */}
        <div className="text-center bg-background border border-border/80 rounded-xl py-3 shadow-sm">
          <p className="text-xs text-muted-foreground mb-0.5">Batas Pagu Baru</p>
          <p className="text-3xl font-extrabold text-primary">
            {formatRupiah(value)}{" "}
            <span className="text-xs font-medium text-muted-foreground">/ hari</span>
          </p>
        </div>

        {/* Interactive Slider */}
        <div className="space-y-1.5">
          <input
            id={`pagu-slider-${studentId}`}
            type="range"
            min={MIN}
            max={MAX}
            step={STEP}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="w-full h-2.5 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-inner"
            style={{
              background: `linear-gradient(to right, hsl(174 72% 35%) ${sliderFillPct}%, hsl(217 32% 17%) ${sliderFillPct}%)`,
            }}
          />
          <div className="flex justify-between text-xs text-muted-foreground font-mono font-medium">
            <span>{formatRupiah(MIN)}</span>
            <span>{formatRupiah(MAX)}</span>
          </div>
        </div>

        {/* Preset chips */}
        <div className="flex flex-wrap gap-2 pt-1">
          {PRESET_VALUES.map((preset) => (
            <button
              key={preset}
              id={`pagu-preset-${preset}`}
              type="button"
              onClick={() => setValue(preset)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                value === preset
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border/80 bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {formatRupiah(preset)}
            </button>
          ))}
        </div>
      </div>

      {/* Usage Info */}
      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-muted/60 border border-border/50 text-xs text-muted-foreground">
        <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <p>
          Sisa pagu hari ini ({formatRupiah(sisaPagu)}) akan otomatis
          dipindahkan ke Student Vault pada pukul 23:59 WIB.
        </p>
      </div>

      {error && (
        <p className="text-xs text-destructive font-medium bg-destructive/10 border border-destructive/25 p-2.5 rounded-xl">{error}</p>
      )}

      {/* Save Button */}
      <button
        id={`pagu-save-${studentId}`}
        onClick={handleSave}
        disabled={saving || !hasChanged}
        className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
          saved
            ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/40"
            : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md active:scale-[0.98]"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {saving ? "Menyimpan..." : saved ? "Tersimpan!" : "Simpan Pagu Baru"}
      </button>
    </div>
  );
}
