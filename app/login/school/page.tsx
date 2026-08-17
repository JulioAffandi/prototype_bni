"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Loader2, AlertCircle, ArrowLeft, ShieldCheck, Landmark, Zap } from "lucide-react";
import EduConnectLogo from "@/components/shared/EduConnectLogo";

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

  function handleQuickFill() {
    setEmail("admin.demo@sekolah.sch.id");
    setPassword("Demo1234!");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Indigo & Amber ambient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-amber-200/40 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md z-10 py-6">
        {/* Back Link */}
        <div className="mb-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Pilihan Portal</span>
          </Link>
        </div>

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-3">
            <EduConnectLogo variant="full" width={170} height={48} priority />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold mb-2">
            <Landmark className="w-3.5 h-3.5" />
            <span>B2B Institutional Portal</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Portal Admin &amp; Keuangan Sekolah</h1>
          <p className="text-xs text-indigo-700 font-semibold mt-0.5">B2B Institutional &amp; Treasury Management</p>
          <p className="text-xs text-slate-600 mt-2 max-w-xs leading-relaxed">
            Portal manajemen siswa, auto-debit SPP H2H BNI, dan tata kelola ekosistem sekolah.
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-xl space-y-4">
          {/* Quick Fill Demo Credentials Banner */}
          <button
            type="button"
            onClick={handleQuickFill}
            id="school-quick-fill-btn"
            className="w-full p-3 rounded-xl bg-indigo-50 hover:bg-indigo-100/70 border border-indigo-200 text-left transition-all group flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-800">Gunakan Akun Demo Admin Sekolah</p>
                <p className="text-[11px] text-slate-500">SMA BNI Harapan Bangsa · admin.demo@sekolah.sch.id</p>
              </div>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 border border-indigo-200 shrink-0">
              Isi Otomatis
            </span>
          </button>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold mb-1.5 text-slate-700">
                Email Admin / Bendahara Sekolah
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@sekolah.ac.id"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold mb-1.5 text-slate-700">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs font-medium text-red-600 leading-relaxed">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              id="school-login-btn"
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link
              href="/login"
              className="text-slate-500 hover:text-indigo-700 font-medium transition-colors"
            >
              Ganti Portal
            </Link>
            <Link
              href="/register?role=school_admin"
              className="text-indigo-600 hover:underline font-bold transition-colors"
            >
              Daftar Sekolah Baru
            </Link>
          </div>
        </div>

        {/* Security footnote */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
          <span>Keamanan Terenkripsi Supabase Auth &amp; BNI H2H</span>
        </div>
      </div>
    </div>
  );
}
