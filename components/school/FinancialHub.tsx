"use client";

import { useState } from "react";
import type { CreditApplication, InvestmentPosition } from "@/types/institution";
import { calculateRunway, calculateMonthlyInstallment } from "@/lib/finance/calculations";
import {
  Landmark,
  TrendingUp,
  Sliders,
  DollarSign,
  Plus,
  X,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

interface FinancialHubProps {
  schoolId: string;
  initialCreditApplications: CreditApplication[];
  initialInvestments: InvestmentPosition[];
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function FinancialHub({
  schoolId,
  initialCreditApplications,
  initialInvestments,
}: FinancialHubProps) {
  const [creditApps, setCreditApps] = useState<CreditApplication[]>(initialCreditApplications);
  const [investments, setInvestments] = useState<InvestmentPosition[]>(initialInvestments);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Credit form states
  const [plafon, setPlafon] = useState<number>(150000000);
  const [tenor, setTenor] = useState<number>(24);
  const [purpose, setPurpose] = useState("Modal kerja renovasi fasilitas kantin dan pengadaan alat belajar");
  const [interestRate] = useState<number>(9.5);

  // Runway Simulator state
  const [currentLiquidity, setCurrentLiquidity] = useState<number>(450000000);
  const [monthlyExpense, setMonthlyExpense] = useState<number>(85000000);
  const [grossTuition, setGrossTuition] = useState<number>(120000000);
  const [collectionRatePct, setCollectionRatePct] = useState<number>(85);

  // Calculate monthly passive yield from active investments
  const monthlyInvestmentYield = investments
    .filter((inv) => inv.status === "ACTIVE")
    .reduce((sum, inv) => {
      const annualYield = inv.principal_amount * (inv.expected_yield_rate / 100);
      return sum + Math.round(annualYield / 12);
    }, 0);

  const runwayResult = calculateRunway({
    currentLiquidity,
    monthlyOperationalExpense: monthlyExpense,
    expectedMonthlyTuitionGross: grossTuition,
    collectionRatePct,
    monthlyInvestmentYield,
  });

  const estimatedInstallment = calculateMonthlyInstallment(plafon, interestRate, tenor);

  const refreshFinancial = async () => {
    try {
      const res = await fetch(`/api/v1/schools/${schoolId}/financial`);
      if (res.ok) {
        const json = await res.json();
        setCreditApps(json.credit_applications ?? []);
        setInvestments(json.investments ?? []);
      }
    } catch {
      // ignore
    }
  };

  const handleCreateCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const res = await fetch(`/api/v1/schools/${schoolId}/financial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: "credit",
          plafon_amount: plafon,
          tenor_months: tenor,
          purpose,
          estimated_interest_rate: interestRate,
        }),
      });

      if (res.ok) {
        setToastMessage({ type: "success", text: "Pengajuan Kredit BNI berhasil dikirim." });
        setShowCreditModal(false);
        refreshFinancial();
      } else {
        const json = await res.json();
        setToastMessage({ type: "error", text: json.detail || "Gagal mengajukan kredit." });
      }
    } catch {
      setToastMessage({ type: "error", text: "Kesalahan jaringan saat mengajukan kredit." });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm ${
            toastMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}
        >
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="p-1 hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Interactive Runway Simulator (Enhancement 7) */}
      <div className="glass p-6 rounded-2xl border border-portal-border space-y-5">
        <div className="flex items-center justify-between border-b border-portal-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-portal-primary/15 flex items-center justify-center text-portal-primary">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-portal-text">Simulator Financial Runway &amp; Cashflow Proyeksi</h2>
              <p className="text-xs text-portal-muted">
                Dihitung dari penagihan SPP + imbal hasil passive investment yield BNI
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-portal-muted">Est. Monthly Yield Imbal Hasil:</p>
            <p className="text-sm font-bold text-emerald-500">+{formatRupiah(monthlyInvestmentYield)}/bln</p>
          </div>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-portal-muted">Likuiditas Escrow &amp; Giro Saat Ini:</span>
                <span className="text-portal-text font-bold">{formatRupiah(currentLiquidity)}</span>
              </div>
              <input
                type="range"
                min={50000000}
                max={2000000000}
                step={25000000}
                value={currentLiquidity}
                onChange={(e) => setCurrentLiquidity(Number(e.target.value))}
                className="w-full accent-portal-primary"
              />
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-portal-muted">Pengeluaran Operasional Bulanan:</span>
                <span className="text-portal-text font-bold">{formatRupiah(monthlyExpense)}</span>
              </div>
              <input
                type="range"
                min={20000000}
                max={500000000}
                step={5000000}
                value={monthlyExpense}
                onChange={(e) => setMonthlyExpense(Number(e.target.value))}
                className="w-full accent-portal-primary"
              />
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-portal-muted">Total Tagihan SPP Bulanan Gross:</span>
                <span className="text-portal-text font-bold">{formatRupiah(grossTuition)}</span>
              </div>
              <input
                type="range"
                min={30000000}
                max={500000000}
                step={5000000}
                value={grossTuition}
                onChange={(e) => setGrossTuition(Number(e.target.value))}
                className="w-full accent-portal-primary"
              />
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span className="text-portal-muted">Tingkat Penagihan SPP (Collection Rate):</span>
                <span className="text-portal-primary font-bold">{collectionRatePct}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={collectionRatePct}
                onChange={(e) => setCollectionRatePct(Number(e.target.value))}
                className="w-full accent-portal-primary"
              />
            </div>
          </div>

          {/* Runway Result Card */}
          <div className="p-5 rounded-xl bg-portal-surface-alt border border-portal-border flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-portal-muted uppercase tracking-wider">Hasil Proyeksi Real-time</p>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-portal-muted">Net Cashflow Bulanan:</span>
                <span
                  className={`text-base font-bold ${
                    runwayResult.netMonthlyCashflow >= 0 ? "text-emerald-500" : "text-destructive"
                  }`}
                >
                  {runwayResult.netMonthlyCashflow >= 0 ? "+" : ""}
                  {formatRupiah(runwayResult.netMonthlyCashflow)}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-portal-surface border border-portal-border text-center space-y-1">
              <p className="text-[11px] text-portal-muted uppercase tracking-wider">Estimasi Ketahanan Likuiditas (Runway)</p>
              <p className="text-3xl font-extrabold text-portal-primary">
                {runwayResult.runwayMonths === null ? "∞ Bebas Kas" : `${runwayResult.runwayMonths} Bulan`}
              </p>
              <p className="text-[11px] text-portal-muted">
                {runwayResult.runwayMonths === null
                  ? "Cashflow surplus (Inflow melebihi Opex bulanan)"
                  : "Dengan asumsi collection rate & yield saat ini"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Institutional Investment Portfolio Card */}
      <div className="glass p-6 rounded-2xl border border-portal-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-portal-text">Portofolio Investasi Institusi</h3>
              <p className="text-xs text-portal-muted">BNI Deposito, Sukuk Negara &amp; Reksadana Pasar Uang</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {investments.map((inv) => (
            <div key={inv.id} className="p-4 rounded-xl bg-portal-surface-alt border border-portal-border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-portal-text">{inv.investment_type.replace(/_/g, " ")}</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 text-[10px] font-bold">
                  {inv.expected_yield_rate}% p.a.
                </span>
              </div>
              <p className="text-lg font-bold text-portal-primary">{formatRupiah(inv.principal_amount)}</p>
              <div className="flex justify-between text-[11px] text-portal-muted pt-2 border-t border-portal-border/50">
                <span>Akumulasi Imbal Hasil:</span>
                <span className="font-semibold text-emerald-500">+{formatRupiah(inv.accumulated_yield)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. BNI Working Capital Credit Applications */}
      <div className="glass p-6 rounded-2xl border border-portal-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-portal-primary/15 text-portal-primary flex items-center justify-center">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-portal-text">Kredit Modal Kerja BNI</h3>
              <p className="text-xs text-portal-muted">Pengajuan plafon pinjaman operasional &amp; fasilitas sekolah</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowCreditModal(true)}
            className="flex items-center gap-2 rounded-portal bg-portal-primary px-4 py-2 text-xs font-semibold text-portal-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            <span>Ajukan Plafon BNI</span>
          </button>
        </div>

        <div className="space-y-3">
          {creditApps.length === 0 ? (
            <p className="text-xs text-portal-muted py-4 text-center">Belum ada pengajuan kredit modal kerja.</p>
          ) : (
            creditApps.map((credit) => (
              <div
                key={credit.id}
                className="p-4 rounded-xl bg-portal-surface-alt border border-portal-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm text-portal-text">{formatRupiah(credit.plafon_amount)}</p>
                    <span className="text-portal-muted">· Tenor {credit.tenor_months} Bulan ({credit.estimated_interest_rate}% p.a.)</span>
                  </div>
                  <p className="text-portal-muted mt-1">{credit.purpose}</p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] text-portal-muted">Cicilan / Bulan:</p>
                    <p className="font-bold text-portal-text">
                      {credit.estimated_monthly_installment ? formatRupiah(credit.estimated_monthly_installment) : "-"}
                    </p>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                      credit.status === "APPROVED" || credit.status === "DISBURSED"
                        ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                        : credit.status === "REJECTED"
                        ? "bg-destructive/15 text-destructive border border-destructive/30"
                        : "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                    }`}
                  >
                    {credit.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Credit Modal Form */}
      {showCreditModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateCredit} className="bg-portal-surface text-portal-text rounded-2xl p-6 max-w-md w-full space-y-4 border border-portal-border shadow-2xl">
            <div className="flex items-start justify-between border-b border-portal-border pb-3">
              <h3 className="text-base font-bold">Formulir Pengajuan Kredit BNI</h3>
              <button type="button" onClick={() => setShowCreditModal(false)} className="p-1 text-portal-muted hover:text-portal-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-portal-muted font-medium">Plafon Pinjaman Diinginkan (IDR):</label>
                <input
                  type="number"
                  required
                  min={10000000}
                  step={5000000}
                  value={plafon}
                  onChange={(e) => setPlafon(Number(e.target.value))}
                  className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-1.5 text-portal-text font-bold text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-portal-muted font-medium">Tenor (Bulan):</label>
                  <select
                    value={tenor}
                    onChange={(e) => setTenor(Number(e.target.value))}
                    className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-1.5 text-portal-text font-bold"
                  >
                    <option value={12}>12 Bulan (1 Tahun)</option>
                    <option value={24}>24 Bulan (2 Tahun)</option>
                    <option value={36}>36 Bulan (3 Tahun)</option>
                    <option value={60}>60 Bulan (5 Tahun)</option>
                  </select>
                </div>

                <div>
                  <label className="text-portal-muted font-medium">Suku Bunga Est.:</label>
                  <input
                    type="text"
                    disabled
                    value={`${interestRate}% p.a. Anuitas`}
                    className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt/50 px-3 py-1.5 text-portal-muted font-semibold"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-portal-surface-alt border border-portal-border space-y-1">
                <p className="text-[10px] text-portal-muted uppercase">Estimasi Cicilan per Bulan (Calculated Server-side):</p>
                <p className="text-base font-extrabold text-portal-primary">{formatRupiah(estimatedInstallment)}</p>
              </div>

              <div>
                <label className="text-portal-muted font-medium">Tujuan &amp; Peruntukan Pinjaman:</label>
                <textarea
                  rows={3}
                  required
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full mt-1 rounded-portal border border-portal-border bg-portal-surface-alt px-3 py-1.5 text-portal-text"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-portal-border">
              <button
                type="button"
                onClick={() => setShowCreditModal(false)}
                className="px-4 py-2 rounded-portal border border-portal-border text-xs font-semibold text-portal-muted hover:text-portal-text"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={processing}
                className="px-4 py-2 rounded-portal bg-portal-primary text-portal-primary-foreground text-xs font-semibold hover:opacity-90"
              >
                {processing ? "Mengirim..." : "Kirim Pengajuan Ke BNI"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
