"use client";

import { useState } from "react";
import {
  UserCheck,
  Mail,
  Phone,
  CreditCard,
  Send,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  User,
  LogOut,
  Building2,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
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

export default function ParentProfileClient({
  user,
  parent,
  linkedStudents,
}: ParentProfileProps) {
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

      const data = (await res.json()) as {
        success?: boolean;
        message?: string;
        error?: string;
        detail?: string;
      };

      if (!res.ok) {
        throw new Error(
          data.message || data.error || data.detail || "Gagal memperbarui profil Orang Tua"
        );
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
    <div className="space-y-4">
      {/* 1. Identity Header Card */}
      <div className="rounded-[1.75rem] border border-portal-border bg-portal-surface p-5 sm:p-6 shadow-portal-card space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-portal-primary text-xl font-black shadow-sm">
              {fullName.charAt(0).toUpperCase() || "W"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-portal-text">{fullName || "Wali Siswa"}</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-50 border border-purple-100 text-portal-primary text-[10px] font-bold">
                  Wali Siswa
                </span>
              </div>
              <p className="text-xs text-portal-muted mt-0.5">{user.email}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-portal-muted">
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <Phone className="w-3 h-3 text-portal-primary" /> {phoneNumber || "-"}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" /> Terverifikasi BNI
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            id="parent-logout-header-btn"
            onClick={() => handleLogout("/login")}
            className="px-3.5 py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-all text-xs font-bold flex items-center gap-1.5 self-stretch sm:self-auto justify-center"
          >
            <LogOut size={14} />
            <span>Keluar Akun</span>
          </button>
        </div>
      </div>

      {/* 2. Linked Children List */}
      <div className="rounded-[1.75rem] border border-portal-border bg-portal-surface p-4 sm:p-5 shadow-portal-card space-y-3">
        <div className="flex items-center justify-between border-b border-portal-border pb-2.5">
          <div className="flex items-center gap-2">
            <UserCheck size={16} className="text-portal-primary" />
            <h3 className="text-xs font-bold text-portal-text uppercase tracking-wider">
              Siswa Terhubung ({linkedStudents.length})
            </h3>
          </div>
          <Link href="/dashboard" className="text-xs font-bold text-portal-primary hover:underline">
            + Hubungkan Siswa
          </Link>
        </div>

        {linkedStudents.length === 0 ? (
          <p className="text-xs text-portal-muted p-4 bg-portal-surface-alt rounded-2xl text-center">
            Belum ada anak terhubung. Hubungkan data siswa menggunakan NISN di Dashboard.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {linkedStudents.map((st) => (
              <Link
                key={st.id}
                href={`/profil-anak/${st.id}`}
                className="p-3.5 bg-portal-surface-alt/70 hover:bg-portal-surface-alt border border-portal-border/70 rounded-2xl space-y-1 block transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-xs text-portal-text flex items-center gap-1.5 group-hover:text-portal-primary transition-colors">
                    <User size={14} className="text-portal-primary" /> {st.full_name}
                  </p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-portal-primary">
                    {st.relationship}
                  </span>
                </div>
                <p className="text-[11px] text-portal-muted">
                  NISN: <span className="font-mono text-portal-text font-bold">{st.student_number || "-"}</span>
                </p>
                <p className="text-[11px] text-portal-muted truncate">
                  Sekolah: <span className="text-portal-text font-medium">{st.school_name}</span>
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 3. Profile & Bank Settings Form */}
      <form
        onSubmit={handleSave}
        className="rounded-[1.75rem] border border-portal-border bg-portal-surface p-5 sm:p-6 shadow-portal-card space-y-4"
      >
        <h3 className="text-xs font-bold text-portal-text uppercase tracking-wider border-b border-portal-border pb-2.5">
          Data Diri &amp; Rekening Bank BNI
        </h3>

        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-portal-text mb-1">Nama Lengkap Wali</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-2xl bg-portal-surface-alt text-portal-text border border-portal-border text-xs focus:outline-none focus:border-portal-primary font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-portal-text mb-1">Nomor WhatsApp</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-portal-muted" />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-portal-surface-alt text-portal-text border border-portal-border text-xs focus:outline-none focus:border-portal-primary font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-portal-text mb-1">
              Nomor Rekening Tabungan BNI
            </label>
            <div className="relative">
              <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-portal-muted" />
              <input
                type="text"
                value={bniAccount}
                onChange={(e) => setBniAccount(e.target.value)}
                placeholder="00023213823"
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-portal-surface-alt text-portal-text border border-portal-border text-xs font-mono focus:outline-none focus:border-portal-primary font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-portal-text mb-1">
              ID Chat Telegram (Notifikasi Real-time)
            </label>
            <div className="relative">
              <Send className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-portal-muted" />
              <input
                type="text"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                placeholder="Contoh: 123456789 (opsional)"
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-portal-surface-alt text-portal-text border border-portal-border text-xs font-mono focus:outline-none focus:border-portal-primary"
              />
            </div>
          </div>
        </div>

        {success && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>Profil berhasil disimpan!</span>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 p-3 rounded-2xl font-medium">
            {error}
          </p>
        )}

        <div className="pt-2 border-t border-portal-border flex items-center justify-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl bg-portal-primary text-white text-xs font-bold hover:opacity-95 shadow-portal-glow flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan Perubahan Profil"}
          </button>
        </div>
      </form>
    </div>
  );
}
