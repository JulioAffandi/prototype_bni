import Link from "next/link";
import { Users, Building2, Store, ArrowRight, ShieldCheck, CreditCard, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import EduConnectLogo from "@/components/shared/EduConnectLogo";

export const metadata: Metadata = {
  title: "Pilih Portal Masuk | EduConnect",
  description: "Portal Akses Terpadu EduConnect — Pilih persona login Anda.",
};

export default function LoginGatewayPage() {
  const portals = [
    {
      id: "parent",
      title: "Orang Tua",
      tag: "Parent Hub",
      subtitle: "Kontrol Pagu & Tabungan Siswa",
      description: "Pantau pengeluaran jajan harian, alokasi tabungan vault otomatis, dan tagihan SPP anak Anda secara real-time.",
      href: "/login/parent",
      icon: Users,
      badge: "Mobile App",
      gradient: "from-emerald-500/20 via-teal-500/10 to-transparent",
      borderColor: "hover:border-emerald-500/50",
      accentBg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      btnClass: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    },
    {
      id: "school",
      title: "Sekolah",
      tag: "B2B Portal",
      subtitle: "Institutional & Treasury Management",
      description: "Kelola data siswa, eksekusi auto-debit SPP H2H BNI, dan optimalkan tata kelola treasury sekolah dengan AI Advisor.",
      href: "/login/school",
      icon: Building2,
      badge: "B2B Dashboard",
      gradient: "from-blue-600/20 via-amber-500/10 to-transparent",
      borderColor: "hover:border-blue-500/50",
      accentBg: "bg-blue-500/15 text-blue-400 border-blue-500/30",
      btnClass: "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-950/40",
      badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    },
    {
      id: "merchant",
      title: "Kasir Kantin",
      tag: "POS Merchant",
      subtitle: "Terminal Kasir Kantin Digital",
      description: "Terminal kasir cepat untuk memproses transaksi tap-and-pay NFC siswa, antrean sync offline, dan rekomendasi menu.",
      href: "/login/merchant",
      icon: Store,
      badge: "POS Terminal",
      gradient: "from-orange-500/20 via-cyan-500/10 to-transparent",
      borderColor: "hover:border-orange-500/50",
      accentBg: "bg-orange-500/15 text-orange-400 border-orange-500/30",
      btnClass: "bg-orange-600 hover:bg-orange-500 text-white shadow-orange-950/40",
      badgeColor: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background ambient lighting effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute -bottom-40 left-1/4 w-[450px] h-[450px] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-20 w-[450px] h-[450px] rounded-full bg-amber-500/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-5xl z-10 py-8">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-semibold mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ekosistem Closed-Loop Banking Sekolah</span>
          </div>
          
          <div className="mb-4">
            <EduConnectLogo variant="full" width={180} height={52} priority />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
            Gateway Akses Terpadu
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-lg">
            Pilih portal masuk yang sesuai dengan peran Anda dalam ekosistem perbankan dan transaksi sekolah.
          </p>
        </div>

        {/* 3 Persona Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {portals.map((portal) => {
            const Icon = portal.icon;
            return (
              <div
                key={portal.id}
                className={`group relative glass rounded-2xl p-6 border border-border/80 transition-all duration-300 ${portal.borderColor} hover:shadow-2xl hover:-translate-y-1 flex flex-col justify-between overflow-hidden`}
              >
                {/* Subtle internal gradient glow */}
                <div className={`absolute inset-0 bg-gradient-to-b ${portal.gradient} opacity-40 group-hover:opacity-100 transition-opacity pointer-events-none`} />

                <div className="relative z-10">
                  {/* Top Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${portal.accentBg}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${portal.badgeColor}`}>
                      {portal.badge}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-bold text-foreground">{portal.title}</h2>
                      <span className="text-xs text-muted-foreground font-mono">({portal.tag})</span>
                    </div>
                    <p className="text-xs font-semibold text-primary/90 mb-2">{portal.subtitle}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {portal.description}
                    </p>
                  </div>
                </div>

                {/* Action Link Button */}
                <div className="relative z-10 pt-4 border-t border-border/40">
                  <Link
                    href={portal.href}
                    id={`login-portal-${portal.id}`}
                    className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] ${portal.btnClass}`}
                  >
                    <span>Masuk Portal</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Guarantee */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 text-xs text-muted-foreground border-t border-border/50 pt-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Keamanan Terenkripsi Supabase Auth &amp; JWT Claims</span>
          </div>
          <div className="hidden sm:block text-border">•</div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-blue-400" />
            <span>Integrasi H2H BNI Auto-Debit &amp; Ledger Multi-Tenant</span>
          </div>
        </div>
      </div>
    </div>
  );
}
