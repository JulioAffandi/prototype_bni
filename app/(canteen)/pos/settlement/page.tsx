import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { BarChart3, CheckCircle2, Clock, TrendingUp, Banknote } from "lucide-react";

export const metadata: Metadata = { title: "Settlement H+0" };

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default async function SettlementPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("merchant_id")
    .eq("id", user.id)
    .single();
  if (!profile?.merchant_id) redirect("/login");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: txToday } = await supabase
    .from("canteen_transactions")
    .select("id, amount, status, is_emergency, created_at")
    .eq("merchant_id", profile.merchant_id)
    .gte("created_at", today.toISOString())
    .order("created_at", { ascending: false });

  const settled = (txToday ?? []).filter((t) =>
    ["SETTLED", "SETTLED_OVERDRAFT", "COMPLETED"].includes(t.status)
  );
  const totalRevenue = settled.reduce((s, t) => s + t.amount, 0);
  const emergencyCount = settled.filter((t) => t.is_emergency).length;
  const txCount = settled.length;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Settlement H+0</h1>
          <p className="text-sm text-muted-foreground">
            {today.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Omzet Hari Ini", value: formatRupiah(totalRevenue), icon: TrendingUp, color: "text-primary", bg: "bg-primary/15" },
          { label: "Transaksi", value: String(txCount), icon: CheckCircle2, color: "text-primary", bg: "bg-primary/15" },
          { label: "Mode Darurat", value: String(emergencyCount), icon: Clock, color: "text-accent", bg: "bg-accent/15" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="glass rounded-2xl p-3 text-center">
              <div className={`w-8 h-8 rounded-xl ${s.bg} flex items-center justify-center mx-auto mb-2`}>
                <Icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className="font-bold text-sm">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Settlement status */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Banknote className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm">Status Pencairan Dana</h2>
        </div>
        <div className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/25">
          <div>
            <p className="font-semibold">{formatRupiah(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Dijadwalkan cair hari ini (H+0)</p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/20 text-primary text-xs font-medium">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Dalam Proses
          </div>
        </div>
      </div>

      {/* Transaction list */}
      <div className="glass rounded-2xl p-4">
        <h2 className="font-semibold text-sm mb-3">Riwayat Transaksi Hari Ini</h2>
        {txToday && txToday.length > 0 ? (
          <div className="space-y-2">
            {txToday.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${
                    ["SETTLED","SETTLED_OVERDRAFT","COMPLETED"].includes(tx.status) ? "bg-primary" : "bg-destructive"
                  }`} />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.created_at).toLocaleTimeString("id-ID", {hour:"2-digit",minute:"2-digit"})}
                    </p>
                    {tx.is_emergency && (
                      <p className="text-xs text-accent">Mode Darurat</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    ["SETTLED","SETTLED_OVERDRAFT","COMPLETED"].includes(tx.status) ? "badge-settled" : "badge-rejected"
                  }`}>
                    {tx.status}
                  </span>
                  <p className="text-sm font-bold">{formatRupiah(tx.amount)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Belum ada transaksi hari ini
          </p>
        )}
      </div>
    </div>
  );
}
