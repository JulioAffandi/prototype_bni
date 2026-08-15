"use client";

import { useState } from "react";
import { UserCheck, Mail, Phone, CreditCard, Send, CheckCircle2, Loader2, ShieldCheck, User, LogOut } from "lucide-react";
import { handleLogout } from "@/lib/auth/actions";

interface LinkedStudentItem {
  id: string;
  full_name: string;
  student_number: string | null;
  school_name: string;
  card_status: string;
  relationship: string;
}

interface ParentProfileProps {
  user: {
    id: string;
    email: string;
    phone?: string;
  };
  parent: {
    id: string;
    full_name: string;
    phone_number: string;
    email: string | null;
    bni_account_number: string | null;
    bni_link_status: string;
    telegram_chat_id: string | null;
  };
  linkedStudents: LinkedStudentItem[];
}

export default function ParentProfileClient({ user, parent, linkedStudents }: ParentProfileProps) {
  const [fullName, setFullName] = useState(parent.full_name || "");
  const [phoneNumber, setPhoneNumber] = useState(parent.phone_number || "");
  const [bniAccount, setBniAccount] = useState(parent.bni_account_number || "");
  const [telegramId, setTelegramId] = useState(parent.telegram_chat_id || "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const res = await fetch("/api/v1/parents/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone_number: phoneNumber.trim(),
          bni_account_number: bniAccount.trim() || null,
          telegram_chat_id: telegramId.trim() || null,
        }),
      });

      const data = await res.json() as { success?: boolean; message?: string; error?: string; detail?: string };

      if (!res.ok) {
        throw new Error(data.message || data.error || data.detail || "Gagal memperbarui profil Orang Tua");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-5 max-w-4xl mx-auto">
      {/* Identity Card Header */}
      <div className="glass rounded-2xl p-6 border border-border/80 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center text-primary text-xl font-bold">
              {fullName.charAt(0).toUpperCase() || "W"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">{fullName}</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-[11px] font-bold">
                  Orang Tua / Wali Siswa
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="w-3.5 h-3.5 text-primary" /> {phoneNumber}
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Terverifikasi
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            id="parent-logout-header-btn"
            onClick={() => handleLogout("/login")}
            className="px-4 py-2 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all text-xs font-bold flex items-center gap-2 self-stretch sm:self-auto justify-center"
          >
            <LogOut className="w-4 h-4" />
            Keluar Akun / Ganti User
          </button>
        </div>
      </div>

      {/* Linked Children Section */}
      <div className="glass rounded-2xl p-5 space-y-3 border border-border/80 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-base text-foreground">Siswa Terhubung ({linkedStudents.length})</h2>
          </div>
          <a
            href="/dashboard"
            className="text-xs font-bold text-primary hover:underline"
          >
            + Kelola Siswa
          </a>
        </div>

        {linkedStudents.length === 0 ? (
          <p className="text-xs text-muted-foreground p-4 bg-muted/40 rounded-xl text-center">
            Belum ada anak terhubung. Hubungkan data siswa menggunakan NISN di Dashboard.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {linkedStudents.map((st) => (
              <div key={st.id} className="p-3.5 bg-muted/60 border border-border/60 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    <User className="w-4 h-4 text-primary" /> {st.full_name}
                  </p>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                    {st.relationship}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  NISN: <span className="font-mono text-foreground font-medium">{st.student_number || "-"}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Sekolah: <span className="text-foreground">{st.school_name}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSave} className="glass rounded-2xl p-6 border border-border/80 shadow-xl space-y-4">
        <h2 className="font-bold text-base text-foreground border-b border-border pb-3">
          Pengaturan Data Diri &amp; Rekening Bank BNI
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Nama Lengkap Wali</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Nomor HP WhatsApp</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Nomor Rekening Tabungan BNI</label>
            <div className="relative">
              <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={bniAccount}
                onChange={(e) => setBniAccount(e.target.value)}
                placeholder="888012345678"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              ID Chat Telegram (Notifikasi Real-Time - Opsional)
            </label>
            <div className="relative">
              <Send className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                placeholder="Contoh: 123456789 (boleh dikosongkan)"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
              />
            </div>
          </div>
        </div>

        {success && (
          <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Profil berhasil disimpan!
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 border border-destructive/25 p-3 rounded-xl font-medium">
            {error}
          </p>
        )}

        <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
          <button
            type="button"
            id="parent-logout-footer-btn"
            onClick={() => handleLogout("/login")}
            className="px-4 py-2.5 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all text-xs font-bold flex items-center gap-2 shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            Keluar Akun / Ganti User
          </button>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all shadow-md flex items-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan Perubahan Profil"}
          </button>
        </div>
      </form>
    </div>
  );
}

