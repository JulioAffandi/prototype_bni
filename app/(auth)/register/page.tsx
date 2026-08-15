"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  UserCheck,
  Building2,
  Utensils,
  Mail,
  Lock,
  Phone,
  CreditCard,
  Hash,
  School as SchoolIcon,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface PublicSchool {
  id: string;
  name: string;
  npsn: string | null;
}

type RoleTab = "parent" | "merchant_staff" | "school_admin";

function normalizePhoneE164(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "+62" + cleaned.slice(1);
  } else if (cleaned.startsWith("62")) {
    cleaned = "+" + cleaned;
  } else if (cleaned && !cleaned.startsWith("+")) {
    cleaned = "+62" + cleaned;
  }
  return cleaned;
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRoleParam = searchParams.get("role") as RoleTab | null;

  const [role, setRole] = useState<RoleTab>(
    initialRoleParam === "merchant_staff" || initialRoleParam === "school_admin"
      ? initialRoleParam
      : "parent"
  );

  // Common Auth State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Parent Tab State
  const [parentFullName, setParentFullName] = useState("");
  const [parentBniAccount, setParentBniAccount] = useState("");

  // Merchant Tab State
  const [merchantPicName, setMerchantPicName] = useState("");
  const [stallName, setStallName] = useState("");
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [merchantBniAccount, setMerchantBniAccount] = useState("");
  const [schools, setSchools] = useState<PublicSchool[]>([]);
  const [fetchingSchools, setFetchingSchools] = useState(false);

  // School Admin Tab State
  const [schoolPicName, setSchoolPicName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [npsn, setNpsn] = useState("");
  const [schoolGiroAccount, setSchoolGiroAccount] = useState("");

  // Fetch directory of public schools for Merchant Stand registration
  useEffect(() => {
    if (role !== "merchant_staff") return;
    async function loadSchools() {
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
        console.error("Failed to load school directory", err);
      } finally {
        setFetchingSchools(false);
      }
    }
    loadSchools();
  }, [role]);

  function clearStateOnTabSwitch(newRole: RoleTab) {
    setRole(newRole);
    setError(null);
    setSuccessMsg(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const normPhone = normalizePhoneE164(phoneNumber);

    try {
      if (role === "parent") {
        if (!parentFullName.trim() || !email.trim() || !password || !phoneNumber.trim()) {
          throw new Error("Mohon lengkapi semua bidang wajib registrasi Orang Tua.");
        }

        const res = await fetch("/api/v1/auth/register/parent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: parentFullName.trim(),
            email: email.trim(),
            password,
            phone_number: normPhone,
            bni_account_number: parentBniAccount.trim() || undefined,
          }),
        });

        const data = await res.json() as { success?: boolean; message?: string; error?: string };
        if (!res.ok) {
          throw new Error(data.message ?? data.error ?? "Gagal mendaftarkan akun Orang Tua");
        }

        setSuccessMsg(data.message ?? "Registrasi Orang Tua berhasil! Mengaktifkan sesi...");

        // Auto sign-in client side
        const supabase = createClient();
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        setTimeout(() => {
          if (!signInErr) {
            router.push("/dashboard");
          } else {
            router.push("/login/parent?registered=1");
          }
        }, 1200);
      } else if (role === "merchant_staff") {
        if (!merchantPicName.trim() || !stallName.trim() || !selectedSchoolId || !email.trim() || !password || !phoneNumber.trim()) {
          throw new Error("Mohon lengkapi semua bidang wajib registrasi Kasir / Merchant Kantin.");
        }

        const res = await fetch("/api/v1/auth/register/merchant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pic_name: merchantPicName.trim(),
            stall_name: stallName.trim(),
            school_id: selectedSchoolId,
            email: email.trim(),
            password,
            phone_number: normPhone,
            bni_payout_account: merchantBniAccount.trim() || undefined,
          }),
        });

        const data = await res.json() as { success?: boolean; message?: string; error?: string };
        if (!res.ok) {
          throw new Error(data.message ?? data.error ?? "Gagal mendaftarkan Merchant Stand Kantin");
        }

        setSuccessMsg(data.message ?? "Registrasi Merchant Kantin berhasil! Mengaktifkan sesi...");

        const supabase = createClient();
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        setTimeout(() => {
          if (!signInErr) {
            router.push("/pos");
          } else {
            router.push("/login/merchant?registered=1");
          }
        }, 1200);
      } else if (role === "school_admin") {
        if (!schoolPicName.trim() || !schoolName.trim() || !npsn.trim() || !email.trim() || !password || !phoneNumber.trim()) {
          throw new Error("Mohon lengkapi semua bidang wajib registrasi Admin Sekolah.");
        }

        const res = await fetch("/api/v1/auth/register/school", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pic_name: schoolPicName.trim(),
            school_name: schoolName.trim(),
            npsn: npsn.trim(),
            email: email.trim(),
            password,
            phone_number: normPhone,
            giro_account: schoolGiroAccount.trim() || undefined,
          }),
        });

        const data = await res.json() as { success?: boolean; message?: string; error?: string };
        if (!res.ok) {
          throw new Error(data.message ?? data.error ?? "Gagal mendaftarkan Institusi Sekolah");
        }

        setSuccessMsg(data.message ?? "Registrasi Sekolah berhasil! Mengaktifkan sesi...");

        const supabase = createClient();
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        setTimeout(() => {
          if (!signInErr) {
            router.push("/school");
          } else {
            router.push("/login/school?registered=1");
          }
        }, 1200);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan registrasi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold">
          <ShieldCheck className="w-4 h-4" /> VALO BNI Closed-Loop Ecosystem
        </div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight sm:text-3xl">
          Pendaftaran Akun Baru VALO
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
          Pilih peran Anda di bawah untuk mendaftarkan akun di ekosistem sekolah digital VALO.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="glass p-6 sm:p-8 rounded-2xl shadow-2xl border border-border/80 space-y-6">
          {/* Multi-Role Selector Tabs */}
          <div className="grid grid-cols-3 gap-1.5 bg-muted/80 p-1.5 rounded-xl border border-border/60 text-xs font-semibold">
            <button
              type="button"
              id="tab-register-parent"
              onClick={() => clearStateOnTabSwitch("parent")}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg transition-all ${
                role === "parent"
                  ? "bg-primary text-primary-foreground shadow-md font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Orang Tua</span>
              <span className="sm:hidden">Wali</span>
            </button>

            <button
              type="button"
              id="tab-register-merchant"
              onClick={() => clearStateOnTabSwitch("merchant_staff")}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg transition-all ${
                role === "merchant_staff"
                  ? "bg-emerald-500 text-white shadow-md font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Utensils className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Staf Kantin</span>
              <span className="sm:hidden">Kantin</span>
            </button>

            <button
              type="button"
              id="tab-register-school"
              onClick={() => clearStateOnTabSwitch("school_admin")}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg transition-all ${
                role === "school_admin"
                  ? "bg-accent text-accent-foreground shadow-md font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Building2 className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Admin Sekolah</span>
              <span className="sm:hidden">Sekolah</span>
            </button>
          </div>

          {/* Form Description Banner */}
          <div className="p-3.5 bg-muted/40 border border-border/70 rounded-xl text-xs flex items-center gap-2.5 text-muted-foreground">
            {role === "parent" && (
              <>
                <UserCheck className="w-4 h-4 text-primary shrink-0" />
                <span>Registrasi <strong>Wali Murid</strong> untuk kontrol pagu harian &amp; tabungan Vault anak.</span>
              </>
            )}
            {role === "merchant_staff" && (
              <>
                <Utensils className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Registrasi <strong>Kasir Stand Kantin</strong> untuk kasir POS &amp; pencairan BNI.</span>
              </>
            )}
            {role === "school_admin" && (
              <>
                <Building2 className="w-4 h-4 text-accent shrink-0" />
                <span>Registrasi <strong>Admin Sekolah</strong> untuk manajemen NISN, SPP, &amp; audit.</span>
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ROLE 1: ORANG TUA */}
            {role === "parent" && (
              <>
                <div>
                  <label htmlFor="reg-parent-name" className="block text-xs font-semibold text-foreground mb-1">
                    Nama Lengkap Wali <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="reg-parent-name"
                      type="text"
                      value={parentFullName}
                      onChange={(e) => setParentFullName(e.target.value)}
                      placeholder="Contoh: Hendra Pratama"
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-parent-bni" className="block text-xs font-semibold text-foreground mb-1">
                    Nomor Rekening Tabungan BNI (Opsional)
                  </label>
                  <div className="relative">
                    <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="reg-parent-bni"
                      type="text"
                      value={parentBniAccount}
                      onChange={(e) => setParentBniAccount(e.target.value)}
                      placeholder="Contoh: 888012345678"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                    />
                  </div>
                </div>
              </>
            )}

            {/* ROLE 2: STAF KANTIN */}
            {role === "merchant_staff" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg-merchant-pic" className="block text-xs font-semibold text-foreground mb-1">
                      Nama PIC / Kasir <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        id="reg-merchant-pic"
                        type="text"
                        value={merchantPicName}
                        onChange={(e) => setMerchantPicName(e.target.value)}
                        placeholder="Contoh: Ibu Siti Hajar"
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-stall-name" className="block text-xs font-semibold text-foreground mb-1">
                      Nama Gerai / Kantin <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <Utensils className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        id="reg-stall-name"
                        type="text"
                        value={stallName}
                        onChange={(e) => setStallName(e.target.value)}
                        placeholder="Contoh: Kantin Berkah Stand #02"
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-merchant-school" className="block text-xs font-semibold text-foreground mb-1">
                    Pilih Sekolah Tempat Stand Kantin <span className="text-destructive">*</span>
                  </label>
                  {fetchingSchools ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground p-2.5 bg-background border border-border/60 rounded-xl">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> Memuat daftar sekolah...
                    </div>
                  ) : (
                    <div className="relative">
                      <SchoolIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
                      <select
                        id="reg-merchant-school"
                        value={selectedSchoolId}
                        onChange={(e) => setSelectedSchoolId(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100 border border-slate-700 dark:border-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer shadow-sm"
                      >
                        {schools.map((s) => (
                          <option key={s.id} value={s.id} className="bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100">
                            {s.name} {s.npsn ? `(NPSN: ${s.npsn})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="reg-merchant-bni" className="block text-xs font-semibold text-foreground mb-1">
                    No. Rekening Merchant BNI (Settlement H+0)
                  </label>
                  <div className="relative">
                    <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="reg-merchant-bni"
                      type="text"
                      value={merchantBniAccount}
                      onChange={(e) => setMerchantBniAccount(e.target.value)}
                      placeholder="Contoh: 88800002222"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm"
                    />
                  </div>
                </div>
              </>
            )}

            {/* ROLE 3: PENGELOLA SEKOLAH */}
            {role === "school_admin" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg-school-pic" className="block text-xs font-semibold text-foreground mb-1">
                      Nama Admin Sekolah <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        id="reg-school-pic"
                        type="text"
                        value={schoolPicName}
                        onChange={(e) => setSchoolPicName(e.target.value)}
                        placeholder="Contoh: Bpk. Bambang Sujatmiko"
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 shadow-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-school-name" className="block text-xs font-semibold text-foreground mb-1">
                      Nama Institusi Sekolah <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        id="reg-school-name"
                        type="text"
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        placeholder="Contoh: SMA Negeri 1 Jakarta"
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg-npsn" className="block text-xs font-semibold text-foreground mb-1">
                      NPSN (8 Digit Angka) <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        id="reg-npsn"
                        type="text"
                        value={npsn}
                        onChange={(e) => setNpsn(e.target.value)}
                        placeholder="20105001"
                        maxLength={8}
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-accent/50 shadow-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-giro" className="block text-xs font-semibold text-foreground mb-1">
                      No. Rekening Giro BNI Sekolah
                    </label>
                    <div className="relative">
                      <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        id="reg-giro"
                        type="text"
                        value={schoolGiroAccount}
                        onChange={(e) => setSchoolGiroAccount(e.target.value)}
                        placeholder="88800001111"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/50 shadow-sm"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* COMMON FIELDS: EMAIL, PASSWORD, PHONE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/60">
              <div>
                <label htmlFor="reg-email" className="block text-xs font-semibold text-foreground mb-1">
                  Email Akun <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-phone" className="block text-xs font-semibold text-foreground mb-1">
                  Nomor HP WhatsApp <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="reg-phone"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="081234567890"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="reg-password" className="block text-xs font-semibold text-foreground mb-1">
                Kata Sandi <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="reg-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  minLength={6}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                />
              </div>
            </div>

            {successMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {successMsg}
              </div>
            )}

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/25 p-3 rounded-xl font-medium">
                {error}
              </p>
            )}

            <button
              id="submit-register-btn"
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-xl text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60 text-white ${
                role === "parent"
                  ? "bg-primary hover:bg-primary/90"
                  : role === "merchant_staff"
                  ? "bg-emerald-500 hover:bg-emerald-600"
                  : "bg-accent hover:bg-accent/90"
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Memproses Registrasi...
                </>
              ) : (
                `Daftar Akun ${role === "parent" ? "Wali Murid" : role === "merchant_staff" ? "Kasir Kantin" : "Admin Sekolah"}`
              )}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-border/60">
            <p className="text-xs text-muted-foreground">
              Sudah memiliki akun?{" "}
              <Link href="/login" className="font-bold text-primary hover:underline">
                Masuk di sini
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
