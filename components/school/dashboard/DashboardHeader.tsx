import React from "react";
import { Building2, ShieldCheck, Download, RefreshCw } from "lucide-react";

interface DashboardHeaderProps {
  schoolName: string;
  lastUpdated?: string;
}

export function DashboardHeader({ schoolName, lastUpdated }: DashboardHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
            Executive Financial Dashboard
          </h1>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-medium">
            <ShieldCheck size={13} />
            <span>SNAP BI Active</span>
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
          <span>{schoolName}</span>
          <span className="text-slate-600">•</span>
          <span>Integrasi Rekening Giro BNI H2H</span>
          {lastUpdated && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-slate-500">Diperbarui: {lastUpdated}</span>
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <a
          href="/school/audit"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
        >
          <Building2 size={14} className="text-slate-400" />
          <span>Laporan Treasury</span>
        </a>
      </div>
    </div>
  );
}
