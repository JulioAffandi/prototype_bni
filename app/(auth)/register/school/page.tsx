"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Mail, Lock, Phone, CreditCard, Loader2, CheckCircle2, ArrowLeft, Hash } from "lucide-react";
import { useRouter } from "next/navigation";

export default function RegisterSchoolPage() {
  const router = useRouter();
  const [schoolName, setSchoolName] = useState("");
  const [npsn, setNpsn] = useState("");
  const [schoolType, setSchoolType] = useState("SMA");
  const [picName, setPicName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [giroAccount, setGiroAccount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/v1/auth/register/school", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_name: schoolName.trim(),
          npsn: npsn.trim(),
          school_type: schoolType,
          pic_name: picName.trim(),
          email: email.trim(),
          password,
          phone_number: phoneNumber.trim(),
          giro_account: giroAccount.trim() || undefined,
        }),
      });

      const data = await res.json() as { success?: boolean; message?: string; error?: string };

      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? "Gagal mendaftarkan Sekolah");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/login?registered=1");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link
          href="/register"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4 font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Pilih Peran
        </Link>
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-accent/20 flex items-center justify-center text-accent">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Daftar Sekolah &amp; PIC Admin</h1>
            <p className="text-xs text-muted-foreground">Portal Admin Sekolah Ekosistem VALO BNI</p>
          </div>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="glass p-6 rounded-2xl shadow-xl border border-border/80 space-y-4">
          {success ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="font-bold text-lg text-foreground">Sekolah &amp; Admin Berhasil Didaftarkan!</h2>
              <p className="text-xs text-muted-foreground">
                Mengalihkan ke halaman masuk...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Nama Resmi Sekolah / Lembaga</label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="Contoh: SMA Negeri 1 Jakarta"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">NPSN (8 Digit)</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={npsn}
                      onChange={(e) => setNpsn(e.target.value)}
                      placeholder="20101234"
                      required
                      minLength={8}
                      maxLength={8}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-background text-foreground border border-border/80 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Jenjang Sekolah</label>
                  <select
                    value={schoolType}
                    onChange={(e) => setSchoolType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100 border border-slate-700 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer"
                  >
                    <option value="SD" className="bg-slate-900 text-slate-100">SD / MI</option>
                    <option value="SMP" className="bg-slate-900 text-slate-100">SMP / MTs</option>
                    <option value="SMA" className="bg-slate-900 text-slate-100">SMA / MA</option>
                    <option value="SMK" className="bg-slate-900 text-slate-100">SMK</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Nama PIC Admin Sekolah</label>
                <input
                  type="text"
                  value={picName}
                  onChange={(e) => setPicName(e.target.value)}
                  placeholder="Contoh: Drs. Bambang Suryono"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Email Resmi Admin</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@sekolah.sch.id"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Kata Sandi (Min 6 Karakter)</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Nomor HP Admin</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="081234567890"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">No. Rekening Giro BNI Sekolah (Opsional)</label>
                <div className="relative">
                  <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={giroAccount}
                    onChange={(e) => setGiroAccount(e.target.value)}
                    placeholder="88800001111"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/50 shadow-sm"
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-destructive bg-destructive/10 border border-destructive/25 p-3 rounded-xl font-medium">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-accent text-accent-foreground text-sm font-bold hover:bg-accent/90 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Daftar Akun Sekolah"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
