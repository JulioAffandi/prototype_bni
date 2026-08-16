"use client";

import { useState } from "react";
import type { PayrollRecord, PayrollBreakdownDetails } from "@/types/institution";
import {
  Wallet,
  CheckCircle2,
  Clock,
  Printer,
  ShieldCheck,
  Send,
  AlertCircle,
  FileText,
  X,
} from "lucide-react";

interface PayrollBatchTableProps {
  schoolId: string;
  initialPeriod: string;
  initialRoster: PayrollRecord[];
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function PayrollBatchTable({
  schoolId,
  initialPeriod,
  initialRoster,
}: PayrollBatchTableProps) {
  const [period, setPeriod] = useState(initialPeriod);
  const [roster, setRoster] = useState<PayrollRecord[]>(initialRoster);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<PayrollRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const pendingCount = roster.filter((r) => r.status === "PENDING").length;
  const pendingTotal = roster
    .filter((r) => r.status === "PENDING")
    .reduce((sum, r) => sum + r.net_salary, 0);

  const handlePeriodChange = async (newPeriod: string) => {
    setPeriod(newPeriod);
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/schools/${schoolId}/payroll?period=${newPeriod}`);
      if (res.ok) {
        const json = await res.json();
        setRoster(json.roster ?? []);
      }
    } catch {
      setToastMessage({ type: "error", text: "Gagal memuat roster payroll." });
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteBatch = async () => {
    setExecuting(true);
    const idempotencyKey = crypto.randomUUID();

    try {
      const res = await fetch(`/api/v1/schools/${schoolId}/payroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period,
          idempotency_key: idempotencyKey,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setToastMessage({ type: "error", text: json.detail || json.error || "Gagal mengeksekusi disbursement payroll." });
      } else {
        setToastMessage({
          type: "success",
          text: `Berhasil mencairkan gaji ${json.staff_disbursed} staf sejumlah ${formatRupiah(json.total_amount)} via BNI H2H.`,
        });
        // Refresh roster
        handlePeriodChange(period);
      }
    } catch {
      setToastMessage({ type: "error", text: "Terjadi kesalahan jaringan saat eksekusi batch." });
    } finally {
      setExecuting(false);
      setShowConfirmModal(false);
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

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass p-5 rounded-2xl">
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-portal-text">Periode Payroll:</label>
          <input
            type="month"
            value={period}
            onChange={(e) => handlePeriodChange(e.target.value)}
            className="rounded-portal border border-portal-border bg-portal-surface px-3 py-1.5 text-xs text-portal-text focus:outline-none focus:ring-2 focus:ring-portal-primary"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="text-right hidden sm:block">
            <p className="text-[11px] text-portal-muted">Pending Disbursement</p>
            <p className="text-sm font-bold text-portal-primary">{pendingCount} Staf · {formatRupiah(pendingTotal)}</p>
          </div>

          <button
            type="button"
            disabled={pendingCount === 0 || executing}
            onClick={() => setShowConfirmModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-portal bg-portal-primary px-4 py-2 text-xs font-semibold text-portal-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Send className="w-4 h-4" />
            <span>Eksekusi Batch BNI H2H</span>
          </button>
        </div>
      </div>

      {/* Roster Table */}
      <div className="glass rounded-2xl overflow-hidden border border-portal-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-portal-surface-alt border-b border-portal-border text-portal-muted">
              <tr>
                <th className="p-3.5 font-semibold">Nama Staf &amp; Position</th>
                <th className="p-3.5 font-semibold">NIP / Rekening BNI</th>
                <th className="p-3.5 font-semibold text-right">Gaji Pokok</th>
                <th className="p-3.5 font-semibold text-right">Tunjangan</th>
                <th className="p-3.5 font-semibold text-right">Potongan (PPh/BPJS)</th>
                <th className="p-3.5 font-semibold text-right">Gaji Bersih (THP)</th>
                <th className="p-3.5 font-semibold text-center">Status</th>
                <th className="p-3.5 font-semibold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-portal-border/50 text-portal-text">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-portal-muted">
                    Memuat roster payroll...
                  </td>
                </tr>
              ) : roster.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-portal-muted">
                    Belum ada data roster payroll untuk periode {period}.
                  </td>
                </tr>
              ) : (
                roster.map((item) => (
                  <tr key={item.id} className="hover:bg-portal-surface-alt/40 transition-colors">
                    <td className="p-3.5">
                      <p className="font-semibold text-portal-text">{item.staff_name}</p>
                      <p className="text-[11px] text-portal-muted">{item.position}</p>
                    </td>
                    <td className="p-3.5">
                      <p className="font-mono text-portal-text">{item.bni_account_number}</p>
                      <p className="text-[11px] text-portal-muted">{item.bni_account_name}</p>
                    </td>
                    <td className="p-3.5 text-right font-medium">{formatRupiah(item.basic_salary)}</td>
                    <td className="p-3.5 text-right text-emerald-500 font-medium">+{formatRupiah(item.allowances)}</td>
                    <td className="p-3.5 text-right text-destructive font-medium">-{formatRupiah(item.deductions)}</td>
                    <td className="p-3.5 text-right font-bold text-portal-primary">{formatRupiah(item.net_salary)}</td>
                    <td className="p-3.5 text-center">
                      {item.status === "DISBURSED" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>DISBURSED</span>
                        </span>
                      ) : item.status === "PENDING" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                          <Clock className="w-3 h-3" />
                          <span>PENDING</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-destructive/15 text-destructive border border-destructive/30">
                          <AlertCircle className="w-3 h-3" />
                          <span>{item.status}</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedPayslip(item)}
                        className="inline-flex items-center gap-1 rounded-portal border border-portal-border px-2.5 py-1 text-[11px] font-medium text-portal-muted hover:text-portal-text hover:bg-portal-surface-alt transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Slip Gaji</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Batch Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-6 max-w-md w-full space-y-4 border border-portal-border">
            <div className="flex items-center gap-3 text-portal-primary">
              <div className="w-10 h-10 rounded-xl bg-portal-primary/15 flex items-center justify-center">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-portal-text">Konfirmasi Batch Disbursement</h3>
                <p className="text-xs text-portal-muted">Eksekusi H2H BNI Payroll Stream</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-portal-surface-alt space-y-2 border border-portal-border text-xs">
              <div className="flex justify-between">
                <span className="text-portal-muted">Periode:</span>
                <span className="font-bold text-portal-text">{period}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-portal-muted">Jumlah Staf Pending:</span>
                <span className="font-bold text-portal-text">{pendingCount} Staf</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-portal-border">
                <span className="text-portal-muted">Total Dana Disbursed:</span>
                <span className="font-bold text-portal-primary text-sm">{formatRupiah(pendingTotal)}</span>
              </div>
            </div>

            <p className="text-[11px] text-portal-muted">
              Dana akan didebit dari Rekening Giro Escrow Sekolah dan disalurkan secara otomatis ke masing-masing rekening BNI penerima. Transaksi ini tidak dapat dibatalkan.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={executing}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-portal border border-portal-border text-xs font-semibold text-portal-muted hover:text-portal-text"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={executing}
                onClick={handleExecuteBatch}
                className="flex items-center gap-2 px-4 py-2 rounded-portal bg-portal-primary text-xs font-semibold text-portal-primary-foreground hover:opacity-90 transition-opacity"
              >
                {executing ? "Memproses..." : "Ya, Eksekusi Sekarang"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payslip Details Modal */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-portal-surface text-portal-text rounded-2xl p-6 max-w-lg w-full space-y-5 border border-portal-border shadow-2xl">
            <div className="flex items-start justify-between border-b border-portal-border pb-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-portal-muted">VALO School · Slip Gaji Digital</p>
                <h3 className="text-lg font-bold text-portal-text">{selectedPayslip.staff_name}</h3>
                <p className="text-xs text-portal-muted">{selectedPayslip.position} · NIP: {selectedPayslip.nip || "-"}</p>
              </div>
              <button onClick={() => setSelectedPayslip(null)} className="p-1 text-portal-muted hover:text-portal-text">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-portal-border/50">
                <span className="text-portal-muted">Periode Gaji:</span>
                <span className="font-semibold text-portal-text">{selectedPayslip.period}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-portal-border/50">
                <span className="text-portal-muted">Rekening BNI Penerima:</span>
                <span className="font-mono text-portal-text">{selectedPayslip.bni_account_number} ({selectedPayslip.bni_account_name})</span>
              </div>

              {/* Salary Components */}
              <div className="space-y-1.5 pt-2">
                <p className="font-bold text-portal-text">Komponen Penghasilan:</p>
                <div className="flex justify-between pl-2 text-portal-muted">
                  <span>Gaji Pokok</span>
                  <span className="font-medium text-portal-text">{formatRupiah(selectedPayslip.basic_salary)}</span>
                </div>
                {selectedPayslip.breakdown_details?.allowance_items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between pl-2 text-portal-muted">
                    <span>{item.name}</span>
                    <span className="font-medium text-emerald-500">+{formatRupiah(item.amount)}</span>
                  </div>
                ))}
              </div>

              {/* Deductions Breakdown (PPh 21, BPJS) */}
              <div className="space-y-1.5 pt-2">
                <p className="font-bold text-portal-text">Potongan Pajak &amp; Asuransi:</p>
                {selectedPayslip.breakdown_details?.deduction_items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between pl-2 text-portal-muted">
                    <span>{item.name}</span>
                    <span className="font-medium text-destructive">-{formatRupiah(item.amount)}</span>
                  </div>
                ))}
              </div>

              {/* Total THP */}
              <div className="flex justify-between items-center p-3 rounded-xl bg-portal-surface-alt border border-portal-border text-sm font-bold pt-3">
                <span>Take Home Pay (THP)</span>
                <span className="text-portal-primary text-base">{formatRupiah(selectedPayslip.net_salary)}</span>
              </div>

              {selectedPayslip.bni_h2h_reference && (
                <div className="flex items-center gap-2 pt-2 text-[11px] text-emerald-500">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verified BNI H2H Ref: {selectedPayslip.bni_h2h_reference}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-portal-border">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 rounded-portal border border-portal-border text-xs font-semibold text-portal-text hover:bg-portal-surface-alt transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Slip Gaji</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
