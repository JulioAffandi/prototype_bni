"use client";

import { useState, useEffect } from "react";
import { X, Nfc, User, Phone, CreditCard, Loader2, CheckCircle2, UserCheck } from "lucide-react";

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
  const [rawNfcUid, setRawNfcUid] = useState("");
  
  // Parent state
  const [parentMode, setParentMode] = useState<"select" | "input">("select");
  const [parentsList, setParentsList] = useState<ParentItem[]>([]);
  const [selectedParentId, setSelectedParentId] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentBniAccount, setParentBniAccount] = useState("");
  
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
        raw_nfc_uid: rawNfcUid.trim(),
        nfc_uid_last4: rawNfcUid.trim().slice(-4),
        parent_id: parentMode === "select" && selectedParentId ? selectedParentId : undefined,
        parent_phone: parentMode === "input" && parentPhone.trim() ? parentPhone.trim() : undefined,
        parent_full_name: parentMode === "input" && parentName.trim() ? parentName.trim() : undefined,
        parent_bni_account: parentBniAccount.trim() || undefined,
        relationship: "orang_tua",
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
        if (res.status === 409) throw new Error("UID kartu ini sudah terdaftar untuk siswa lain.");
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
                    Nama Lengkap Siswa
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="student-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Contoh: Akbar Pratama"
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                    />
                  </div>
                </div>

                {/* NFC UID */}
                <div>
                  <label htmlFor="nfc-uid" className="block text-sm font-medium text-foreground mb-1.5">
                    UID Kartu NFC
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
                      onChange={(e) => setRawNfcUid(e.target.value)}
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
                          Belum ada orang tua terdaftar. Klik tab "HP Baru" di samping.
                        </p>
                      ) : (
                        <select
                          value={selectedParentId}
                          onChange={(e) => setSelectedParentId(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm cursor-pointer"
                        >
                          <option value="" className="bg-slate-900 text-slate-100 dark:bg-zinc-900 dark:text-zinc-100">
                            -- Pilih Orang Tua / Wali (Opsional) --
                          </option>
                          {parentsList.map((p) => (
                            <option
                              key={p.id}
                              value={p.id}
                              className="bg-slate-900 text-slate-100 dark:bg-zinc-900 dark:text-zinc-100 py-1"
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
                            onChange={(e) => setParentPhone(e.target.value)}
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
                            onChange={(e) => setParentName(e.target.value)}
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
                  <p className="text-sm text-destructive bg-destructive/10 border border-destructive/25 rounded-xl px-3.5 py-2.5 font-medium">
                    {error}
                  </p>
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
