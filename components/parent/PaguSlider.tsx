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

  const paguPct = Math.min(100, (currentUsed / value) * 100);

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
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
          <SlidersHorizontal className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">{studentName}</h3>
          <p className="text-xs text-muted-foreground">Pagu Jajan Harian</p>
        </div>
      </div>

      {/* Current value display */}
      <div className="text-center mb-6">
        <p className="text-3xl font-bold gradient-text">{formatRupiah(value)}</p>
        <p className="text-xs text-muted-foreground mt-1">per hari</p>
      </div>

      {/* Slider */}
      <div className="mb-4">
        <input
          id={`pagu-slider-${studentId}`}
          type="range"
          min={MIN}
          max={MAX}
          step={STEP}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, hsl(174 72% 35%) ${paguPct}%, hsl(217 32% 17%) ${paguPct}%)`,
          }}
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{formatRupiah(MIN)}</span>
          <span>{formatRupiah(MAX)}</span>
        </div>
      </div>

      {/* Preset chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {PRESET_VALUES.map((preset) => (
          <button
            key={preset}
            id={`pagu-preset-${preset}`}
            onClick={() => setValue(preset)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              value === preset
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {formatRupiah(preset)}
          </button>
        ))}
      </div>

      {/* Usage info */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/50 mb-4">
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Sisa pagu hari ini ({formatRupiah(Math.max(0, currentLimit - currentUsed))}) akan otomatis
          dipindahkan ke Student Vault pada pukul 23:59 WIB.
        </p>
      </div>

      {error && (
        <p className="text-xs text-destructive mb-3">{error}</p>
      )}

      {/* Save button */}
      <button
        id={`pagu-save-${studentId}`}
        onClick={handleSave}
        disabled={saving || value === currentLimit}
        className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
          saved
            ? "bg-primary/20 text-primary border border-primary/30"
            : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {saving ? "Menyimpan..." : saved ? "Tersimpan" : "Simpan Pagu"}
      </button>
    </div>
  );
}
