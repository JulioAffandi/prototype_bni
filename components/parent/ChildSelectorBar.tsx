"use client";

import React from "react";
import { User } from "lucide-react";

export interface StudentPaguItem {
  id: string;
  full_name: string;
  class_label?: string | null;
  daily_limit: number;
  daily_limit_used: number;
  emergency_approve: boolean;
  emergency_limit: number;
  emergency_used_today: boolean;
  emergency_overdraft_count_7d: number;
  nfc_uid_last4: string;
  card_status: "active" | "lost_reported" | "blocked" | "graduated" | "transferred_out";
}

interface ChildSelectorBarProps {
  students: StudentPaguItem[];
  selectedStudentId: string;
  onSelectStudent: (id: string) => void;
}

function formatShortRupiah(amount: number) {
  if (amount >= 1000) {
    return `${Math.floor(amount / 1000)}rb`;
  }
  return `Rp ${amount}`;
}

export default function ChildSelectorBar({
  students,
  selectedStudentId,
  onSelectStudent,
}: ChildSelectorBarProps) {
  if (!students || students.length === 0) return null;

  return (
    <div className="sticky top-0 z-20 -mx-4 px-4 py-2.5 bg-background/95 backdrop-blur-md border-b border-border/40 shadow-sm transition-all mb-4">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
        {students.map((st) => {
          const isSelected = st.id === selectedStudentId;
          const sisaPagu = Math.max(0, st.daily_limit - st.daily_limit_used);
          const classText = st.class_label ? ` • ${st.class_label}` : "";

          return (
            <button
              key={st.id}
              id={`child-selector-pill-${st.id}`}
              type="button"
              onClick={() => onSelectStudent(st.id)}
              className={`flex-1 min-w-[140px] max-w-[240px] flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs transition-all duration-200 ${
                isSelected
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/30 font-semibold ring-2 ring-emerald-400/40"
                  : "bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 hover:text-white border border-slate-700/50"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <div
                  className={`w-6.5 h-6.5 rounded-full flex items-center justify-center shrink-0 ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-slate-700 text-slate-300"
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="text-left truncate">
                  <p className="truncate font-semibold leading-tight">
                    {st.full_name}
                    <span className="opacity-80 font-normal">{classText}</span>
                  </p>
                </div>
              </div>

              {/* Limit badge */}
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium shrink-0 ${
                  isSelected
                    ? "bg-emerald-700/80 text-emerald-100 border border-emerald-400/30"
                    : "bg-slate-900/80 text-emerald-400 border border-slate-700"
                }`}
              >
                Sisa {formatShortRupiah(sisaPagu)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
