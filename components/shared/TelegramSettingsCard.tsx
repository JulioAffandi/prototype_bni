"use client";

import React, { useState, useEffect } from "react";
import { Send, CheckCircle2, AlertTriangle, XCircle, HelpCircle, RefreshCw, Unlink, ShieldCheck } from "lucide-react";

interface TelegramSettingsCardProps {
  role: "parent" | "merchant" | "school";
}

interface FailureInfo {
  consecutive_failures: number;
  last_error_code: number | null;
  last_attempt_at: string;
}

const CHAT_ID_RE = /^-?\d{5,15}$/;

export default function TelegramSettingsCard({ role }: TelegramSettingsCardProps) {
  const [chatId, setChatId] = useState("");
  const [savedChatId, setSavedChatId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [failure, setFailure] = useState<FailureInfo | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/telegram/link");
      const data = await res.json();
      if (res.ok) {
        setIsConnected(data.connected);
        setSavedChatId(data.chat_id);
        setChatId(data.chat_id || "");
        setFailure(data.failure);
      }
    } catch {
      setFeedback({ type: "error", message: "Gagal memuat status koneksi Telegram." });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setFeedback(null);
    const trimmed = chatId.trim();
    if (trimmed && !CHAT_ID_RE.test(trimmed)) {
      setFeedback({
        type: "error",
        message: "ID Telegram tidak valid. Format yang benar adalah angka 5–15 digit.",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/v1/telegram/link", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: trimmed }),
      });
      const data = await res.json();

      if (res.ok) {
        setIsConnected(data.connected);
        setSavedChatId(data.chat_id);
        setFailure(null);
        setFeedback({
          type: "success",
          message: data.connected
            ? "ID Telegram berhasil disimpan dan terhubung!"
            : "Koneksi Telegram berhasil dilepas.",
        });
      } else {
        setFeedback({ type: "error", message: data.error || "Gagal menyimpan Chat ID Telegram." });
      }
    } catch {
      setFeedback({ type: "error", message: "Terjadi kesalahan jaringan." });
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlink() {
    setChatId("");
    setFeedback(null);
    setSaving(true);
    try {
      const res = await fetch("/api/v1/telegram/link", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: "" }),
      });
      const data = await res.json();

      if (res.ok) {
        setIsConnected(false);
        setSavedChatId(null);
        setFailure(null);
        setFeedback({ type: "success", message: "Koneksi Telegram berhasil dilepas." });
      } else {
        setFeedback({ type: "error", message: data.error || "Gagal melepas koneksi Telegram." });
      }
    } catch {
      setFeedback({ type: "error", message: "Terjadi kesalahan jaringan." });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestMessage() {
    setFeedback(null);
    setTesting(true);
    try {
      const res = await fetch("/api/v1/telegram/test", { method: "POST" });
      const data = await res.json();

      if (res.ok && data.sent) {
        setFeedback({
          type: "success",
          message: "Pesan uji coba berhasil terkirim! Silakan periksa obrolan Telegram Anda.",
        });
        setFailure(null);
      } else if (data.code === 403) {
        setFeedback({
          type: "error",
          message: "Bot diblokir atau obrolan tidak ditemukan. Silakan buka bot di Telegram, tekan /start, lalu simpan ulang Chat ID Anda.",
        });
        setFailure({
          consecutive_failures: (failure?.consecutive_failures || 0) + 1,
          last_error_code: 403,
          last_attempt_at: new Date().toISOString(),
        });
      } else {
        setFeedback({
          type: "error",
          message: `Gagal mengirim pesan uji coba: ${data.error || "Unknown error"}`,
        });
      }
    } catch {
      setFeedback({ type: "error", message: "Terjadi kesalahan koneksi saat mengirim pesan uji coba." });
    } finally {
      setTesting(false);
    }
  }

  const roleLabels = {
    parent: "Orang Tua / Wali",
    merchant: "Pengelola Kantin",
    school: "Administrator Sekolah",
  };

  return (
    <div className="bg-card text-card-foreground border border-border rounded-xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center font-bold text-xl">
            ✈️
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Integrasi Notifikasi Telegram</h3>
            <p className="text-sm text-muted-foreground">
              Terima notifikasi real-time transaksi & aktivitas untuk {roleLabels[role]}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Memuat status...
          </div>
        ) : failure && failure.last_error_code === 403 ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
            <XCircle className="w-3.5 h-3.5" /> Connection Broken (Bot Diblokir)
          </span>
        ) : isConnected ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Terhubung ✅
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
            Belum Terhubung
          </span>
        )}
      </div>

      {/* Warning banner if failures exist */}
      {failure && failure.last_error_code === 403 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 rounded-lg text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-medium">Pengiriman pesan Telegram gagal (HTTP 403 Forbidden)</p>
            <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-0.5">
              Pesan tidak dapat terkirim karena bot VALO diblokir atau obrolan terhapus. Silakan cari bot Telegram VALO, kirim perintah <code className="bg-amber-500/20 px-1 py-0.5 rounded text-amber-900 dark:text-amber-100 font-mono">/start</code>, kemudian simpan ulang Chat ID.
            </p>
          </div>
        </div>
      )}

      {/* Feedback Toast Banner */}
      {feedback && (
        <div
          className={`p-3 rounded-lg text-sm flex items-center justify-between gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
              : "bg-destructive/10 border border-destructive/20 text-destructive"
          }`}
        >
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs opacity-70 hover:opacity-100 font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Form Input */}
      <div className="space-y-3">
        <label htmlFor="telegram-chat-id" className="block text-sm font-medium text-foreground">
          Telegram Chat ID
        </label>
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          <input
            id="telegram-chat-id"
            type="text"
            placeholder="Contoh: 123456789"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            disabled={loading || saving}
            className="flex-1 px-3.5 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={loading || saving || chatId.trim() === savedChatId}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-primary text-primary-foreground font-medium text-sm rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Menyimpan...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> Simpan Chat ID
                </>
              )}
            </button>
            {isConnected && (
              <button
                onClick={handleUnlink}
                disabled={loading || saving}
                className="px-3.5 py-2.5 border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 font-medium text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                title="Putuskan koneksi Telegram"
              >
                <Unlink className="w-4 h-4" />
                <span className="sr-only sm:not-sr-only">Putuskan</span>
              </button>
            )}
          </div>
        </div>

        {/* Test button & help toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="text-xs text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-medium"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            {showInstructions ? "Sembunyikan Panduan" : "Cara Mendapatkan Chat ID Telegram?"}
          </button>

          {isConnected && (
            <button
              onClick={handleTestMessage}
              disabled={testing || loading}
              className="px-3.5 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/20 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {testing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Mengirim Uji Coba...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" /> Kirim Pesan Uji Coba
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Guide Box */}
      {showInstructions && (
        <div className="p-4 bg-muted/50 border border-border rounded-xl text-xs space-y-2 text-muted-foreground">
          <p className="font-semibold text-foreground text-sm">Langkah Mudah Mendapatkan Chat ID:</p>
          <ol className="list-decimal list-inside space-y-1.5 pl-1">
            <li>
              Buka aplikasi Telegram dan cari bot bernama <code className="bg-background px-1.5 py-0.5 rounded border border-border text-foreground font-mono">@userinfobot</code> atau bot resmi VALO.
            </li>
            <li>
              Klik <strong>Start</strong> atau kirim pesan apa saja ke bot tersebut.
            </li>
            <li>
              Bot akan membalas dengan info akun Anda. Salin angka pada kolom <strong>Id</strong> (contoh: <code className="bg-background px-1.5 py-0.5 rounded border border-border text-foreground font-mono">123456789</code>).
            </li>
            <li>
              Tempelkan angka Chat ID tersebut pada kolom input di atas lalu klik <strong>Simpan Chat ID</strong>.
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
