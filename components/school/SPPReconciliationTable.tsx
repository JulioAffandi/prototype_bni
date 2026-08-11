"use client";

import { useState } from "react";
import {
  CheckCircle2, AlertTriangle, Clock, XCircle,
  RefreshCw, ChevronDown, Search, Filter,
} from "lucide-react";

type SPPStatus = "PAID" | "UNPAID" | "FAILED" | "OVERDUE";

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

const STATUS_CONFIG: Record<SPPStatus, { icon: typeof CheckCircle2; label: string; class: string }> = {
  PAID:    { icon: CheckCircle2, label: "Lunas",       class: "badge-paid" },
  UNPAID:  { icon: Clock,        label: "Belum Bayar", class: "badge-unpaid" },
  FAILED:  { icon: XCircle,      label: "Gagal",       class: "badge-failed" },
  OVERDUE: { icon: AlertTriangle, label: "Jatuh Tempo", class: "badge-overdue" },
};

export default function SPPReconciliationTable({
  schoolId,
  initialPeriod,
  availablePeriods,
  initialInvoices,
}: SPPReconciliationTableProps) {
  const [period, setPeriod] = useState(initialPeriod);
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<SPPStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

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

  const filtered = invoices.filter((inv) => {
    const matchSearch = search === "" || inv.student_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "ALL" || inv.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalPaid    = invoices.filter((i) => i.status === "PAID").length;
  const totalFailed  = invoices.filter((i) => i.status === "FAILED" || i.status === "OVERDUE").length;
  const totalAmount  = invoices.reduce((s, i) => s + i.amount, 0);
  const paidAmount   = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.amount, 0);

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

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Period selector */}
        <div className="relative">
          <select
            id="spp-period-select"
            value={period}
            onChange={(e) => loadPeriod(e.target.value)}
            className="appearance-none bg-muted border border-border rounded-xl px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {availablePeriods.map((p) => (
              <option key={p} value={p}>{p}</option>
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

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {(["ALL", "PAID", "UNPAID", "FAILED", "OVERDUE"] as const).map((s) => (
            <button
              key={s}
              id={`spp-filter-${s}`}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                filterStatus === s
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
    </div>
  );
}
