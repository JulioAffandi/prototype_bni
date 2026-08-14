"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, Mail, Lock, Loader2, AlertCircle, ArrowLeft, ShieldCheck, HeartHandshake, Zap } from "lucide-react";

export default function ParentLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      const user = signInData.user;
      if (!user) {
        setError("Gagal mendapatkan sesi pengguna.");
        setLoading(false);
        return;
      }

      // Validate Persona Role ('parent')
      const appMetadata = user.app_metadata || {};
      const userRoles: string[] = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
      const legacyRole = (user.user_metadata?.role as string) || (appMetadata.role as string) || "";
      const roles = userRoles.length > 0 ? userRoles : (legacyRole ? [legacyRole] : []);

      let isParentUser = roles.includes("parent") || roles.includes("platform_admin");

      // Database fallback check if JWT app_metadata is pending refresh
      if (!isParentUser) {
        const { data: dbRoles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .is("revoked_at", null);

        const rolesList = (dbRoles ?? []) as unknown as Array<{ role: string }>;
        if (rolesList.some((r) => r.role === "parent" || r.role === "platform_admin")) {
          isParentUser = true;
        }
      }

      if (!isParentUser) {
        await supabase.auth.signOut();
        setError("Akun ini tidak terdaftar sebagai akun Orang Tua. Silakan gunakan portal yang sesuai.");
        setLoading(false);
        return;
      }

      router.refresh();
      router.push("/parent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat masuk.");
      setLoading(false);
    }
  }

  function handleQuickFill() {
    setEmail("parent.demo@gmail.com");
    setPassword("Demo1234!");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Emerald ambient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-teal-500/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md z-10">
        {/* Back Link */}
        <div className="mb-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-emerald-400 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Pilihan Portal</span>
          </Link>
        </div>

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-3 shadow-lg shadow-emerald-950/20">
            <Users className="w-7 h-7 text-emerald-400" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-2">
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>Portal Orang Tua</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">VALO Parent Hub</h1>
          <p className="text-xs text-emerald-400/90 font-medium mt-0.5">Kontrol Pagu &amp; Tabungan Siswa</p>
          <p className="text-xs text-muted-foreground mt-2 max-w-xs leading-relaxed">
            Masuk untuk memantau pengeluaran harian, tabungan vault, dan tagihan SPP anak Anda.
          </p>
        </div>

        {/* Login Card */}
        <div className="glass rounded-2xl p-6 border border-emerald-500/20 shadow-2xl space-y-4">
          {/* Quick Fill Demo Credentials Banner */}
          <button
            type="button"
            onClick={handleQuickFill}
            id="parent-quick-fill-btn"
            className="w-full p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-left transition-all group flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-400">Gunakan Akun Demo Orang Tua</p>
                <p className="text-[11px] text-muted-foreground">Hendra Wijaya · parent.demo@gmail.com</p>
              </div>
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
              Isi Otomatis
            </span>
          </button>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold mb-1.5 text-foreground/90">
                Email Orang Tua
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="orangtua@email.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted/60 border border-border text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold mb-1.5 text-foreground/90">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted/60 border border-border text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/15 border border-destructive/30">
                <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-xs font-medium text-destructive leading-relaxed">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              id="parent-login-btn"
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-950/40 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <span>Masuk Portal Orang Tua</span>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-border/50 text-center">
            <Link
              href="/login"
              className="text-xs text-muted-foreground hover:text-emerald-400 font-medium transition-colors"
            >
              Bukan akun orang tua? <span className="underline">Ganti portal</span>
            </Link>
          </div>
        </div>

        {/* Security footnote */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Keamanan Terenkripsi Supabase Auth</span>
        </div>
      </div>
    </div>
  );
}
