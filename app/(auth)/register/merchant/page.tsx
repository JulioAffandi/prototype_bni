"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Utensils, Mail, Lock, Phone, CreditCard, Loader2, CheckCircle2, ArrowLeft, School } from "lucide-react";
import { useRouter } from "next/navigation";

interface PublicSchool {
  id: string;
  name: string;
  npsn: string | null;
}

export default function RegisterMerchantPage() {
  const router = useRouter();
  const [schools, setSchools] = useState<PublicSchool[]>([]);
  const [fetchingSchools, setFetchingSchools] = useState(true);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [stallName, setStallName] = useState("");
  const [picName, setPicName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [bniAccount, setBniAccount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadSchools() {
      try {
        const res = await fetch("/api/v1/schools/public-list");
        if (res.ok) {
          const data = await res.json() as { schools: PublicSchool[] };
          setSchools(data.schools || []);
          if (data.schools && data.schools.length > 0) {
            setSelectedSchoolId(data.schools[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load schools", err);
      } finally {
        setFetchingSchools(false);
      }
    }
    loadSchools();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSchoolId) {
      setError("Pilih sekolah tempat kantin beroperasi.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/v1/auth/register/merchant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stall_name: stallName.trim(),
          school_id: selectedSchoolId,
          pic_name: picName.trim(),
          email: email.trim(),
          password,
          phone_number: phoneNumber.trim(),
          bni_payout_account: bniAccount.trim() || undefined,
        }),
      });

      const data = await res.json() as { success?: boolean; message?: string; error?: string };

      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? "Gagal mendaftarkan Merchant");
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
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-500">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Daftar Merchant Kantin</h1>
            <p className="text-xs text-muted-foreground">Terminal Kasir POS &amp; Settlement BNI</p>
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
              <h2 className="font-bold text-lg text-foreground">Merchant Berhasil Didaftarkan!</h2>
              <p className="text-xs text-muted-foreground">
                Mengalihkan ke halaman masuk...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Pilih Sekolah Lokasi Kantin</label>
                {fetchingSchools ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground p-2.5 bg-background border border-border/60 rounded-xl">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" /> Memuat daftar sekolah...
                  </div>
                ) : (
                  <div className="relative">
                    <School className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10 pointer-events-none" />
                    <select
                      value={selectedSchoolId}
                      onChange={(e) => setSelectedSchoolId(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100 border border-slate-700 dark:border-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer shadow-sm"
                    >
                      {schools.map((s) => (
                        <option key={s.id} value={s.id} className="bg-slate-900 text-slate-100">
                          {s.name} {s.npsn ? `(NPSN: ${s.npsn})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Nama Stand / Kantin</label>
                <input
                  type="text"
                  value={stallName}
                  onChange={(e) => setStallName(e.target.value)}
                  placeholder="Contoh: Kantin Sehat Bu Ani"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Nama PIC / Kasir Utama</label>
                <input
                  type="text"
                  value={picName}
                  onChange={(e) => setPicName(e.target.value)}
                  placeholder="Contoh: Ibu Ani Suryani"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Alamat Email Login Kasir</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="kantin.buani@gmail.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm"
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
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Nomor HP / WhatsApp</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="081234567890"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">No. Rekening Pencairan BNI (Settlement Account)</label>
                <div className="relative">
                  <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={bniAccount}
                    onChange={(e) => setBniAccount(e.target.value)}
                    placeholder="88800002222"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm"
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
                className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Daftar Merchant Kantin"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
