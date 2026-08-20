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
    <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-2xl p-3 shadow-xs">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Filter size={14} className="text-indigo-600" />
        <span className="font-bold text-slate-800">Filter Analisis:</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Academic Year Selector */}
        <div className="flex items-center gap-1.5 text-xs">
          <Calendar size={14} className="text-slate-400" />
          <span className="text-slate-500 font-medium hidden sm:inline">Tahun Ajaran:</span>
          <select
            value={currentAy}
            onChange={(e) => handleAyChange(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer transition-colors shadow-xs"
          >
            {academicYears.map((ay) => (
              <option key={ay} value={ay}>
                {ay}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center bg-slate-100 border border-slate-200/80 rounded-xl p-1 text-xs font-medium">
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
                className={`px-3 py-1 rounded-lg text-xs transition-all ${
                  active
                    ? "bg-white text-indigo-700 font-bold shadow-xs border border-slate-200/60"
                    : "text-slate-600 hover:text-slate-900 font-medium"
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
