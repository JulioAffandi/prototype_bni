"use client";

import { useState } from "react";
import { X, Nfc, User, CheckCircle2, AlertTriangle } from "lucide-react";

export interface NewStudentResponse {
  id: string;
  full_name: string;
  nfc_uid_last4: string;
  card_status: "active" | "lost_reported" | "blocked" | "graduated" | "transferred_out";
  daily_limit: number;
  daily_limit_used: number;
  emergency_approve: boolean;
  emergency_overdraft_count_7d: number;
  created_at: string;
  parent?: {
    id: string;
    full_name: string;
    phone_number: string;
    relationship?: string;
  } | null;
}

interface StudentUIDBindingModalProps {
  schoolId: string;
  onClose: () => void;
  onSuccess: (student: NewStudentResponse) => void;
}

export default function StudentUIDBindingModal({ schoolId, onClose, onSuccess }: StudentUIDBindingModalProps) {
  const [step, setStep] = useState<"form" | "success">("form");
  const [fullName, setFullName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gradeLevel, setGradeLevel] = useState("7");
  const [className, setClassName] = useState("7A");
  const [dailyLimit, setDailyLimit] = useState(20000);
  const [rawNfcUid, setRawNfcUid] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdStudent, setCreatedStudent] = useState<NewStudentResponse | null>(null);

  const simulatorEnabled = process.env.NEXT_PUBLIC_NFC_SIMULATOR_ENABLED === "true";

  function clearErrorOnInput() {
    if (error) setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !rawNfcUid.trim()) {
      setError("Nama siswa dan UID kartu NFC wajib diisi.");
      return;
    }

    if (rawNfcUid.trim().length < 4) {
      setError("UID Kartu NFC harus minimal 4 karakter (misalnya: 0013 atau 1234).");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        student_number: studentNumber.trim() || undefined,
        date_of_birth: dateOfBirth || undefined,
        grade_level: gradeLevel,
        class_name: className.trim(),
        class_label: `Kelas ${gradeLevel} ${className.trim()}`.trim(),
        daily_limit: Number(dailyLimit) || 20000,
        raw_nfc_uid: rawNfcUid.trim(),
        nfc_uid_last4: rawNfcUid.trim().slice(-4),
      };

      const res = await fetch(`/api/v1/schools/${schoolId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json() as {
        student?: NewStudentResponse;
        error?: string;
        message?: string;
      };

      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? "Gagal mendaftarkan siswa");
      }

      const st = data.student!;
      setCreatedStudent(st);
      setStep("success");

      setTimeout(() => {
        onSuccess(st);
      }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
              <Nfc className="w-4 h-4 text-primary" />
            </div>
            <h2 className="font-bold text-base text-foreground">Daftarkan Siswa Baru</h2>
          </div>
          <button
            id="modal-close-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {step === "success" ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-bold text-lg text-foreground">Siswa Berhasil Didaftarkan</h3>
              <p className="text-sm text-muted-foreground">
                Kartu NFC <strong className="text-foreground">{createdStudent?.full_name}</strong> telah aktif.
              </p>
              <p className="text-xs text-muted-foreground bg-muted/60 p-3 rounded-xl border border-border/80 leading-relaxed">
                Relasi Orang Tua / Wali akan terhubung secara otomatis saat orang tua melakukan Klaim 3-Faktor di Parent App.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 1. Name */}
              <div>
                <label htmlFor="student-name" className="block text-sm font-medium text-foreground mb-1.5">
                  Nama Lengkap Siswa <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="student-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      clearErrorOnInput();
                    }}
                    placeholder="Contoh: Akbar Pratama"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                  />
                </div>
              </div>

              {/* 2. NISN & 3. DOB */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="student-nisn" className="block text-xs font-medium text-foreground mb-1">
                    NISN / No. Induk <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="student-nisn"
                    type="text"
                    value={studentNumber}
                    onChange={(e) => {
                      setStudentNumber(e.target.value);
                      clearErrorOnInput();
                    }}
                    placeholder="Contoh: 0051234567"
                    required
                    className="w-full px-3 py-2 rounded-xl bg-background text-foreground border border-border/80 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                  />
                </div>

                <div>
                  <label htmlFor="student-dob" className="block text-xs font-medium text-foreground mb-1">
                    Tanggal Lahir (Verifikasi Wali) <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="student-dob"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => {
                      setDateOfBirth(e.target.value);
                      clearErrorOnInput();
                    }}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-background text-foreground border border-border/80 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                  />
                </div>
              </div>

              {/* 4. Grade & Class */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Tingkat &amp; Kelas <span className="text-destructive">*</span>
                </label>
                <div className="flex gap-1.5">
                  <select
                    id="student-grade"
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    className="w-16 px-2 py-2 rounded-xl bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100 border border-slate-700 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                      <option key={g} value={String(g)} className="bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100">
                        {g}
                      </option>
                    ))}
                  </select>
                  <input
                    id="student-class"
                    type="text"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="Nama (7A)"
                    required
                    className="flex-1 px-3 py-2 rounded-xl bg-background text-foreground border border-border/80 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                  />
                </div>
              </div>

              {/* 5. Daily Limit */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="daily-limit" className="block text-xs font-medium text-foreground">
                    Batas Pagu Harian Default
                  </label>
                  <span className="text-xs font-bold text-primary">
                    Rp {new Intl.NumberFormat("id-ID").format(dailyLimit)}
                  </span>
                </div>
                <input
                  id="daily-limit"
                  type="number"
                  step={1000}
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-background text-foreground border border-border/80 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm mb-2"
                />
                <div className="flex gap-2">
                  {[15000, 20000, 30000, 50000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDailyLimit(preset)}
                      className={`flex-1 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                        dailyLimit === preset
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 text-muted-foreground border-border/60 hover:text-foreground"
                      }`}
                    >
                      Rp {(preset / 1000).toLocaleString("id-ID")}k
                    </button>
                  ))}
                </div>
              </div>

              {/* 6. NFC Card UID */}
              <div>
                <label htmlFor="nfc-uid" className="block text-sm font-medium text-foreground mb-1.5">
                  UID Kartu NFC <span className="text-destructive">*</span>
                  {simulatorEnabled && (
                    <span className="ml-2 text-xs text-accent font-normal">(Simulator aktif)</span>
                  )}
                </label>
                <div className="relative">
                  <Nfc className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="nfc-uid"
                    type="text"
                    value={rawNfcUid}
                    onChange={(e) => {
                      setRawNfcUid(e.target.value);
                      clearErrorOnInput();
                    }}
                    placeholder={simulatorEnabled ? "Masukkan UID manual (demo)" : "Tempelkan kartu ke reader..."}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  UID akan di-hash (SHA-256) dan tidak disimpan dalam bentuk asli. Ref: §11.2
                </p>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs font-semibold flex items-start gap-2.5 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Gagal Mendaftarkan Siswa</p>
                    <p className="mt-0.5 text-destructive/90 font-normal leading-relaxed">{error}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition-all shadow-sm"
                >
                  Batal
                </button>
                <button
                  id="submit-student-btn"
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? "Mendaftarkan..." : "Daftarkan Siswa"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
