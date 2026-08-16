'use client';

import { useState, useEffect } from 'react';
import { Bot, X, Send, Sparkles } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from "ai";
import { getMessageText } from "@/lib/ai/message-utils";

export default function AiAssistant({ persona = 'parent' }: { persona?: string }) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: { persona },
    }),
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  if (!mounted) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const textToSend = input.trim();
    setInput('');
    sendMessage({ text: textToSend });
  };

  return (
    <>
      {/* Floating Trigger Button in Bottom-Right */}
      <button
        type="button"
        id="parent-ai-chat-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Buka Asisten AI"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl hover:bg-emerald-500 transition-all hover:scale-105 focus:outline-none focus:ring-4 focus:ring-emerald-400/30"
      >
        {isOpen ? <X size={24} /> : <Bot size={28} />}
      </button>

      {/* Slide-over Drawer / Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden flex flex-col h-[520px] transition-all">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Asisten AI VALO</p>
                <p className="text-[10px] text-slate-400">Konsultasi Pagu, SPP & Kantin</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
            {messages.length === 0 && (
              <div className="text-center text-slate-400 py-8">
                <Bot className="mx-auto mb-2 text-emerald-500 opacity-60" size={32} />
                <p>Halo! Ada yang bisa saya bantu terkait saldo, pagu jajan anak, atau tagihan SPP?</p>
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 ${
                    m.role === 'user'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-200 border border-slate-700'
                  }`}
                >
                  {getMessageText(m)}
                </div>
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSubmit} className="border-t border-slate-800 p-3 bg-slate-950 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tanyakan sesuatu..."
              className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
