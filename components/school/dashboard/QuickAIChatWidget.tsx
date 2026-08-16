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
        <span className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
          <Bot size={18} />
        </span>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-slate-300 flex items-center gap-1.5">
          <Sparkles size={14} className="text-amber-400" />
          <span>Pilih pertanyaan instan untuk Treasury AI:</span>
        </p>

        <div className="space-y-2">
          {presetQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedPrompt(q)}
              className={`w-full text-left text-xs p-2.5 rounded-lg border transition-all flex items-center justify-between gap-2 ${
                selectedPrompt === q
                  ? "bg-indigo-600/20 text-indigo-200 border-indigo-500/50 font-medium"
                  : "bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60"
              }`}
            >
              <span className="truncate">{q}</span>
              <Send size={12} className="shrink-0 text-slate-400" />
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
