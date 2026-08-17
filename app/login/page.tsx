'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Users, Building2, Store, ArrowRight, ShieldCheck, Database, Sparkles } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-6 lg:p-10 font-sans relative overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
      {/* Background Subtle Gradient Accents */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-200/50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-orange-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-emerald-200/40 rounded-full blur-3xl pointer-events-none" />

      {/* 1. Header / Top Brand Pill */}
      <div className="w-full flex justify-center pt-2 sm:pt-4 relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 backdrop-blur-md border border-slate-200 shadow-sm text-xs font-semibold text-slate-700">
          <Sparkles className="text-purple-600" size={14} />
          <span>Ekosistem Closed-Loop Banking Sekolah Terpadu</span>
        </div>
      </div>

      {/* 2. Main Content & Role Cards */}
      <main className="max-w-6xl mx-auto w-full my-auto py-8 relative z-10">
        {/* Brand Logo & Title */}
        <div className="text-center space-y-3 mb-10 sm:mb-14">
          <div className="flex justify-center items-center">
            <Image
              alt="EduConnect Logo"
              className="h-12 sm:h-14 w-auto object-contain drop-shadow-sm"
              height={60}
              priority
              src="/img/logo.png"
              width={210}
            />
          </div>
          <div className="space-y-1.5 max-w-xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Gateway Akses Terpadu
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Pilih portal masuk yang sesuai dengan peran Anda dalam ekosistem perbankan dan transaksi sekolah.
            </p>
          </div>
        </div>

        {/* 3 Role Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Card 1: Orang Tua */}
          <div className="group rounded-2xl bg-white border border-slate-200/90 p-6 shadow-sm hover:shadow-xl hover:border-emerald-400 transition-all duration-300 flex flex-col justify-between relative overflow-hidden">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users size={24} />
                </div>
                <span className="text-[11px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  Mobile App
                </span>
              </div>
              <div className="space-y-1.5">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                  Orang Tua <span className="text-xs font-medium text-slate-500">(Parent Hub)</span>
                </h2>
                <p className="text-xs font-semibold text-emerald-700">Kontrol Pagu & Tabungan Siswa</p>
                <p className="text-xs text-slate-600 leading-relaxed pt-1">
                  Pantau pengeluaran jajan harian anak, alokasi tabungan vault otomatis, dan bayar tagihan SPP secara real-time.
                </p>
              </div>
            </div>

            <div className="pt-6">
              <Link
                id="login-portal-parent"
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 group-hover:gap-3"
                href="/login/parent"
              >
                <span>Masuk Portal</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Card 2: Sekolah */}
          <div className="group rounded-2xl bg-white border border-slate-200/90 p-6 shadow-sm hover:shadow-xl hover:border-indigo-400 transition-all duration-300 flex flex-col justify-between relative overflow-hidden">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Building2 size={24} />
                </div>
                <span className="text-[11px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                  B2B Dashboard
                </span>
              </div>
              <div className="space-y-1.5">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                  Sekolah <span className="text-xs font-medium text-slate-500">(B2B Portal)</span>
                </h2>
                <p className="text-xs font-semibold text-indigo-700">Institutional & Treasury Management</p>
                <p className="text-xs text-slate-600 leading-relaxed pt-1">
                  Kelola data siswa, eksekusi auto-debit SPP H2H BNI, dan optimalkan tata kelola kas serta payroll dengan AI Advisor.
                </p>
              </div>
            </div>

            <div className="pt-6">
              <Link
                id="login-portal-school"
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 group-hover:gap-3"
                href="/login/school"
              >
                <span>Masuk Portal</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Card 3: Kasir Kantin */}
          <div className="group rounded-2xl bg-white border border-slate-200/90 p-6 shadow-sm hover:shadow-xl hover:border-orange-400 transition-all duration-300 flex flex-col justify-between relative overflow-hidden">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 border border-orange-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Store size={24} />
                </div>
                <span className="text-[11px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200/60">
                  POS Terminal
                </span>
              </div>
              <div className="space-y-1.5">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                  Kasir Kantin <span className="text-xs font-medium text-slate-500">(POS Merchant)</span>
                </h2>
                <p className="text-xs font-semibold text-orange-700">Terminal Kasir Kantin Digital</p>
                <p className="text-xs text-slate-600 leading-relaxed pt-1">
                  Terminal kasir cepat untuk memproses transaksi tap-and-pay NFC siswa, antrean sync offline, dan rekomendasi menu.
                </p>
              </div>
            </div>

            <div className="pt-6">
              <Link
                id="login-portal-merchant"
                className="w-full py-2.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-colors shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 group-hover:gap-3"
                href="/login/merchant"
              >
                <span>Masuk Portal</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* 3. Footer Security Badges */}
      <footer className="w-full py-4 text-center border-t border-slate-200/80 relative z-10 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="text-emerald-600" size={16} />
          <span>Keamanan Terenkripsi Supabase Auth & JWT Claims</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Database className="text-indigo-600" size={16} />
          <span>Integrasi H2H BNI Auto-Debit & Ledger Multi-Tenant</span>
        </div>
      </footer>
    </div>
  );
}
