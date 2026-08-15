"use client";

import { useState } from "react";
import { Utensils, CreditCard, Loader2, CheckCircle2, User, School, Power, LogOut } from "lucide-react";
import { handleLogout } from "@/lib/auth/actions";

interface MerchantProfileProps {
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  merchant: {
    id: string;
    name: string;
    school_name: string;
    bni_settlement_account: string;
    is_active: boolean;
  };
}

export default function MerchantProfileClient({ user, merchant }: MerchantProfileProps) {
  const [stallName, setStallName] = useState(merchant.name || "");
  const [bniAccount, setBniAccount] = useState(merchant.bni_settlement_account || "");
  const [isActive, setIsActive] = useState(merchant.is_active ?? true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const res = await fetch(`/api/v1/merchants/${merchant.id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stall_name: stallName.trim(),
          bni_settlement_account: bniAccount.trim(),
          is_active: isActive,
        }),
      });

      const data = await res.json() as { success?: boolean; message?: string; error?: string };

      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? "Gagal memperbarui profil merchant");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
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
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-500">
              <Utensils className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">{stallName}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  isActive ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-500" : "bg-muted text-muted-foreground border border-border"
                }`}>
                  {isActive ? "Kantin Buka / Operasional" : "Toko Tutup"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <School className="w-3.5 h-3.5 text-primary" /> {merchant.school_name}
              </p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-mono">
                  Rekening Settlement BNI: <strong className="text-foreground">{bniAccount}</strong>
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            id="merchant-logout-header-btn"
            onClick={() => handleLogout("/login")}
            className="px-4 py-2 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all text-xs font-bold flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Keluar Akun Stand / Ganti User
          </button>
        </div>
      </div>

      {/* Staff Info Card */}
      <div className="glass rounded-2xl p-5 border border-border/80 shadow-lg space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-500" />
            <h2 className="font-bold text-base text-foreground">Informasi Staff / Kasir Stand</h2>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-muted border border-border text-xs font-semibold text-foreground">
            Merchant Staff
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
          <div>
            <p className="text-muted-foreground">Nama PIC / Kasir:</p>
            <p className="font-bold text-foreground text-sm">{user.displayName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Email Login Kasir:</p>
            <p className="font-bold text-foreground text-sm font-mono">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSave} className="glass rounded-2xl p-6 border border-border/80 shadow-xl space-y-4">
        <h2 className="font-bold text-base text-foreground border-b border-border pb-3">
          Pengaturan Stand Kantin &amp; Rekening Pencairan BNI
        </h2>

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">Nama Stand / Kantin</label>
          <input
            type="text"
            value={stallName}
            onChange={(e) => setStallName(e.target.value)}
            required
            className="w-full px-3.5 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">No. Rekening Settlement BNI Merchant</label>
          <div className="relative">
            <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={bniAccount}
              onChange={(e) => setBniAccount(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm"
            />
          </div>
        </div>

        <div className="p-4 bg-muted/50 border border-border/70 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Power className={`w-5 h-5 ${isActive ? "text-emerald-500" : "text-muted-foreground"}`} />
            <div>
              <p className="font-bold text-sm text-foreground">Status Operasional Kantin</p>
              <p className="text-xs text-muted-foreground">Aktifkan untuk menerima transaksi NFC siswa dari Kasir POS</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsActive(!isActive)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              isActive ? "bg-emerald-500 text-white shadow-md" : "bg-muted border border-border text-muted-foreground"
            }`}
          >
            {isActive ? "Buka (Aktif)" : "Tutup (Nonaktif)"}
          </button>
        </div>

        {success && (
          <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Profil merchant berhasil disimpan!
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 border border-destructive/25 p-3 rounded-xl font-medium">
            {error}
          </p>
        )}

        <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
          <button
            type="button"
            id="merchant-logout-footer-btn"
            onClick={() => handleLogout("/login")}
            className="px-4 py-2.5 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all text-xs font-bold flex items-center gap-2 shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            Keluar Akun Kasir / Switch User
          </button>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-all shadow-md flex items-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan Perubahan Merchant"}
          </button>
        </div>
      </form>
    </div>
  );
}

