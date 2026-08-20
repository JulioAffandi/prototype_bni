import React from "react";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const normalized = status.toUpperCase();

  let styleClass = "bg-slate-100 text-slate-700 border border-slate-200";

  switch (normalized) {
    case "SETTLED":
    case "PAID":
    case "SUCCESS":
      styleClass = "bg-emerald-50 text-emerald-700 border border-emerald-200";
      break;
    case "DISBURSED":
      styleClass = "bg-indigo-50 text-indigo-700 border border-indigo-200";
      break;
    case "PENDING":
    case "SUBMITTED":
    case "UNDER_REVIEW":
    case "ATTENTION":
      styleClass = "bg-amber-50 text-amber-700 border border-amber-200";
      break;
    case "FAILED":
    case "OVERDUE":
    case "CRITICAL":
    case "REJECTED":
      styleClass = "bg-rose-50 text-rose-700 border border-rose-200";
      break;
    case "INFO":
    case "INFORMATION":
      styleClass = "bg-blue-50 text-blue-700 border border-blue-200";
      break;
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase ${styleClass} ${className}`}>
      {status}
    </span>
  );
}
