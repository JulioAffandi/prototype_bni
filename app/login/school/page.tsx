"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Mail, Lock, Loader2, AlertCircle, ArrowLeft, ShieldCheck, Landmark } from "lucide-react";

export default function SchoolLoginPage() {
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

      // Validate Persona Role ('school_admin', 'school_treasurer', 'platform_admin')
      const appMetadata = user.app_metadata || {};
      const userRoles: string[] = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
      const legacyRole = (user.user_metadata?.role as string) || (appMetadata.role as string) || "";
      const roles = userRoles.length > 0 ? userRoles : (legacyRole ? [legacyRole] : []);

      let isSchoolUser = roles.some(
        (r) => r === "school_admin" || r === "school_treasurer" || r === "platform_admin" || r === "platform_support",
      );

      // Database fallback check if JWT app_metadata is pending refresh
      if (!isSchoolUser) {
        const { data: dbRoles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .is("revoked_at", null);

        const rolesList = (dbRoles ?? []) as unknown as Array<{ role: string }>;
        if (
          rolesList.some(
            (r) =>
              r.role === "school_admin" ||
              r.role === "school_treasurer" ||
              r.role === "platform_admin" ||
              r.role === "platform_support",
          )
        ) {
          isSchoolUser = true;
        }
      }

      if (!isSchoolUser) {
        await supabase.auth.signOut();
        setError("Akun ini tidak terdaftar sebagai pengelola sekolah. Silakan gunakan portal yang sesuai.");
        setLoading(false);
        return;
      }

      router.refresh();
      router.push("/school");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat masuk.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Deep blue & amber ambient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[550px] h-[550px] rounded-full bg-blue-600/10 blur-[130px]" />
        <div className="absolute -bottom-40 -left-40 w-[550px] h-[550px] rounded-full bg-amber-500/10 blur-[130px]" />
      </div>

      <div className="relative w-full max-w-md z-10">
        {/* Back Link */}
        <div className="mb-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-blue-400 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Pilihan Portal</span>
          </Link>
        </div>

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center mb-3 shadow-lg shadow-blue-950/20">
            <Building2 className="w-7 h-7 text-blue-400" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-2">
            <Landmark className="w-3.5 h-3.5" />
            <span>B2B Institutional Portal</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">VALO School Portal</h1>
          <p className="text-xs text-blue-400/90 font-medium mt-0.5">B2B Institutional &amp; Treasury Management</p>
          <p className="text-xs text-muted-foreground mt-2 max-w-xs leading-relaxed">
            Portal manajemen siswa, auto-debit SPP H2H BNI, dan tata kelola ekosistem sekolah.
          </p>
        </div>

        {/* Login Card */}
        <div className="glass rounded-2xl p-6 border border-blue-500/20 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold mb-1.5 text-foreground/90">
                Email Admin / Bendahara Sekolah
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@sekolah.ac.id"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted/60 border border-border text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted/60 border border-border text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
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
              id="school-login-btn"
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-950/40 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi Otoritas...</span>
                </>
              ) : (
                <span>Masuk Portal Sekolah</span>
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-border/50 text-center">
            <Link
              href="/login"
              className="text-xs text-muted-foreground hover:text-blue-400 font-medium transition-colors"
            >
              Bukan pengelola sekolah? <span className="underline">Ganti portal</span>
            </Link>
          </div>
        </div>

        {/* Security footnote */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          <span>Keamanan Terenkripsi Supabase Auth &amp; BNI H2H</span>
        </div>
      </div>
    </div>
  );
}
