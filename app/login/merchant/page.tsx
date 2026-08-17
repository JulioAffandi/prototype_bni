"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Loader2, AlertCircle, ArrowLeft, ShieldCheck, Zap, Store } from "lucide-react";
import EduConnectLogo from "@/components/shared/EduConnectLogo";

export default function MerchantLoginPage() {
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

      // Validate Persona Role ('merchant_staff', 'merchant_owner', 'platform_admin')
      const appMetadata = user.app_metadata || {};
      const userRoles: string[] = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
      const legacyRole = (user.user_metadata?.role as string) || (appMetadata.role as string) || "";
      const roles = userRoles.length > 0 ? userRoles : (legacyRole ? [legacyRole] : []);

      let isMerchantUser = roles.some(
        (r) => r === "merchant_staff" || r === "merchant_owner" || r === "platform_admin" || r === "platform_support",
      );

      // Database fallback check if JWT app_metadata is pending refresh
      if (!isMerchantUser) {
        const { data: dbRoles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .is("revoked_at", null);

        const rolesList = (dbRoles ?? []) as unknown as Array<{ role: string }>;
        if (
          rolesList.some(
            (r) =>
              r.role === "merchant_staff" ||
              r.role === "merchant_owner" ||
              r.role === "platform_admin" ||
              r.role === "platform_support",
          )
        ) {
          isMerchantUser = true;
        }
      }

      if (!isMerchantUser) {
        await supabase.auth.signOut();
        setError("Akun ini tidak terdaftar sebagai kasir kantin. Silakan gunakan portal yang sesuai.");
        setLoading(false);
        return;
      }

      router.refresh();
      router.push("/pos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat masuk.");
      setLoading(false);
    }
  }

  function handleQuickFill() {
    setEmail("kantin.demo@merchant.valo.id");
    setPassword("Demo1234!");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden font-sans selection:bg-orange-100 selection:text-orange-900">
      {/* Orange & Amber ambient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-orange-200/40 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-amber-200/40 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md z-10 py-6">
        {/* Back Link */}
        <div className="mb-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-orange-600 transition-colors"
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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold mb-2">
            <Store className="w-3.5 h-3.5" />
            <span>POS Terminal Mode</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Terminal Kasir &amp; POS Kantin</h1>
          <p className="text-xs text-orange-700 font-semibold mt-0.5">Terminal Kasir Kantin Digital</p>
          <p className="text-xs text-slate-600 mt-2 max-w-xs leading-relaxed">
            Masuk ke terminal kasir untuk memproses transaksi tap-and-pay NFC siswa dan rekomendasi menu.
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-xl space-y-4">
          {/* Quick Fill Demo Credentials Banner */}
          <button
            type="button"
            onClick={handleQuickFill}
            id="merchant-quick-fill-btn"
            className="w-full p-3 rounded-xl bg-orange-50 hover:bg-orange-100/70 border border-orange-200 text-left transition-all group flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-orange-800">Gunakan Akun Demo Kasir Kantin</p>
                <p className="text-[11px] text-slate-500">Kantin Bu Nur · kantin.demo@merchant.valo.id</p>
              </div>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 border border-orange-200 shrink-0">
              Isi Otomatis
            </span>
          </button>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold mb-1.5 text-slate-700">
                Email / ID Kasir Kantin
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="kasir@kantin.ac.id"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold mb-1.5 text-slate-700">
                PIN / Kata Sandi Kasir
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
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
              id="merchant-login-btn"
              className="w-full py-2.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold shadow-md shadow-orange-500/20 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Membuka Terminal POS...</span>
                </>
              ) : (
                <span>Masuk Terminal Kasir</span>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link
              href="/login"
              className="text-slate-500 hover:text-orange-700 font-medium transition-colors"
            >
              Ganti Portal
            </Link>
            <Link
              href="/register?role=merchant_staff"
              className="text-orange-600 hover:underline font-bold transition-colors"
            >
              Daftar Merchant Kantin
            </Link>
          </div>
        </div>

        {/* Security footnote */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-orange-600" />
          <span>Tap-and-Pay NFC Offline Queue Ready</span>
        </div>
      </div>
    </div>
  );
}
