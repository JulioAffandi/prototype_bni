"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";
import { Bot, Send, X, Loader2 } from "lucide-react";
import EduConnectLogo from "@/components/shared/EduConnectLogo";
import { getMessageText } from "@/lib/ai/message-utils";

interface AIChatDrawerProps {
  endpoint: string;
  persona: "merchant" | "treasury" | "parent";
  triggerLabel?: string;
  initialMessage?: string;
}

const PERSONA_NAMES: Record<AIChatDrawerProps["persona"], string> = {
  merchant: "EduConnect Kantin Advisor",
  treasury: "EduConnect Treasury Advisor",
  parent: "EduConnect Family Advisor",
};

const PERSONA_HINTS: Record<AIChatDrawerProps["persona"], string[]> = {
  merchant: ["Berapa omzet hari ini?", "Stok apa yang hampir habis?", "Menu terlaris minggu ini?"],
  treasury: ["Berapa SPP yang lunas bulan ini?", "Ada dana mengendap di Giro?", "Simulasi deposito Rp400 juta"],
  parent: ["Anak saya jajan apa saja minggu ini?", "Berapa saldo Vault-nya?", "Rekomendasi alokasi tabungan"],
};

export default function AIChatDrawer({ endpoint, persona, triggerLabel }: AIChatDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { messages, input, handleInputChange, handleSubmit, setInput, isLoading, error } = useChat({
    api: endpoint,
  });

  const personaName = PERSONA_NAMES[persona];
  const hints = PERSONA_HINTS[persona];

  return (
    <>
      {/* Floating trigger button */}
      <button
        type="button"
        id="ai-chat-open-btn"
        onClick={() => setIsOpen(true)}
        aria-label="Buka AI Kantin Advisor"
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-2xl hover:bg-emerald-500 transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-emerald-400/30 md:bottom-8 md:right-8 md:h-14 md:w-14"
      >
        <Bot size={24} />
      </button>

      {/* Drawer overlay */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-card border-t border-border flex flex-col"
            style={{ height: "75vh" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <EduConnectLogo variant="icon" width={22} height={22} />
                </div>
                <div>
                  <p className="font-semibold text-sm">{personaName}</p>
                  <p className="text-xs text-primary">GPT-4o mini · Grounded AI</p>
                </div>
              </div>
              <button
                id="ai-chat-close-btn"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground text-center">
                    Halo! Saya {personaName}. Tanyakan apa saja:
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {hints.map((hint) => (
                      <button
                        key={hint}
                        id={`ai-hint-${hint.slice(0, 10)}`}
                        onClick={() => {
                          setInput(hint);
                        }}
                        className="px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                      >
                        {hint}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === "user" ? "chat-user rounded-tr-sm" : "chat-ai rounded-tl-sm"
                    }`}
                  >
                    {getMessageText(msg)}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="chat-ai rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                    <span className="text-sm text-muted-foreground">Menganalisis data...</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="text-xs text-destructive text-center">
                  Terjadi kesalahan. Coba lagi.
                </div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="p-4 border-t border-border flex items-center gap-2 shrink-0"
            >
              <input
                id="ai-chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ketik pertanyaan Anda..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-muted border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
              <button
                id="ai-chat-send-btn"
                type="submit"
                disabled={isLoading || !input.trim()}
                className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </>
      )}
    </>
  );
}
