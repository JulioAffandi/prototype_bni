"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Hash, Calendar, Heart, Loader2, X, CheckCircle2, School, ShieldCheck } from "lucide-react";

interface PublicSchool {
  id: string;
  name: string;
  npsn: string | null;
  address: string | null;
}

interface ClaimStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ClaimStudentModal({
  isOpen,
  onClose,
  onSuccess,
}: ClaimStudentModalProps) {
  const router = useRouter();
  const [schools, setSchools] = useState<PublicSchool[]>([]);
  const [fetchingSchools, setFetchingSchools] = useState(true);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [manualNpsn, setManualNpsn] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [relationship, setRelationship] = useState("orang_tua");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    async function loadPublicSchools() {
      try {
        setFetchingSchools(true);
        const res = await fetch("/api/v1/schools/public-list");
        if (res.ok) {
          const data = await res.json() as { schools: PublicSchool[] };
          setSchools(data.schools || []);
          if (data.schools && data.schools.length > 0) {
            setSelectedSchoolId(data.schools[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch schools directory", err);
      } finally {
        setFetchingSchools(false);
      }
    }
    loadPublicSchools();
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    if (!studentNumber.trim() || !dateOfBirth) {
      setError("NISN dan Tanggal Lahir Siswa wajib diisi untuk verifikasi keamanan.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/v1/parents/link-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_id: selectedSchoolId || undefined,
          npsn: manualNpsn.trim() || undefined,
          student_number: studentNumber.trim(),
          date_of_birth: dateOfBirth,
          relationship,
        }),
      });

      const data = await res.json() as { success?: boolean; message?: string; student?: { full_name: string }; error?: string };

      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? "Gagal menghubungkan data siswa");
      }

      setSuccessMsg(data.message ?? `Berhasil terhubung dengan ${data.student?.full_name ?? "Siswa"}!`);
      setTimeout(() => {
        onClose();
        if (onSuccess) {
          onSuccess();
        }
        router.refresh();
        window.location.reload();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat klaim data siswa");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Hubungkan / Klaim Data Siswa</h3>
              <p className="text-xs text-muted-foreground">Verifikasi NISN &amp; Tanggal Lahir Siswa</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleLink} className="space-y-4">
          {/* Step 1: School Selection */}
          <div>
            <label htmlFor="claim-school" className="block text-xs font-semibold text-foreground mb-1">
              Step 1: Pilih Sekolah <span className="text-destructive">*</span>
            </label>
            {fetchingSchools ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-2.5 bg-background border border-border/60 rounded-xl">
                <Loader2 className="w-4 h-4 animate-spin text-primary" /> Memuat direktori sekolah...
              </div>
            ) : schools.length > 0 ? (
              <div className="space-y-1.5">
                <div className="relative">
                  <School className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
                  <select
                    id="claim-school"
                    value={selectedSchoolId}
                    onChange={(e) => setSelectedSchoolId(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100 border border-slate-700 dark:border-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer shadow-sm"
                  >
                    {schools.map((s) => (
                      <option key={s.id} value={s.id} className="bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100">
                        {s.name} {s.npsn ? `(NPSN: ${s.npsn})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <input
                type="text"
                value={manualNpsn}
                onChange={(e) => setManualNpsn(e.target.value)}
                placeholder="Masukkan NPSN / Kode Sekolah (8 digit)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            )}
          </div>

          {/* Step 2: Student Identification & Verification */}
          <div className="space-y-3 pt-1 border-t border-border/60">
            <div>
              <label htmlFor="claim-nisn" className="block text-xs font-semibold text-foreground mb-1">
                Step 2: NISN / Nomor Induk Siswa <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="claim-nisn"
                  type="text"
                  value={studentNumber}
                  onChange={(e) => setStudentNumber(e.target.value)}
                  placeholder="Contoh: 0051234567"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="claim-dob" className="block text-xs font-semibold text-foreground">
                  Tanggal Lahir Siswa <span className="text-destructive">*</span>
                </label>
                <span className="text-[11px] text-primary flex items-center gap-1 font-medium">
                  <ShieldCheck className="w-3 h-3" /> Verifikasi Keamanan
                </span>
              </div>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="claim-dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Digunakan sebagai kunci verifikasi hak akses wali murid (UU PDP §11.2).
              </p>
            </div>
          </div>

          {/* Step 3: Relationship */}
          <div className="pt-1 border-t border-border/60">
            <label htmlFor="claim-relationship" className="block text-xs font-semibold text-foreground mb-1">
              Step 3: Hubungan Keluarga
            </label>
            <div className="relative">
              <Heart className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10 pointer-events-none" />
              <select
                id="claim-relationship"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100 border border-slate-700 dark:border-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer shadow-sm"
              >
                <option value="orang_tua" className="bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100">Orang Tua (Ayah / Ibu)</option>
                <option value="wali" className="bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100">Wali / Keluarga</option>
                <option value="saudara" className="bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100">Kakak / Saudara Kandung</option>
              </select>
            </div>
          </div>

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {successMsg}
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/25 p-2.5 rounded-xl font-medium">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-border bg-background text-foreground text-xs font-semibold hover:bg-muted transition-all"
            >
              Batal
            </button>
            <button
              id="submit-claim-student-btn"
              type="submit"
              disabled={loading || !studentNumber.trim() || !dateOfBirth}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifikasi...
                </>
              ) : (
                "Hubungkan Data Siswa"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
