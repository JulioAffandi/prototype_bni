"use client";

import { useState, useEffect } from "react";
import { X, Nfc, User, Phone, CreditCard, Loader2, CheckCircle2, UserCheck, AlertTriangle } from "lucide-react";

interface ParentItem {
  id: string;
  full_name: string;
  phone_number: string;
  bni_account_number: string;
}

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
  const [step, setStep] = useState<"form" | "nfc" | "success">("form");
  const [fullName, setFullName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gradeLevel, setGradeLevel] = useState("7");
  const [className, setClassName] = useState("7A");
  const [dailyLimit, setDailyLimit] = useState(20000);
  const [rawNfcUid, setRawNfcUid] = useState("");
  
  // Parent state
  const [parentMode, setParentMode] = useState<"select" | "input">("select");
  const [parentsList, setParentsList] = useState<ParentItem[]>([]);
  const [selectedParentId, setSelectedParentId] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentBniAccount, setParentBniAccount] = useState("");
  const [relationship, setRelationship] = useState("orang_tua");
  
  const [loading, setLoading] = useState(false);
  const [fetchingParents, setFetchingParents] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createdStudent, setCreatedStudent] = useState<NewStudentResponse | null>(null);

  const simulatorEnabled = process.env.NEXT_PUBLIC_NFC_SIMULATOR_ENABLED === "true";

  useEffect(() => {
    async function loadParents() {
      try {
        const res = await fetch(`/api/v1/schools/${schoolId}/parents`);
        if (res.ok) {
          const data = await res.json() as { parents: ParentItem[] };
          setParentsList(data.parents || []);
        }
      } catch (err) {
        console.error("Failed to load parents", err);
      } finally {
        setFetchingParents(false);
      }
    }
    loadParents();
  }, [schoolId]);

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
        parent_id: parentMode === "select" && selectedParentId ? selectedParentId : undefined,
        parent_phone: parentMode === "input" && parentPhone.trim() ? parentPhone.trim() : undefined,
        parent_full_name: parentMode === "input" && parentName.trim() ? parentName.trim() : undefined,
        parent_bni_account: parentBniAccount.trim() || undefined,
        relationship: relationship || "orang_tua",
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
    <>
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
                <h3 className="font-bold text-lg text-foreground">Siswa & Wali Berhasil Didaftarkan</h3>
                <p className="text-sm text-muted-foreground">
                  Kartu NFC <strong className="text-foreground">{createdStudent?.full_name}</strong> telah aktif.
                </p>
                {createdStudent?.parent ? (
                  <div className="p-3.5 bg-muted/60 rounded-xl border border-border/80 text-xs text-left">
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-primary" />
                      Wali Terhubung: {createdStudent.parent.full_name}
                    </p>
                    <p className="text-muted-foreground font-mono mt-0.5 ml-5">
                      No. HP: {createdStudent.parent.phone_number}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-lg inline-block font-medium">
                    Belum terhubung ke Wali (Dapat dihubungkan di tabel)
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
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

                {/* NISN, DOB & Class */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="student-nisn" className="block text-xs font-medium text-foreground mb-1">
                      NISN / No. Induk
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
                      className="w-full px-3 py-2 rounded-xl bg-background text-foreground border border-border/80 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="student-dob" className="block text-xs font-medium text-foreground mb-1">
                      Tanggal Lahir (Verifikasi Wali)
                    </label>
                    <input
                      id="student-dob"
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => {
                        setDateOfBirth(e.target.value);
                        clearErrorOnInput();
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-background text-foreground border border-border/80 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Tingkat &amp; Kelas
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
                        className="flex-1 px-3 py-2 rounded-xl bg-background text-foreground border border-border/80 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                      />
                    </div>
                  </div>

                {/* Daily Limit */}
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

                {/* NFC UID */}
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

                {/* Parent / Guardian Section */}
                <div className="border-t border-border/80 pt-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">Orang Tua / Wali Siswa</label>
                    <div className="flex bg-muted/80 p-0.5 rounded-lg gap-0.5 text-[11px] border border-border/50">
                      <button
                        type="button"
                        onClick={() => setParentMode("select")}
                        className={`px-2.5 py-1 rounded-md transition-all font-semibold ${
                          parentMode === "select"
                            ? "bg-primary text-primary-foreground shadow-sm font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Pilih Terdaftar
                      </button>
                      <button
                        type="button"
                        onClick={() => setParentMode("input")}
                        className={`px-2.5 py-1 rounded-md transition-all font-semibold ${
                          parentMode === "input"
                            ? "bg-primary text-primary-foreground shadow-sm font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        HP Baru
                      </button>
                    </div>
                  </div>

                  {parentMode === "select" ? (
                    <div>
                      {fetchingParents ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 bg-background border border-border/60 rounded-xl">
                          <Loader2 className="w-4 h-4 animate-spin text-primary" /> Memuat data orang tua...
                        </div>
                      ) : parentsList.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-3 bg-muted/50 border border-border/60 rounded-xl">
                          Belum ada orang tua terdaftar. Klik tab &quot;HP Baru&quot; di samping.
                        </p>
                      ) : (
                        <select
                          value={selectedParentId}
                          onChange={(e) => {
                            setSelectedParentId(e.target.value);
                            clearErrorOnInput();
                          }}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100 border border-slate-700 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm cursor-pointer"
                        >
                          <option value="" className="bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100">
                            -- Pilih Orang Tua / Wali (Opsional) --
                          </option>
                          {parentsList.map((p) => (
                            <option
                              key={p.id}
                              value={p.id}
                              className="bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100 py-1"
                            >
                              {p.full_name} ({p.phone_number})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <div className="relative">
                          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            id="parent-phone"
                            type="tel"
                            value={parentPhone}
                            onChange={(e) => {
                              setParentPhone(e.target.value);
                              clearErrorOnInput();
                            }}
                            placeholder="No. HP Orang Tua (e.g. 08123456789)"
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="relative">
                          <UserCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            type="text"
                            value={parentName}
                            onChange={(e) => {
                              setParentName(e.target.value);
                              clearErrorOnInput();
                            }}
                            placeholder={`Nama Orang Tua (e.g. Wali dari ${fullName || "Siswa"})`}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="relative">
                          <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <input
                            id="parent-bni"
                            type="text"
                            value={parentBniAccount}
                            onChange={(e) => setParentBniAccount(e.target.value)}
                            placeholder="Rekening BNI Orang Tua (Opsional)"
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                          />
                        </div>
                      </div>
                    </div>
                  )}
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
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Mendaftarkan...
                      </>
                    ) : (
                      "Daftarkan Siswa"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
