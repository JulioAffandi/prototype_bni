"use client";

import { useState } from "react";
import {
  CheckCircle2, AlertTriangle, Clock, XCircle,
  RefreshCw, ChevronDown, Search, Filter, Plus, Loader2, X, FileText,
} from "lucide-react";

import type { invoice_status_t } from "@/types/database";

type SPPStatus = invoice_status_t;

interface Invoice {
  id: string;
  student_id: string;
  student_name: string;
  period: string;
  amount: number;
  status: SPPStatus;
  due_date: string;
  paid_at: string | null;
  retry_count: number;
  bni_h2h_reference: string | null;
}

interface SPPReconciliationTableProps {
  schoolId: string;
  initialPeriod: string;
  availablePeriods: string[];
  initialInvoices: Invoice[];
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; label: string; class: string }> = {
  PAID: { icon: CheckCircle2, label: "Lunas", class: "badge-paid" },
  UNPAID: { icon: Clock, label: "Belum Bayar", class: "badge-unpaid" },
  FAILED: { icon: XCircle, label: "Gagal", class: "badge-failed" },
  OVERDUE: { icon: AlertTriangle, label: "Jatuh Tempo", class: "badge-overdue" },
  DRAFT: { icon: Clock, label: "Draft", class: "badge-unpaid" },
  CANCELLED: { icon: XCircle, label: "Batal", class: "badge-failed" },
};

