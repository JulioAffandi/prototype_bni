import Link from "next/link";
import { UserCheck, Building2, Utensils, ArrowRight, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pilih Peran Registrasi",
};

export default function RegisterRoleSelectionPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold">
          <ShieldCheck className="w-4 h-4" /> VALO BNI Closed-Loop Ecosystem
        </div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight sm:text-4xl">
          Bergabung di Ekosistem VALO
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Pilih jenis akun yang ingin Anda daftarkan untuk mengakses fitur pengawasan digital dan pembayaran sekolah.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl space-y-4">
        {/* Parent Option */}
        <Link
          href="/register/parent"
          className="group glass p-6 rounded-2xl border border-border/80 hover:border-primary/60 transition-all flex items-start justify-between card-hover block shadow-lg"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shrink-0 group-hover:scale-110 transition-transform">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                Orang Tua / Wali Siswa
              </h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Pantau pagu harian jajan anak, kendalikan saldo tabungan Vault, bayar SPP BNI H2H, dan terima notifikasi real-time transaksi kantin.
              </p>
            </div>
          </div>
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all shrink-0 ml-3">
            <ArrowRight className="w-5 h-5" />
          </div>
        </Link>

        {/* School Admin Option */}
        <Link
          href="/register/school"
          className="group glass p-6 rounded-2xl border border-border/80 hover:border-accent/60 transition-all flex items-start justify-between card-hover block shadow-lg"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center text-accent shrink-0 group-hover:scale-110 transition-transform">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-foreground group-hover:text-accent transition-colors flex items-center gap-2">
                Admin Sekolah / Lembaga Pendidikan
              </h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Kelola data siswa, terbitkan kartu NFC, lakukan rekonsiliasi SPP massal, dan awasi kepatuhan UU PDP serta log audit sistem.
              </p>
            </div>
          </div>
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-accent group-hover:text-accent-foreground transition-all shrink-0 ml-3">
            <ArrowRight className="w-5 h-5" />
          </div>
        </Link>

        {/* Merchant / Canteen Option */}
        <Link
          href="/register/merchant"
          className="group glass p-6 rounded-2xl border border-border/80 hover:border-emerald-500/60 transition-all flex items-start justify-between card-hover block shadow-lg"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0 group-hover:scale-110 transition-transform">
              <Utensils className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-foreground group-hover:text-emerald-500 transition-colors flex items-center gap-2">
                Mitra Kantin / Cashier Terminal
              </h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Terminal Kasir POS offline/online, kelola daftar menu &amp; Stok porsi, dan pencairan otomatis ke Rekening Settlement BNI Merchant.
              </p>
            </div>
          </div>
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-emerald-500 group-hover:text-white transition-all shrink-0 ml-3">
            <ArrowRight className="w-5 h-5" />
          </div>
        </Link>

        <div className="text-center pt-4">
          <p className="text-xs text-muted-foreground">
            Sudah memiliki akun?{" "}
            <Link href="/login" className="font-bold text-primary hover:underline">
              Masuk di sini
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
