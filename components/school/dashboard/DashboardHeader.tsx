import React from "react";
import { Building2, ShieldCheck, Download, RefreshCw } from "lucide-react";

interface DashboardHeaderProps {
  schoolName: string;
  lastUpdated?: string;
}

export function DashboardHeader({ schoolName, lastUpdated }: DashboardHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
            Executive Financial Dashboard
          </h1>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
            <ShieldCheck size={13} className="text-emerald-600" />
            <span>SNAP BI Active</span>
          </span>
        </div>
        <p className="text-xs text-slate-500 font-medium mt-1 flex flex-wrap items-center gap-2">
          <span className="text-slate-700 font-semibold">{schoolName}</span>
          <span className="text-slate-300">•</span>
          <span>Integrasi Rekening Giro BNI H2H</span>
          {lastUpdated && (
            <>
              <span className="text-slate-300">•</span>
              <span className="text-slate-400">Diperbarui: {lastUpdated}</span>
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <a
          href="/school/audit"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-semibold border border-slate-200 shadow-xs transition-all"
        >
          <Building2 size={14} className="text-slate-500" />
          <span>Laporan Treasury</span>
        </a>
      </div>
    </div>
  );
}