export default function SPPReconciliationTable({
  schoolId,
  initialPeriod,
  availablePeriods,
  initialInvoices,
}: SPPReconciliationTableProps) {
  const [period, setPeriod] = useState(initialPeriod);
  const [periodsList, setPeriodsList] = useState<string[]>(availablePeriods);
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<SPPStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

  // Generate modal state
  const [showGenModal, setShowGenModal] = useState(false);
  const [genPeriod, setGenPeriod] = useState(initialPeriod);
  const [genAmount, setGenAmount] = useState(500000);
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  async function loadPeriod(newPeriod: string) {
    setLoading(true);
    setPeriod(newPeriod);
    try {
      const res = await fetch(`/api/v1/schools/${schoolId}/spp?period=${newPeriod}`);
      if (res.ok) {
        const data = await res.json() as { invoices: Invoice[] };
        setInvoices(data.invoices);
      }
    } finally {
      setLoading(false);
    }
  }

  async function retryInvoice(invoiceId: string) {
    setRetrying(invoiceId);
    try {
      const res = await fetch(`/api/v1/spp/${invoiceId}/retry`, { method: "POST" });
      if (res.ok) {
        setInvoices((prev) =>
          prev.map((inv) =>
            inv.id === invoiceId ? { ...inv, status: "UNPAID", retry_count: inv.retry_count + 1 } : inv
          )
        );
      }
    } finally {
      setRetrying(null);
    }
  }

  async function handleGenerateSPP(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setGenError(null);
    setGenMsg(null);

    try {
      const res = await fetch(`/api/v1/schools/${schoolId}/spp/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: genPeriod.trim(),
          amount: Number(genAmount),
        }),
      });

      const data = await res.json() as { success?: boolean; message?: string; generated_count?: number; error?: string };

      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? "Gagal memproses batch SPP");
      }

      if (!periodsList.includes(genPeriod.trim())) {
        setPeriodsList((prev) => [genPeriod.trim(), ...prev]);
      }

      setGenMsg(data.message ?? `Berhasil membuat ${data.generated_count} tagihan SPP.`);
      await loadPeriod(genPeriod.trim());

      setTimeout(() => {
        setShowGenModal(false);
        setGenMsg(null);
      }, 1500);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setGenerating(false);
    }
  }

  const filtered = invoices.filter((inv) => {
    const matchSearch = search === "" || inv.student_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "ALL" || inv.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalPaid = invoices.filter((i) => i.status === "PAID").length;
  const totalFailed = invoices.filter((i) => i.status === "FAILED" || i.status === "OVERDUE").length;
  const totalAmount = invoices.reduce((s, i) => s + i.amount, 0);
  const paidAmount = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Tagihan", value: formatRupiah(totalAmount) },
          { label: "Dana Terkumpul", value: formatRupiah(paidAmount) },
          { label: "Lunas", value: `${totalPaid} siswa` },
          { label: "Bermasalah", value: `${totalFailed} siswa` },
        ].map((s) => (
          <div key={s.label} className="glass rounded-2xl p-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="font-bold text-sm mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters & Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Period selector */}
        <div className="relative">
          <select
            id="spp-period-select"
            value={period}
            onChange={(e) => loadPeriod(e.target.value)}
            className="appearance-none bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100 border border-slate-700 dark:border-slate-700 rounded-xl px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
          >
            {periodsList.map((p) => (
              <option key={p} value={p} className="bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100">
                {p}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            id="spp-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama siswa..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Generate Button */}
        <button
          id="generate-spp-btn"
          onClick={() => {
            setGenError(null);
            setGenMsg(null);
            setShowGenModal(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 active:scale-[0.98] transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Generate Tagihan SPP
        </button>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {(["ALL", "PAID", "UNPAID", "FAILED", "OVERDUE"] as const).map((s) => (
            <button
              key={s}
              id={`spp-filter-${s}`}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${filterStatus === s
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
                }`}
            >
              {s === "ALL" ? "Semua" : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <RefreshCw className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-xs text-muted-foreground font-medium">Siswa</th>
                <th className="text-left p-4 text-xs text-muted-foreground font-medium">Jumlah</th>
                <th className="text-left p-4 text-xs text-muted-foreground font-medium">Status</th>
                <th className="text-left p-4 text-xs text-muted-foreground font-medium">Jatuh Tempo</th>
                <th className="text-left p-4 text-xs text-muted-foreground font-medium">Ref BNI</th>
                <th className="text-right p-4 text-xs text-muted-foreground font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => {
                const cfg = STATUS_CONFIG[inv.status];
                const Icon = cfg.icon;
                const canRetry = inv.status === "FAILED" && inv.retry_count < 3;
                return (
                  <tr key={inv.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <p className="font-medium">{inv.student_name}</p>
                      {inv.retry_count > 0 && (
                        <p className="text-xs text-muted-foreground">Percobaan ke-{inv.retry_count}</p>
                      )}
                    </td>
                    <td className="p-4 font-semibold">{formatRupiah(inv.amount)}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.class}`}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground text-xs">
                      {new Date(inv.due_date).toLocaleDateString("id-ID")}
                    </td>
                    <td className="p-4">
                      {inv.bni_h2h_reference ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          {inv.bni_h2h_reference.slice(-8)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {canRetry && (
                        <button
                          id={`retry-spp-${inv.id}`}
                          onClick={() => retryInvoice(inv.id)}
                          disabled={retrying === inv.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/50 text-primary text-xs hover:bg-primary/10 transition-all disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3 h-3 ${retrying === inv.id ? "animate-spin" : ""}`} />
                          Coba Ulang
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                    Tidak ada tagihan yang sesuai dengan filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Generate SPP Modal */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-bold text-base text-foreground">Generate Batch Tagihan SPP</h3>
              </div>
              <button
                onClick={() => setShowGenModal(false)}
                className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGenerateSPP} className="space-y-4">
              <div>
                <label htmlFor="gen-period" className="block text-xs font-semibold text-foreground mb-1">
                  Periode Tagihan (YYYY-MM)
                </label>
                <input
                  id="gen-period"
                  type="month"
                  value={genPeriod}
                  onChange={(e) => setGenPeriod(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                />
              </div>

              <div>
                <label htmlFor="gen-amount" className="block text-xs font-semibold text-foreground mb-1">
                  Nominal SPP per Siswa (Rp)
                </label>
                <input
                  id="gen-amount"
                  type="number"
                  step={50000}
                  value={genAmount}
                  onChange={(e) => setGenAmount(Number(e.target.value))}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm mb-2"
                />
                <div className="flex gap-2">
                  {[300000, 500000, 750000, 1000000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setGenAmount(preset)}
                      className={`flex-1 py-1 rounded-lg text-[11px] font-semibold border transition-all ${genAmount === preset
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 text-muted-foreground border-border/60 hover:text-foreground"
                        }`}
                    >
                      Rp {(preset / 1000).toLocaleString("id-ID")}k
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-muted/60 border border-border/60 text-xs text-muted-foreground">
                Sistem akan memproses seluruh siswa aktif di sekolah ini yang belum memiliki tagihan SPP untuk periode <strong>{genPeriod}</strong>.
              </div>

              {genMsg && (
                <p className="text-xs text-emerald-500 bg-emerald-500/15 border border-emerald-500/30 p-2.5 rounded-xl font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {genMsg}
                </p>
              )}

              {genError && (
                <p className="text-xs text-destructive bg-destructive/10 border border-destructive/25 p-2.5 rounded-xl font-medium">
                  {genError}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGenModal(false)}
                  disabled={generating}
                  className="flex-1 py-2.5 rounded-xl border border-border bg-background text-foreground text-xs font-semibold hover:bg-muted transition-all"
                >
                  Batal
                </button>
                <button
                  id="submit-gen-spp-btn"
                  type="submit"
                  disabled={generating || !genPeriod.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-1 shadow-md disabled:opacity-60"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memproses...
                    </>
                  ) : (
                    "Proses Batch Tagihan"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

