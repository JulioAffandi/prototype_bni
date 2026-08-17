"use client";

import { useState } from "react";
import { Building2, MapPin, Loader2, CheckCircle2, AlertCircle, User, CreditCard, Hash, ShieldCheck } from "lucide-react";

interface SchoolProfileProps {
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  school: {
    id: string;
    name: string;
    npsn: string | null;
    bni_giro_account: string;
    address: string | null;
    default_daily_limit: number;
    default_emergency_limit: number;
    status: string;
  };
}

export default function SchoolProfileClient({ user, school }: SchoolProfileProps) {
  const [schoolName, setSchoolName] = useState(school.name || "");
  const [npsn, setNpsn] = useState(school.npsn || "");
  const [bniGiroAccount, setBniGiroAccount] = useState(school.bni_giro_account || "");
  const [address, setAddress] = useState(school.address || "");
  const [status, setStatus] = useState(school.status || "active");
  const [dailyLimit, setDailyLimit] = useState(school.default_daily_limit || 20000);
  const [emergencyLimit, setEmergencyLimit] = useState(school.default_emergency_limit || 15000);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/v1/schools/${school.id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_name: schoolName.trim(),
          npsn: npsn.trim() || null,
          bni_giro_account: bniGiroAccount.trim(),
          address: address.trim() || null,
          status,
          default_daily_limit: Number(dailyLimit),
          default_emergency_limit: Number(emergencyLimit),
        }),
      });

      const data = (await res.json()) as { success?: boolean; message?: string; error?: string };

      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? "Gagal memperbarui profil sekolah");
      }

      setSuccessMsg("Profil sekolah berhasil diperbarui!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan data");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header / Identity Card */}
      <div className="glass rounded-2xl p-6 border border-border/80 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-accent/20 border-2 border-accent/40 flex items-center justify-center text-accent">
              <Building2 className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">{schoolName || "Sekolah"}</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-accent text-[11px] font-bold">
                  Terdaftar di BNI EduConnect
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize border ${
                    status === "active"
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                      : status === "suspended"
                      ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                      : "bg-destructive/15 border-destructive/30 text-destructive"
                  }`}
                >
                  {status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                NPSN: <strong className="text-foreground">{npsn || "Belum diatur"}</strong> · Tenant ID:{" "}
                <span className="text-muted-foreground">{school.id.slice(0, 8)}...</span>
              </p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-mono">
                  Giro Escrow BNI: <strong className="text-foreground">{bniGiroAccount || "Belum diatur"}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications / Toast */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-semibold flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-destructive/15 border border-destructive/30 text-destructive text-sm font-semibold flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* PIC Admin Card */}
      <div className="glass rounded-2xl p-5 border border-border/80 shadow-lg space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-accent" />
            <h2 className="font-bold text-base text-foreground">Informasi PIC Admin Sekolah</h2>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-muted border border-border text-xs font-semibold text-foreground">
            School Treasury Admin
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
          <div>
            <p className="text-muted-foreground">Nama Admin:</p>
            <p className="font-bold text-foreground text-sm">{user.displayName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Email Login Admin:</p>
            <p className="font-bold text-foreground text-sm font-mono">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSave} className="glass rounded-2xl p-6 border border-border/80 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="font-bold text-base text-foreground flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Detail &amp; Pengaturan Profil Sekolah
          </h2>
          <span className="text-xs text-muted-foreground font-mono">ID: {school.id}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Nama Resmi Sekolah</label>
            <input
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              required
              placeholder="Contoh: SMA Negeri 1 Jakarta"
              className="w-full px-3.5 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">NPSN (Nomor Pokok Sekolah Nasional)</label>
            <div className="relative">
              <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={npsn}
                onChange={(e) => setNpsn(e.target.value)}
                placeholder="20101234"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/50 shadow-sm"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Nomor Rekening Giro BNI (Escrow)</label>
            <div className="relative">
              <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={bniGiroAccount}
                onChange={(e) => setBniGiroAccount(e.target.value)}
                required
                placeholder="00123456789"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/50 shadow-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Status Operasional Sekolah</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 shadow-sm capitalize"
            >
              <option value="active">Active (Aktif)</option>
              <option value="suspended">Suspended (Ditangguhkan)</option>
              <option value="offboarded">Offboarded (Nonaktif)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">Alamat Resmi Sekolah</label>
          <div className="relative">
            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Jl. Pemuda No. 100, Rawamangun, Jakarta Timur"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 shadow-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/60">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Default Pagu Harian Siswa (Rp)</label>
            <input
              type="number"
              step={1000}
              value={dailyLimit}
              onChange={(e) => setDailyLimit(Number(e.target.value))}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent/50 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Default Batas Overdraft Darurat (Rp)</label>
            <input
              type="number"
              step={1000}
              value={emergencyLimit}
              onChange={(e) => setEmergencyLimit(Number(e.target.value))}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent/50 shadow-sm"
            />
          </div>
        </div>

        <div className="pt-3 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-bold hover:bg-accent/90 transition-all shadow-md flex items-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan Perubahan Sekolah"}
          </button>
        </div>
      </form>
    </div>
  );
}
