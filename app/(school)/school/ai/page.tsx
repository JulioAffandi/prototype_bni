"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";
import { Bot, Send, Loader2, TrendingUp, PieChart, Banknote } from "lucide-react";

const HINTS = [
  "Berapa tingkat pembayaran SPP bulan ini?",
  "Ada berapa dana mengendap di Giro BNI?",
  "Simulasikan penempatan Rp300 juta ke deposito 3 bulan",
  "Buatkan ringkasan cashflow semester ini",
];

export default function SchoolAIPage() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    api: "/api/v1/ai/treasury-advisor",
  });

  const isLoading = status === "submitted" || status === "streaming";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput("");
    sendMessage({ text });
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 2rem)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">VALO Treasury Advisor</h1>
          <p className="text-sm text-primary">GPT-4o mini · Analisis keuangan sekolah real-time</p>
        </div>
      </div>

      {/* Capability pills */}
      {messages.length === 0 && (
        <div className="flex gap-2 mb-4">
          {[
            { label: "Analisis SPP", icon: PieChart },
            { label: "Tren Giro BNI", icon: TrendingUp },
            { label: "Simulasi Deposito", icon: Banknote },
          ].map(({ label, icon: Icon }) => (
            <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-border text-sm">
              <Icon className="w-3.5 h-3.5 text-primary" />
              <span className="text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="glass rounded-2xl p-5">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Halo! Saya adalah <strong>VALO Treasury Advisor</strong>, asisten AI untuk membantu
                bendahara sekolah menganalisis cashflow, memantau tingkat pembayaran SPP, dan
                mengoptimalkan penempatan dana BNI. Semua data bersumber dari sistem VALO secara real-time.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {HINTS.map((hint) => (
                <button
                  key={hint}
                  id={`treasury-hint-${hint.slice(0, 12).replace(/\s/g, "-")}`}
                  onClick={() => setInput(hint)}
                  className="px-4 py-3 rounded-xl border border-border text-sm text-left text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const content = typeof msg.content === "string" && msg.content.length > 0
            ? msg.content
            : (msg.parts?.map((p: any) => p.text).join("") || "");
          return (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center mr-3 mt-1 shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${
                msg.role === "user" ? "chat-user rounded-tr-sm" : "chat-ai rounded-tl-sm"
              }`}>
                {content}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center mr-3 mt-1 shrink-0">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="chat-ai rounded-2xl rounded-tl-sm px-5 py-3.5 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Mengakses data keuangan sekolah...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          id="treasury-ai-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tanya tentang cashflow, SPP, atau optimalisasi dana..."
          className="flex-1 px-4 py-3 rounded-xl bg-muted border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
        />
        <button
          id="treasury-ai-send"
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
