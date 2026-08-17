"use client";

import { useMemo, useState, useEffect } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  UtensilsCrossed,
  ShoppingBag,
  Printer,
  ScanLine,
  History,
  Lock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { formatRupiah } from "@/lib/format";
import DigitalKtaCard from "./DigitalKtaCard";

export interface KtaStudentData {
  id: string;
  fullName: string;
  studentNumber: string;
  schoolName: string;
  gradeClass: string;
  dailyLimit: number;
  emergencyLimit: number;
  emergencyApprove: boolean;
  cardStatus: string;
  cardLast4: string;
}

// Backward-compatibility alias
export type StudentCardInfo = KtaStudentData;

interface NfcCardClientProps {
  initialStudents?: KtaStudentData[];
  cards?: any[];
}

export default function NfcCardClient({ initialStudents, cards }: NfcCardClientProps) {
  // Normalize students array supporting both props
  const studentsList: KtaStudentData[] = useMemo(() => {
    if (initialStudents && initialStudents.length > 0) {
      return initialStudents;
    }
    if (cards && cards.length > 0) {
      return cards.map((c: any) => ({
        id: c.studentId || c.id,
        fullName: c.studentName || c.fullName,
        studentNumber: c.studentNumber || "20261001",
        schoolName: c.schoolName || "SMA BNI Harapan Bangsa",
        gradeClass: c.gradeClass || "",
        dailyLimit: Number(c.dailyLimit) || 25000,
        emergencyLimit: Number(c.emergencyLimit) || 15000,
        emergencyApprove: Boolean(c.emergencyApprove ?? true),
        cardStatus: c.cardStatus || (c.isActive === false ? "BLOCKED" : "ACTIVE"),
        cardLast4: c.cardUid || c.cardLast4 || "**** **** **** 8E01",
      }));
    }
    return [];
  }, [initialStudents, cards]);

  const [selectedId, setSelectedId] = useState<string>(studentsList[0]?.id ?? "");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const selectedStudent = useMemo(
    () => studentsList.find((s) => s.id === selectedId) ?? studentsList[0],
    [studentsList, selectedId]
  );

  const isInitialLocked = Boolean(
    selectedStudent?.cardStatus &&
      ["BLOCKED", "LOCKED", "LOST_REPORTED", "RETIRED"].includes(
        selectedStudent.cardStatus.toUpperCase()
      )
  );

  const [isLocked, setIsLocked] = useState(isInitialLocked);
  const [isTogglingLock, setIsTogglingLock] = useState(false);

  // Sync isLocked state when switching student
  useEffect(() => {
    if (selectedStudent) {
      const locked = ["BLOCKED", "LOCKED", "LOST_REPORTED", "RETIRED"].includes(
        (selectedStudent.cardStatus || "").toUpperCase()
      );
      setIsLocked(locked);
    }
  }, [selectedStudent?.id, selectedStudent?.cardStatus]);

  if (!selectedStudent) {
    return (
      <div className="rounded-2xl border border-portal-border bg-portal-surface p-6 text-center text-sm text-portal-muted shadow-portal-card">
        Belum ada anak yang terhubung dengan akun Anda.
      </div>
    );
  }

  async function handleToggleLock() {
    if (!selectedStudent) return;
    const next = !isLocked;
    setIsTogglingLock(true);
    setIsLocked(next); // optimistic update

    try {
      const res = await fetch(`/api/v1/students/${selectedStudent.id}/card/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_locked: next }),
      });

      if (!res.ok) {
        throw new Error("Gagal memperbarui status kartu");
      }

      const data = await res.json();
      selectedStudent.cardStatus = data.status || (next ? "BLOCKED" : "ACTIVE");

      setToastMessage(
        next
          ? `Kartu ${selectedStudent.fullName} berhasil dikunci sementara.`
          : `Kartu ${selectedStudent.fullName} kembali aktif.`
      );
      setTimeout(() => setToastMessage(null), 3500);
    } catch {
      setIsLocked(!next); // rollback
      setToastMessage("Gagal memperbarui status kartu di server. Silakan coba lagi.");
      setTimeout(() => setToastMessage(null), 3500);
    } finally {
      setIsTogglingLock(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-700 shadow-sm animate-in fade-in">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Child selector — hanya tampil kalau anak lebih dari 1 */}
      {studentsList.length > 1 && (
        <div className="relative">
          <select
            value={selectedStudent.id}
            onChange={(e) => setSelectedId(e.target.value)}
            aria-label="Pilih anak"
            className="w-full appearance-none rounded-xl border border-portal-border bg-portal-surface px-4 py-2.5 pr-10 text-sm font-semibold text-portal-text shadow-portal-card focus:outline-none focus:ring-2 focus:ring-portal-primary/30 cursor-pointer"
          >
            {studentsList.map((s) => (
              <option key={s.id} value={s.id} className="bg-portal-surface text-portal-text">
                {s.fullName} {s.gradeClass ? `— ${s.gradeClass}` : ""}
              </option>
            ))}
          </select>
          <ChevronDown
            size={18}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-portal-muted"
          />
        </div>
      )}

      {/* Kartu digital */}
      <div className="flex justify-center">
        <DigitalKtaCard
          studentName={selectedStudent.fullName}
          schoolName={selectedStudent.schoolName}
          studentNumber={selectedStudent.studentNumber}
          cardLast4={selectedStudent.cardLast4}
        />
      </div>

      {(isLocked || selectedStudent.cardStatus?.toUpperCase() !== "ACTIVE") && (
        <div className="flex items-center gap-2 rounded-xl border border-portal-danger/30 bg-portal-danger/10 px-4 py-2.5 text-xs font-medium text-portal-danger">
          <AlertTriangle size={16} className="shrink-0" />
          <span>
            Status kartu saat ini:{" "}
            <strong>{isLocked ? "BLOCKED (Terkunci)" : selectedStudent.cardStatus}</strong>
          </span>
        </div>
      )}

      {/* 2. Program level & allowance status */}
      <section className="rounded-2xl border border-portal-border bg-portal-surface p-4 shadow-portal-card">
        <h2 className="mb-3 text-sm font-bold text-portal-text">Status Program &amp; Pagu</h2>
        <div className="divide-y divide-portal-border">
          <StatusRow
            label="Pagu Jajan Harian"
            value={`${formatRupiah(selectedStudent.dailyLimit)} / hari`}
            active
          />
          <StatusRow
            label="Emergency Overdraft Protection"
            value={formatRupiah(selectedStudent.emergencyLimit)}
            active={selectedStudent.emergencyApprove}
          />
          <StatusRow label="Student Vault Auto-Save" value="23:59 WIB Otomatis" active />
        </div>
      </section>

      {/* 3. Ecosystem penerimaan sekolah */}
      <section className="rounded-2xl border border-portal-border bg-portal-surface p-4 shadow-portal-card">
        <h2 className="mb-3 text-sm font-bold text-portal-text">Ekosistem Penerimaan Sekolah</h2>
        <div className="grid grid-cols-2 gap-3">
          <EcosystemTile icon={UtensilsCrossed} label="Kantin Sekolah" desc="12 Stand Terhubung" />
          <EcosystemTile icon={ShoppingBag} label="Koperasi & Seragam" desc="3 Toko Retail Siswa" />
          <EcosystemTile icon={Printer} label="Layanan Sekolah" desc="Perpustakaan & Fotokopi" />
          <EcosystemTile icon={ScanLine} label="Akses Gerbang" desc="KTA Tap Masuk Sekolah" />
        </div>
      </section>

      {/* 4. Card management & safety controls */}
      <section className="overflow-hidden rounded-2xl border border-portal-border bg-portal-surface shadow-portal-card">
        <Link
          href={`/kartu/riwayat?studentId=${selectedStudent.id}`}
          className="flex items-center justify-between border-b border-portal-border px-4 py-3.5 transition-colors hover:bg-portal-surface-alt active:bg-portal-surface-alt"
        >
          <div className="flex items-center gap-3">
            <History size={18} className="text-portal-primary" />
            <span className="text-sm font-medium text-portal-text">
              Lihat Riwayat Transaksi Tap Kartu
            </span>
          </div>
          <ChevronRight size={18} className="text-portal-muted" />
        </Link>

        <div className="flex items-center justify-between border-b border-portal-border px-4 py-3.5">
          <div className="flex items-center gap-3">
            <Lock size={18} className="text-portal-primary" />
            <div>
              <p className="text-sm font-medium text-portal-text">Kunci Sementara Kartu</p>
              <p className="text-[11px] text-portal-muted">Nonaktifkan tap kartu seketika</p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isLocked}
            aria-label="Kunci sementara kartu"
            disabled={isTogglingLock}
            onClick={handleToggleLock}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
              isLocked ? "bg-portal-primary" : "bg-slate-300 dark:bg-portal-border"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                isLocked ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        <Link
          href={`/kartu/lapor-hilang?studentId=${selectedStudent.id}`}
          className="flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-portal-surface-alt active:bg-portal-surface-alt"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-portal-danger" />
            <span className="text-sm font-medium text-portal-danger">
              Laporkan Kartu Hilang / Rusak
            </span>
          </div>
          <ChevronRight size={18} className="text-portal-muted" />
        </Link>
      </section>
    </div>
  );
}

function StatusRow({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div>
        <p className="text-xs text-portal-muted">{label}</p>
        <p className="text-sm font-semibold text-portal-text">{value}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          active
            ? "bg-portal-success/10 text-portal-success"
            : "bg-portal-muted/10 text-portal-muted"
        }`}
      >
        {active ? "Aktif" : "Nonaktif"}
      </span>
    </div>
  );
}

function EcosystemTile({
  icon: Icon,
  label,
  desc,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl bg-portal-surface-alt p-3">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-portal-primary/10">
        <Icon size={16} className="text-portal-primary" />
      </div>
      <p className="text-xs font-semibold leading-tight text-portal-text">{label}</p>
      <p className="mt-0.5 text-[10px] leading-tight text-portal-muted">{desc}</p>
    </div>
  );
}
