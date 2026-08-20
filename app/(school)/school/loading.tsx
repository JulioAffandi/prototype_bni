import React from "react";

export default function SchoolDashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="space-y-2">
          <div className="h-7 w-72 bg-slate-200 rounded-lg" />
          <div className="h-4 w-96 bg-slate-200/60 rounded" />
        </div>
        <div className="h-9 w-40 bg-slate-200 rounded-xl" />
      </div>

      {/* Filters skeleton */}
      <div className="h-12 w-full bg-white border border-slate-200/80 rounded-2xl shadow-xs" />

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-36 bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3 shadow-xs">
            <div className="flex justify-between items-center">
              <div className="h-4 w-24 bg-slate-200 rounded" />
              <div className="h-7 w-7 bg-slate-100 rounded-lg" />
            </div>
            <div className="h-7 w-32 bg-slate-200 rounded" />
            <div className="h-8 w-full bg-slate-100 rounded" />
          </div>
        ))}
      </div>

      {/* Row 2: Charts & Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 h-[340px] bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs" />
        <div className="lg:col-span-4 space-y-5">
          <div className="h-[160px] bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs" />
          <div className="h-[160px] bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs" />
        </div>
        <div className="lg:col-span-3 h-[340px] bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs" />
      </div>

      {/* Row 3: Bottom Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4 h-[300px] bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs" />
        <div className="lg:col-span-5 h-[300px] bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs" />
        <div className="lg:col-span-3 h-[300px] bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs" />
      </div>

      {/* Row 4: Recent Activity Table */}
      <div className="h-[320px] bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs" />
    </div>
  );
}
