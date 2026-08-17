"use client";

import { useState } from "react";
import {
  Shield,
  CreditCard,
  Sparkles,
  Check,
  Building2,
  ChevronDown,
  User,
  AlertCircle,
  ArrowRight,
  Sliders,
} from "lucide-react";
import Link from "next/link";
import { formatRupiah } from "@/lib/format";

export interface StudentPaguData {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  fullName: string;
  studentNumber: string;
  gradeClass: string;
  dailyLimit: number;
  dailyLimitUsed: number;
  emergencyLimit: number;
  emergencyApprove: boolean;
  cardStatus: string;
  cardLast4: string;
}

export default function PaguManagementClient({
  initialStudents,
}: {
  initialStudents: StudentPaguData[];
}) {
  const [students, setStudents] = useState<StudentPaguData[]>(initialStudents);
  const [selectedId, setSelectedId] = useState<string>(initialStudents[0]?.id || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (students.length === 0) {
    return (
      <div className="rounded-3xl border border-portal-border bg-portal-surface p-8 text-center space-y-2 shadow-portal-card">
        <p className="text-sm font-bold text-portal-text">Belum Ada Siswa Terhubung</p>
        <p className="text-xs text-portal-muted">Tautkan data siswa terlebih dahulu di menu Profil.</p>
      </div>
    );
  }

  const activeStudent = students.find((s) => s.id === selectedId) || students[0];
  const sisaPagu = Math.max(0, activeStudent.dailyLimit - activeStudent.dailyLimitUsed);
  const paguPercent =
    activeStudent.dailyLimit > 0
      ? Math.min(100, Math.round((activeStudent.dailyLimitUsed / activeStudent.dailyLimit) * 100))
      : 0;

  const handleLimitChange = (newLimit: number) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === activeStudent.id ? { ...s, dailyLimit: newLimit } : s))
    );
  };

  const handleToggleEmergency = async () => {
    const nextVal = !activeStudent.emergencyApprove;
    setStudents((prev) =>
      prev.map((s) =>
        s.id === activeStudent.id ? { ...s, emergencyApprove: nextVal } : s
      )
    );
    try {
      await fetch(`/api/v1/students/${activeStudent.id}/emergency-toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emergency_approve: nextVal }),
      });
    } catch (err) {
      console.error("Emergency toggle error:", err);
    }
  };

  const handleSavePagu = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/v1/students/${activeStudent.id}/pagu`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          daily_limit: activeStudent.dailyLimit,
        }),
      });
      if (!res.ok) {
        await fetch(`/api/v1/students/${activeStudent.id}/limit`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            daily_limit: activeStudent.dailyLimit,
            emergency_approve: activeStudent.emergencyApprove,
          }),
        });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error("Save pagu error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Child Selector Dropdown */}
      <div className="space-y-1.5">
        <label
          htmlFor="student-selector-dropdown"
          className="text-[11px] font-bold uppercase tracking-wider text-portal-muted flex items-center gap-1.5"
        >
          <User className="text-portal-primary" size={13} />
          Pilih Siswa / Anak
        </label>
        <div className="relative">
          <select
            id="student-selector-dropdown"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full appearance-none rounded-2xl border border-portal-border bg-portal-surface px-4 py-2.5 text-xs font-bold text-portal-text focus:border-portal-primary focus:outline-none focus:ring-2 focus:ring-portal-primary/20 pr-10 shadow-portal-card cursor-pointer"
          >
            {students.map((student) => (
              <option key={student.id} value={student.id} className="bg-white text-slate-900 py-1">
                {student.fullName} — {student.gradeClass ? `${student.gradeClass} • ` : ""}{student.schoolName}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-portal-muted">
            <ChevronDown size={16} />
          </div>
        </div>
      </div>

      {/* 2. Active Student Pagu Slider & Presets Card */}
      <div className="rounded-[1.75rem] border border-portal-border bg-portal-surface p-4 sm:p-5 space-y-4 shadow-portal-card">
        {/* Student School Header */}
        <div className="border-b border-portal-border pb-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-portal-text">{activeStudent.fullName}</h2>
            <span className="text-[10px] font-mono font-bold text-portal-primary bg-purple-50 border border-purple-100 px-2.5 py-0.5 rounded-lg">
              NISN: {activeStudent.studentNumber}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-portal-muted bg-portal-surface-alt px-3 py-1.5 rounded-xl border border-portal-border/60">
            <Building2 className="text-portal-primary shrink-0" size={13} />
            <span className="truncate font-semibold text-portal-text">{activeStudent.schoolName}</span>
            <span className="text-[10px] font-mono text-portal-muted ml-auto shrink-0">
              {activeStudent.schoolCode || "BNI-SCH"}
            </span>
          </div>
        </div>

        {/* Daily limit usage */}
        <div className="grid grid-cols-2 gap-2.5 bg-portal-surface-alt p-3.5 rounded-2xl border border-portal-border/60">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-portal-muted font-bold">
              Penggunaan Hari Ini
            </p>
            <p className="text-xs text-portal-text mt-0.5 font-medium">
              Terpakai: <span className="font-extrabold text-portal-text">{formatRupiah(activeStudent.dailyLimitUsed)}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-portal-muted font-bold">
              Sisa Pagu
            </p>
            <p className="text-xs font-extrabold text-emerald-600 mt-0.5">{formatRupiah(sisaPagu)}</p>
          </div>
        </div>

        {/* Interactive Limit Slider */}
        <div className="space-y-3.5 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-portal-muted flex items-center gap-1">
              <Sliders size={13} className="text-portal-primary" />
              Batas Pagu Baru:
            </span>
            <span className="text-lg font-black text-portal-primary">
              {formatRupiah(activeStudent.dailyLimit)}{" "}
              <span className="text-[11px] font-normal text-portal-muted">/ hari</span>
            </span>
          </div>

          <input
            id={`pagu-range-input-${activeStudent.id}`}
            type="range"
            min={5000}
            max={100000}
            step={5000}
            value={activeStudent.dailyLimit}
            onChange={(e) => handleLimitChange(Number(e.target.value))}
            className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#7357C7]"
          />

          {/* Quick preset chips */}
          <div className="grid grid-cols-3 gap-2">
            {[10000, 15000, 20000, 25000, 30000, 50000].map((amount) => (
              <button
                key={amount}
                id={`pagu-chip-${amount}`}
                type="button"
                onClick={() => handleLimitChange(amount)}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all ${
                  activeStudent.dailyLimit === amount
                    ? "bg-purple-50 border-portal-primary text-portal-primary shadow-sm"
                    : "bg-portal-surface-alt border-portal-border text-portal-muted hover:text-portal-text hover:bg-slate-100"
                }`}
              >
                {formatRupiah(amount)}
              </button>
            ))}
          </div>

          <p className="text-[11px] text-portal-muted bg-purple-50/60 p-3 rounded-2xl border border-purple-100 flex items-start gap-2">
            <Sparkles className="text-portal-primary shrink-0 mt-0.5" size={14} />
            <span>Sisa pagu harian yang tidak terpakai akan otomatis ditransfer ke tabungan Student Vault pada pukul 23:59 WIB.</span>
          </p>

          <button
            id={`pagu-save-btn-${activeStudent.id}`}
            type="button"
            onClick={handleSavePagu}
            disabled={isSaving}
            className="w-full py-3 rounded-2xl bg-portal-primary hover:opacity-95 text-white font-bold text-xs transition-all shadow-portal-glow disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
          >
            {saveSuccess ? (
              <>
                <Check size={16} /> Perubahan Pagu Tersimpan!
              </>
            ) : isSaving ? (
              "Menyimpan..."
            ) : (
              "Simpan Pagu Harian"
            )}
          </button>
        </div>
      </div>

      {/* 3. Emergency Overdraft Card */}
      <div className="rounded-[1.75rem] border border-portal-border bg-portal-surface p-4 sm:p-5 space-y-3 shadow-portal-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#F97316] flex items-center justify-center">
              <Shield size={16} />
            </div>
            <div>
              <span className="text-xs font-bold text-portal-text">Emergency Auto-Approval</span>
              <p className="text-[10px] text-portal-muted">Persetujuan Transaksi Darurat</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              id={`emergency-toggle-${activeStudent.id}`}
              type="checkbox"
              checked={activeStudent.emergencyApprove}
              onChange={handleToggleEmergency}
              className="sr-only peer"
            />
            <div className="w-10 h-5.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-[#7357C7]"></div>
          </label>
        </div>

        <div className="text-xs space-y-1.5 text-portal-muted bg-portal-surface-alt p-3 rounded-2xl border border-portal-border/60">
          <div className="flex justify-between">
            <span>Batas Overdraft Darurat:</span>
            <span className="font-extrabold text-portal-text">{formatRupiah(activeStudent.emergencyLimit)}</span>
          </div>
          <div className="flex justify-between">
            <span>Status Hari Ini:</span>
            <span className="text-emerald-600 font-bold">Tersedia &amp; Siap Pakai</span>
          </div>
        </div>
        <p className="text-[10.5px] text-portal-muted leading-relaxed">
          Berlaku maks. 1x per hari jika saldo pagu habis saat transaksi penting di kantin/koperasi sekolah.
        </p>
      </div>

      {/* 4. Direct Link to NFC Card Page */}
      <div className="rounded-[1.75rem] border border-portal-border bg-portal-surface p-4 sm:p-5 shadow-portal-card flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-50 text-portal-primary flex items-center justify-center">
            <CreditCard size={20} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-portal-text">Kartu Fisik NFC Siswa</h3>
            <p className="text-[11px] text-portal-muted font-mono">UID: {activeStudent.cardLast4}</p>
          </div>
        </div>

        <Link
          href="/kartu"
          className="flex items-center gap-1 px-3.5 py-2 rounded-xl bg-portal-primary/10 text-portal-primary text-xs font-bold hover:bg-portal-primary hover:text-white transition-all shadow-sm"
        >
          <span>Kelola</span>
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
