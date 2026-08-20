"use client";

import React, { useState } from "react";
import { DashboardCard } from "./DashboardCard";
import { Bot, Sparkles, Send } from "lucide-react";
import AIChatDrawer from "@/components/canteen/AIChatDrawer";

interface QuickAIChatWidgetProps {
  presetQuestions?: string[];
}

export function QuickAIChatWidget({
  presetQuestions = [
    "Berapa proyeksi arus kas sekolah bulan depan?",
    "Apakah ada unit operasional yang over budget?",
    "Bagaimana tren pelunasan SPP 3 bulan terakhir?",
    "Rekomendasi optimasi kas giro BNI H2H",
  ],
}: QuickAIChatWidgetProps) {
  const [selectedPrompt, setSelectedPrompt] = useState<string>("");

  return (
    <DashboardCard
      title="Treasury AI Assistant"
      subtitle="Konsultasi cepat proyeksi kas & risiko keuangan sekolah"
      headerSlot={
        <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
          <Bot size={18} />
        </span>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
          <Sparkles size={14} className="text-amber-500" />
          <span>Pilih pertanyaan instan untuk Treasury AI:</span>
        </p>

        <div className="space-y-2">
          {presetQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedPrompt(q)}
              className={`w-full text-left text-xs p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                selectedPrompt === q
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200 font-bold shadow-xs"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/40 hover:text-indigo-900 font-medium"
              }`}
            >
              <span className="truncate">{q}</span>
              <Send size={12} className={`shrink-0 ${selectedPrompt === q ? "text-indigo-600" : "text-slate-400"}`} />
            </button>
          ))}
        </div>

        <div className="pt-2 flex justify-end">
          <AIChatDrawer
            endpoint="/api/v1/ai/treasury-advisor"
            persona="treasury"
            triggerLabel="Buka Chat Treasury AI"
            initialMessage={selectedPrompt || undefined}
          />
        </div>
      </div>
    </DashboardCard>
  );
}
