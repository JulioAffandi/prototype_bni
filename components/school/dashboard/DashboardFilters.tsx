"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Calendar, Filter } from "lucide-react";

interface DashboardFiltersProps {
  academicYears: string[];
  currentAy: string;
  currentRange: string;
}

export function DashboardFilters({
  academicYears,
  currentAy,
  currentRange,
}: DashboardFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleAyChange = (ay: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("ay", ay);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleRangeChange = (range: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", range);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--color-fin-card)] border border-[var(--color-fin-card-border)] rounded-[var(--radius-fin)] p-3">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Filter size={14} className="text-[var(--color-fin-primary)]" />
        <span className="font-semibold text-slate-200">Filter Analisis:</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Academic Year Selector */}
        <div className="flex items-center gap-1.5 text-xs">
          <Calendar size={14} className="text-slate-400" />
          <span className="text-slate-400 hidden sm:inline">Tahun Ajaran:</span>
          <select
            value={currentAy}
            onChange={(e) => handleAyChange(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-100 rounded-md px-2.5 py-1 text-xs font-medium focus:outline-none focus:border-[var(--color-fin-primary)] cursor-pointer"
          >
            {academicYears.map((ay) => (
              <option key={ay} value={ay}>
                {ay}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-md p-0.5 text-xs font-medium">
          {[
            { id: "7d", label: "7 Hari" },
            { id: "30d", label: "30 Hari" },
            { id: "3m", label: "3 Bulan" },
            { id: "12m", label: "1 Tahun" },
          ].map((r) => {
            const active = currentRange === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => handleRangeChange(r.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  active
                    ? "bg-[var(--color-fin-primary)] text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
