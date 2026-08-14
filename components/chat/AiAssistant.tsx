"use client";

import { useChat } from "ai/react";
import { useEffect, useRef, useState } from "react";
import { Bot, X, Send, Loader2, MessageCircle, Minimize2, Sparkles, ChevronDown } from "lucide-react";

/**
 * AiAssistant — Floating glassmorphic chat widget (bottom-right).
 * Compatible across all 3 VALO portals (Parent, School, Merchant).
 * The backend /api/chat resolves the AI persona dynamically from the
 * user's session roles — this component is intentionally role-agnostic.
 */
export default function AiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages } = useChat({
    api: "/api/chat",
    initialMessages: [],
    onError: (err) => {
      console.error("[AiAssistant] Chat error:", err);
    },
  });

  // Auto-scroll to latest message
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isMinimized]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, isMinimized]);

  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const unreadCount = !isOpen ? messages.filter((m) => m.role === "assistant").length : 0;

  return (
    <>
      {/* ── Floating Trigger Button ─────────────────────────────── */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          id="ai-assistant-trigger"
          aria-label="Buka VALO AI Assistant"
          className="fixed bottom-6 right-6 z-50 group w-14 h-14 rounded-full flex items-center justify-center shadow-2xl shadow-violet-950/60 transition-all duration-300 hover:scale-110 active:scale-95"
          style={{
            background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
          }}
        >
          <MessageCircle className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
              {unreadCount}
            </span>
          )}
          {/* Pulse ring on first load */}
          <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-violet-400" />
        </button>
      )}

      {/* ── Chat Widget ─────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl overflow-hidden shadow-2xl shadow-black/50"
          style={{
            height: isMinimized ? "auto" : "520px",
            background: "rgba(15, 15, 23, 0.92)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(124, 58, 237, 0.25)",
          }}
        >
          {/* ── Header ────────────────────────────────────────── */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{
              background: "linear-gradient(135deg, rgba(124,58,237,0.25) 0%, rgba(79,70,229,0.15) 100%)",
              borderBottom: "1px solid rgba(124, 58, 237, 0.2)",
            }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                   style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)" }}>
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-white leading-none">VALO AI</span>
                  <Sparkles className="w-3 h-3 text-violet-400" />
                </div>
                <span className="text-[10px] text-violet-300/70 leading-none">Assistant Ekosistem</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {!isMinimized && messages.length > 0 && (
                <button
                  onClick={handleClearChat}
                  className="text-[10px] px-2 py-1 rounded-lg text-violet-300/60 hover:text-violet-300 hover:bg-violet-500/10 transition-colors"
                >
                  Hapus
                </button>
              )}
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                aria-label={isMinimized ? "Perluas" : "Minimalkan"}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-violet-300/60 hover:text-white hover:bg-violet-500/20 transition-all"
              >
                {isMinimized ? (
                  <ChevronDown className="w-4 h-4 rotate-180" />
                ) : (
                  <Minimize2 className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={handleClose}
                aria-label="Tutup AI Assistant"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-violet-300/60 hover:text-white hover:bg-rose-500/20 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Body (collapsed when minimized) ──────────────── */}
          {!isMinimized && (
            <>
              {/* ── Messages ──────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin scrollbar-thumb-violet-900/50 scrollbar-track-transparent">
                {/* Welcome message */}
                {messages.length === 0 && (
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center"
                         style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)" }}>
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-[80%]"
                         style={{ background: "rgba(124, 58, 237, 0.15)", border: "1px solid rgba(124, 58, 237, 0.2)" }}>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        Halo! Saya <strong className="text-violet-300">VALO AI Assistant</strong>. Ada yang bisa saya bantu hari ini? 👋
                      </p>
                    </div>
                  </div>
                )}

                {/* Chat messages */}
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex items-start gap-2.5 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    {/* Avatar */}
                    {message.role === "assistant" && (
                      <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center"
                           style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)" }}>
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                    )}

                    {/* Bubble */}
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 max-w-[82%] text-xs leading-relaxed ${
                        message.role === "user"
                          ? "rounded-tr-sm text-white"
                          : "rounded-tl-sm text-slate-200"
                      }`}
                      style={
                        message.role === "user"
                          ? { background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)" }
                          : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }
                      }
                    >
                      {/* Render newlines for better readability */}
                      {message.content.split("\n").map((line, i) => (
                        <span key={i}>
                          {line}
                          {i < message.content.split("\n").length - 1 && <br />}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center"
                         style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)" }}>
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm px-4 py-3"
                         style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div className="flex gap-1.5 items-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Error state */}
                {error && (
                  <div className="rounded-xl px-3.5 py-2.5 text-xs text-rose-300"
                       style={{ background: "rgba(244, 63, 94, 0.12)", border: "1px solid rgba(244, 63, 94, 0.25)" }}>
                    ⚠️ Gagal mengirim pesan. Periksa koneksi dan coba lagi.
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* ── Input Bar ─────────────────────────────────── */}
              <form
                onSubmit={handleSubmit}
                className="shrink-0 flex items-center gap-2 px-3 py-3"
                style={{ borderTop: "1px solid rgba(124, 58, 237, 0.2)" }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Tanya sesuatu..."
                  disabled={isLoading}
                  className="flex-1 px-3.5 py-2.5 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all disabled:opacity-60"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(124, 58, 237, 0.25)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = "0 0 0 2px rgba(124,58,237,0.4)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  id="ai-send-btn"
                  aria-label="Kirim pesan"
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                  }}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 text-white" />
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
