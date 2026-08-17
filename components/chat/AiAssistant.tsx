'use client';

import { useState, useEffect } from 'react';
import { Bot, X, Send, Sparkles } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import EduConnectLogo from '@/components/shared/EduConnectLogo';

export default function AiAssistant({ persona = 'parent' }: { persona?: string }) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { messages, input, handleInputChange, handleSubmit, setInput, isLoading } = useChat({
    api: '/api/chat',
    body: { persona },
  });

  if (!mounted) return null;

  return (
    <>
      {/* Floating Trigger Button in Bottom-Right */}
      <button
        type="button"
        id="parent-ai-chat-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Buka Asisten AI EduConnect"
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-portal-primary text-white shadow-portal-glow hover:opacity-95 transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-portal-primary/30 md:bottom-8 md:right-8 md:h-14 md:w-14"
      >
        {isOpen ? <X size={22} /> : <Bot size={24} />}
      </button>

      {/* Slide-over Drawer / Chat Window */}
      {isOpen && (
        <div className="fixed bottom-[140px] right-3 left-3 sm:left-auto sm:right-4 z-50 sm:w-96 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-portal-border bg-portal-surface shadow-2xl overflow-hidden flex flex-col h-[480px] max-h-[65vh] transition-all md:bottom-24 md:right-8">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-portal-border bg-portal-surface-alt px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-portal-primary/10 border border-portal-primary/20">
                <EduConnectLogo variant="icon" width={22} height={22} />
              </div>
              <div>
                <p className="text-xs font-bold text-portal-text">Asisten AI EduConnect</p>
                <p className="text-[10px] text-portal-muted font-medium">Konsultasi Pagu, SPP &amp; Kantin</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-portal-muted hover:bg-portal-surface hover:text-portal-text transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs bg-portal-bg/50">
            {messages.length === 0 && (
              <div className="text-center text-portal-muted py-8 px-4 space-y-2">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-portal-primary/10 flex items-center justify-center text-portal-primary mb-2">
                  <Bot size={28} />
                </div>
                <p className="font-bold text-portal-text text-sm">Halo Ayah / Bunda!</p>
                <p className="text-xs leading-relaxed text-portal-muted">
                  Selamat datang di EduConnect. Ada yang bisa saya bantu terkait saldo, pagu jajan harian anak, atau tagihan SPP?
                </p>
              </div>
            )}
            {messages.map((m) => {
              const content =
                typeof m.content === 'string' && m.content.length > 0
                  ? m.content
                  : (m.parts?.map((p: any) => p.text).join('') || '');
              return (
                <div
                  key={m.id}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 leading-relaxed shadow-sm ${
                      m.role === 'user'
                        ? 'bg-portal-primary text-white font-medium rounded-br-none'
                        : 'bg-portal-surface text-portal-text border border-portal-border rounded-bl-none'
                    }`}
                  >
                    {content}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSubmit} className="border-t border-portal-border p-3 bg-portal-surface flex gap-2">
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Tanyakan sesuatu..."
              className="flex-1 rounded-xl border border-portal-border bg-portal-surface-alt px-3.5 py-2 text-xs text-portal-text placeholder-portal-muted focus:border-portal-primary focus:outline-none focus:ring-1 focus:ring-portal-primary"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="rounded-xl bg-portal-primary px-3.5 py-2 text-white hover:opacity-90 disabled:opacity-40 transition-opacity shadow-sm flex items-center justify-center"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
