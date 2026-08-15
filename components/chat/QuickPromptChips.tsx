"use client";

import { Sparkles } from "lucide-react";

export function QuickPromptChips({
  chips,
  onSelect,
}: {
  chips: string[];
  onSelect: (prompt: string) => void;
}) {
  return (
    <div className="space-y-2 my-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-violet-300/80">
        <Sparkles className="w-3 h-3 text-violet-400" />
        <span>Pertanyaan Cepat:</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {chips.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(chip)}
            className="text-left text-xs px-3 py-2 rounded-xl bg-violet-950/30 hover:bg-violet-900/40 border border-violet-500/20 hover:border-violet-500/40 text-violet-200 transition-all active:scale-[0.98]"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
