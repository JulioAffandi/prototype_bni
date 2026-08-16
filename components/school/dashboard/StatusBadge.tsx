import React from "react";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const normalized = status.toUpperCase();

  let styleClass = "bg-slate-800 text-slate-300 border border-slate-700";

  switch (normalized) {
    case "SETTLED":
    case "PAID":
    case "SUCCESS":
      styleClass = "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30";
      break;
    case "DISBURSED":
      styleClass = "bg-blue-500/15 text-blue-400 border border-blue-500/30";
      break;
    case "PENDING":
    case "SUBMITTED":
    case "UNDER_REVIEW":
    case "ATTENTION":
      styleClass = "bg-amber-500/15 text-amber-400 border border-amber-500/30";
      break;
    case "FAILED":
    case "OVERDUE":
    case "CRITICAL":
    case "REJECTED":
      styleClass = "bg-rose-500/15 text-rose-400 border border-rose-500/30";
      break;
    case "INFO":
    case "INFORMATION":
      styleClass = "bg-sky-500/15 text-sky-400 border border-sky-500/30";
      break;
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${styleClass} ${className}`}>
      {status}
    </span>
  );
}
