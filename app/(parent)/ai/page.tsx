"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
import { Bot, Send, Loader2 } from "lucide-react";
import { getMessageText } from "@/lib/ai/message-utils";

const HINTS = [
  "Anak saya jajan apa saja minggu ini?",
  "Berapa saldo Vault si Akbar sekarang?",
  "Apakah pola makannya sehat?",
  "Rekomendasi alokasi tabungan ke reksa dana",
];

export default function ParentAIPage() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
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
    <div className="flex flex-col h-[calc(100vh-5rem)] p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold">VALO Family Advisor</h1>
          <p className="text-xs text-primary">GPT-4o mini · Grounded pada data nyata</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              Halo! Saya VALO Family Advisor. Saya dapat membantu Anda memahami pola jajan
              anak, memantau tabungan Vault, dan memberikan rekomendasi finansial keluarga.
            </p>
            <div className="grid grid-cols-1 gap-2">
              {HINTS.map((hint) => (
                <button
                  key={hint}
                  id={`parent-ai-hint-${hint.slice(0, 15).replace(/\s/g, "-")}`}
                  onClick={() => setInput(hint)}
                  className="px-4 py-2.5 rounded-xl border border-border text-sm text-left text-muted-foreground hover:border-primary hover:text-primary transition-colors"
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
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center mr-2 mt-1 shrink-0">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user" ? "chat-user rounded-tr-sm" : "chat-ai rounded-tl-sm"
              }`}
            >
              {getMessageText(msg)}
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
              <span className="text-sm text-muted-foreground">Menganalisis data anak Anda...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          id="parent-ai-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tanyakan tentang pengeluaran atau tabungan anak..."
          className="flex-1 px-4 py-3 rounded-xl bg-muted border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
        />
        <button
          id="parent-ai-send"
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
