"use client";

import { useChat } from "ai/react";
import { Bot, Send, Loader2, TrendingUp, Package, Star } from "lucide-react";

const HINTS = [
  "Berapa omzet saya minggu ini?",
  "Stok menu apa yang hampir habis?",
  "Menu terlaris bulan ini apa?",
  "Rekomendasikan bahan baku yang perlu direstok",
];

export default function MerchantAIPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/v1/ai/merchant-advisor",
  });

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold">VALO Kantin Advisor</h1>
          <p className="text-xs text-primary">GPT-4o mini · Analisis penjualan real-time</p>
        </div>
      </div>

      {/* Capability chips */}
      {messages.length === 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {[
            { label: "Omzet", icon: TrendingUp },
            { label: "Stok", icon: Package },
            { label: "Terlaris", icon: Star },
          ].map(({ label, icon: Icon }) => (
            <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-border text-xs shrink-0">
              <Icon className="w-3 h-3 text-primary" />
              <span className="text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-center">
              Halo! Saya siap membantu menganalisis performa kantin Anda. Tanyakan apa saja:
            </p>
            {HINTS.map((hint) => (
              <button
                key={hint}
                id={`merchant-ai-hint-${hint.slice(0, 12).replace(/\s/g, "-")}`}
                onClick={() =>
                  handleInputChange({ target: { value: hint } } as React.ChangeEvent<HTMLInputElement>)
                }
                className="w-full px-4 py-2.5 rounded-xl border border-border text-sm text-left text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                {hint}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center mr-2 mt-1 shrink-0">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === "user" ? "chat-user rounded-tr-sm" : "chat-ai rounded-tl-sm"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center mr-2 mt-1 shrink-0">
              <Bot className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="chat-ai rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Mengambil data penjualan...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          id="merchant-ai-input"
          value={input}
          onChange={handleInputChange}
          placeholder="Tanya tentang omzet, stok, atau menu..."
          className="flex-1 px-4 py-3 rounded-xl bg-muted border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
        />
        <button
          id="merchant-ai-send"
          type="submit"
          disabled={isLoading || !input.trim()}
          className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
