"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  School as SchoolIcon,
  ShieldCheck,
  Building2,
  Utensils,
  UserCheck,
  Mail,
  Lock,
  Phone,
  CreditCard,
  Hash,
  MapPin,
  Loader2,
  CheckCircle2,
  User,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import EduConnectLogo from "@/components/shared/EduConnectLogo";

interface PublicSchool {
  id: string;
  name: string;
  npsn: string | null;
  address?: string | null;
}

type RoleTab = "school_entity" | "school_admin" | "merchant_staff" | "parent";

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

  const [tab, setTab] = useState<RoleTab>(
    initialRoleParam === "school_entity" ||
      initialRoleParam === "school_admin" ||
      initialRoleParam === "merchant_staff" ||
      initialRoleParam === "parent"
      ? initialRoleParam
      : "school_entity"
  );

  // Common State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // School Directory Dropdown State
  const [schools, setSchools] = useState<PublicSchool[]>([]);
  const [fetchingSchools, setFetchingSchools] = useState(false);

  // Tab 1: School Entity State
  const [entitySchoolName, setEntitySchoolName] = useState("");
  const [entityNpsn, setEntityNpsn] = useState("");
  const [entityGiroAccount, setEntityGiroAccount] = useState("");
  const [entityAddress, setEntityAddress] = useState("");

  // Tab 2: School Admin State
  const [adminSelectedSchoolId, setAdminSelectedSchoolId] = useState("");
  const [adminPicName, setAdminPicName] = useState("");

  // Tab 3: Merchant Staff State
  const [merchantSelectedSchoolId, setMerchantSelectedSchoolId] = useState("");
  const [merchantPicName, setMerchantPicName] = useState("");
  const [stallName, setStallName] = useState("");
  const [merchantBniAccount, setMerchantBniAccount] = useState("");

  // Tab 4: Parent State
  const [parentFullName, setParentFullName] = useState("");
  const [parentBniAccount, setParentBniAccount] = useState("");

  const DEFAULT_FALLBACK_SCHOOLS: PublicSchool[] = [
    {
      id: "09c77f03-7f77-4c26-8da4-6ad5462f860c",
      name: "SMA BNI Harapan Bangsa",
      npsn: "20260001",
      address: "Jl. Jend. Sudirman No. 1, Jakarta",
    },
  ];

  // Load public schools list for Dropdown in Tab 2 and Tab 3
  const loadSchoolDirectory = async () => {
    try {
      setFetchingSchools(true);
      const res = await fetch("/api/v1/schools/public-list");
      if (!res.ok) throw new Error("Gagal memuat direktori sekolah");
      const data = await res.json() as { schools: PublicSchool[] };
      const list = data.schools && data.schools.length > 0 ? data.schools : DEFAULT_FALLBACK_SCHOOLS;
      setSchools(list);
      if (list.length > 0) {
        setAdminSelectedSchoolId((prev) => prev || list[0].id);
        setMerchantSelectedSchoolId((prev) => prev || list[0].id);
      }
    } catch (err) {
      console.error("Failed to load school directory, applying fallback:", err);
      setSchools(DEFAULT_FALLBACK_SCHOOLS);
      setAdminSelectedSchoolId((prev) => prev || DEFAULT_FALLBACK_SCHOOLS[0].id);
      setMerchantSelectedSchoolId((prev) => prev || DEFAULT_FALLBACK_SCHOOLS[0].id);
    } finally {
      setFetchingSchools(false);
    }
  };

  useEffect(() => {
    loadSchoolDirectory();
  }, []);

  function handleTabChange(newTab: RoleTab) {
    setTab(newTab);
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
      // TAB 1: DAFTARKAN SEKOLAH (school_entity)
      if (tab === "school_entity") {
        if (!entitySchoolName.trim() || !entityNpsn.trim() || !entityGiroAccount.trim()) {
          throw new Error("Mohon lengkapi Nama Institusi, NPSN (8 digit), dan No. Giro BNI.");
        }

        const res = await fetch("/api/v1/schools/public-register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: entitySchoolName.trim(),
            npsn: entityNpsn.trim(),
            bni_giro_account: entityGiroAccount.trim(),
            address: entityAddress.trim() || undefined,
          }),
        });

        const data = await res.json() as {
          success?: boolean;
          school?: PublicSchool;
          message?: string;
          error?: string;
        };

        if (!res.ok) {
          throw new Error(data.message ?? data.error ?? "Gagal mendaftarkan institusi sekolah");
        }

        setSuccessMsg(data.message ?? "Institusi sekolah berhasil didaftarkan! Memuat ke form Admin Sekolah...");

        // Re-fetch dropdown list & switch to Admin Sekolah tab automatically
        await loadSchoolDirectory();
        const createdId = data.school?.id;
        if (createdId) {
          setAdminSelectedSchoolId(createdId);
        }

        setTimeout(() => {
          setTab("school_admin");
          setSuccessMsg(`Institusi "${data.school?.name}" berhasil didaftarkan. Silakan lengkapi akun Admin Sekolah.`);
        }, 1200);

      // TAB 2: ADMIN SEKOLAH (school_admin)
      } else if (tab === "school_admin") {
        if (!adminSelectedSchoolId || !adminPicName.trim() || !email.trim() || !password || !phoneNumber.trim()) {
          throw new Error("Mohon lengkapi Sekolah Terdaftar, Nama Admin, Email, Nomor HP, dan Password.");
        }

        const res = await fetch("/api/v1/auth/register/school", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            school_id: adminSelectedSchoolId,
            pic_name: adminPicName.trim(),
            email: email.trim(),
            password,
            phone_number: normPhone,
          }),
        });

        const data = await res.json() as { success?: boolean; message?: string; error?: string };
        if (!res.ok) {
          throw new Error(data.message ?? data.error ?? "Gagal mendaftarkan akun Admin Sekolah");
        }

        setSuccessMsg(data.message ?? "Registrasi Admin Sekolah berhasil! Mengaktifkan sesi...");

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

      // TAB 3: STAF KANTIN (merchant_staff)
      } else if (tab === "merchant_staff") {
        if (!merchantSelectedSchoolId || !merchantPicName.trim() || !stallName.trim() || !email.trim() || !password || !phoneNumber.trim()) {
          throw new Error("Mohon lengkapi Sekolah, Nama PIC, Nama Gerai, Email, Nomor HP, dan Password.");
        }

        const res = await fetch("/api/v1/auth/register/merchant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            school_id: merchantSelectedSchoolId,
            pic_name: merchantPicName.trim(),
            stall_name: stallName.trim(),
            email: email.trim(),
            password,
            phone_number: normPhone,
            bni_payout_account: merchantBniAccount.trim() || undefined,
          }),
        });

        const data = await res.json() as { success?: boolean; message?: string; error?: string };
        if (!res.ok) {
          throw new Error(data.message ?? data.error ?? "Gagal mendaftarkan Stand Kantin");
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

      // TAB 4: ORANG TUA (parent)
      } else if (tab === "parent") {
        if (!parentFullName.trim() || !email.trim() || !password || !phoneNumber.trim()) {
          throw new Error("Mohon lengkapi Nama Lengkap Wali, Email, Nomor HP, dan Password.");
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan pendaftaran");
    } finally {
      setLoading(false);
    }
  }

  const TABS = [
    { id: "school_entity", label: "Daftarkan Sekolah", icon: SchoolIcon },
    { id: "school_admin", label: "Admin Sekolah", icon: Building2 },
    { id: "merchant_staff", label: "Staf Kantin", icon: Utensils },
    { id: "parent", label: "Orang Tua", icon: UserCheck },
  ] as const;

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center space-y-3">
        <div className="mb-2">
          <EduConnectLogo variant="full" width={160} height={46} showTagline={true} priority className="mx-auto" />
        </div>
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold">
          <ShieldCheck className="w-4 h-4" /> BNI EduConnect Closed-Loop Ecosystem
        </div>
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight sm:text-3xl">
          Pendaftaran &amp; Registrasi Akun
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
          Pilih kategori pendaftaran di bawah ini untuk memulai registrasi di ekosistem perbankan sekolah BNI EduConnect.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="glass p-6 sm:p-8 rounded-2xl shadow-2xl border border-border/80 space-y-6">
          {/* 4-Tab Navigation Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 text-xs font-semibold">
            {TABS.map(({ id: tabId, label, icon: Icon }) => {
              const isActive = tab === tabId;
              return (
                <button
                  key={tabId}
                  type="button"
                  id={`tab-register-${tabId}`}
                  onClick={() => handleTabChange(tabId)}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg transition-all duration-200 ${
                    isActive
                      ? "bg-[#00A396] text-white shadow-md shadow-[#00A396]/25 font-bold"
                      : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-[11px] sm:text-xs truncate">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Form Banner */}
          <div className="p-3.5 bg-muted/40 border border-border/70 rounded-xl text-xs flex items-center gap-2.5 text-muted-foreground">
            {tab === "school_entity" && (
              <>
                <SchoolIcon className="w-4 h-4 text-[#00A396] shrink-0" />
                <span>Registrasi <strong>Entitas Sekolah Baru</strong> (NPSN &amp; Giro BNI) ke direktori BNI EduConnect.</span>
              </>
            )}
            {tab === "school_admin" && (
              <>
                <Building2 className="w-4 h-4 text-[#00A396] shrink-0" />
                <span>Registrasi <strong>Akun Admin Sekolah</strong> (Pilih dari sekolah terdaftar).</span>
              </>
            )}
            {tab === "merchant_staff" && (
              <>
                <Utensils className="w-4 h-4 text-[#00A396] shrink-0" />
                <span>Registrasi <strong>Kasir Stand Kantin</strong> untuk kasir POS &amp; pencairan BNI.</span>
              </>
            )}
            {tab === "parent" && (
              <>
                <UserCheck className="w-4 h-4 text-[#00A396] shrink-0" />
                <span>Registrasi <strong>Wali Murid</strong> untuk pengawasan pagu harian &amp; vault anak.</span>
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* TAB 1: DAFTARKAN SEKOLAH (school_entity) */}
            {tab === "school_entity" && (
              <>
                <div>
                  <label htmlFor="reg-entity-name" className="block text-xs font-semibold text-foreground mb-1">
                    Nama Institusi Sekolah <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="reg-entity-name"
                      type="text"
                      value={entitySchoolName}
                      onChange={(e) => setEntitySchoolName(e.target.value)}
                      placeholder="Contoh: SMA BNI Harapan Bangsa"
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A396]/50 shadow-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg-entity-npsn" className="block text-xs font-semibold text-foreground mb-1">
                      NPSN (8 Digit Angka) <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        id="reg-entity-npsn"
                        type="text"
                        value={entityNpsn}
                        onChange={(e) => setEntityNpsn(e.target.value)}
                        placeholder="20260001"
                        maxLength={8}
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#00A396]/50 shadow-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-entity-giro" className="block text-xs font-semibold text-foreground mb-1">
                      No. Rekening Giro BNI Sekolah <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        id="reg-entity-giro"
                        type="text"
                        value={entityGiroAccount}
                        onChange={(e) => setEntityGiroAccount(e.target.value)}
                        placeholder="0123456789"
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#00A396]/50 shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-entity-address" className="block text-xs font-semibold text-foreground mb-1">
                    Alamat Sekolah (Opsional)
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="reg-entity-address"
                      type="text"
                      value={entityAddress}
                      onChange={(e) => setEntityAddress(e.target.value)}
                      placeholder="Jl. Jend. Sudirman No. 1, Jakarta"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A396]/50 shadow-sm"
                    />
                  </div>
                </div>
              </>
            )}

            {/* TAB 2: ADMIN SEKOLAH (school_admin) */}
            {tab === "school_admin" && (
              <>
                <div>
                  <label htmlFor="reg-admin-school" className="block text-xs font-semibold text-foreground mb-1">
                    Pilih Sekolah Terdaftar <span className="text-destructive">*</span>
                  </label>
                  {fetchingSchools ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground p-2.5 bg-background border border-border/60 rounded-xl">
                      <Loader2 className="w-4 h-4 animate-spin text-[#00A396]" /> Memuat daftar sekolah...
                    </div>
                  ) : schools.length > 0 ? (
                    <div className="relative">
                      <SchoolIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
                      <select
                        id="reg-admin-school"
                        value={adminSelectedSchoolId}
                        onChange={(e) => setAdminSelectedSchoolId(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100 border border-slate-700 dark:border-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#00A396]/50 cursor-pointer shadow-sm"
                      >
                        {schools.map((s) => (
                          <option key={s.id} value={s.id} className="bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100">
                            {s.name} {s.npsn ? `(NPSN: ${s.npsn})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-500 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                      Belum ada sekolah terdaftar. Silakan daftarkan sekolah terlebih dahulu pada tab &quot;Daftarkan Sekolah&quot;.
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="reg-admin-pic" className="block text-xs font-semibold text-foreground mb-1">
                    Nama Lengkap Admin Sekolah <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="reg-admin-pic"
                      type="text"
                      value={adminPicName}
                      onChange={(e) => setAdminPicName(e.target.value)}
                      placeholder="Contoh: Bpk. Bambang Sujatmiko"
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A396]/50 shadow-sm"
                    />
                  </div>
                </div>
              </>
            )}

            {/* TAB 3: STAF KANTIN (merchant_staff) */}
            {tab === "merchant_staff" && (
              <>
                <div>
                  <label htmlFor="reg-merchant-school" className="block text-xs font-semibold text-foreground mb-1">
                    Pilih Sekolah Tempat Stand Kantin <span className="text-destructive">*</span>
                  </label>
                  {fetchingSchools ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground p-2.5 bg-background border border-border/60 rounded-xl">
                      <Loader2 className="w-4 h-4 animate-spin text-[#00A396]" /> Memuat daftar sekolah...
                    </div>
                  ) : (
                    <div className="relative">
                      <SchoolIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
                      <select
                        id="reg-merchant-school"
                        value={merchantSelectedSchoolId}
                        onChange={(e) => setMerchantSelectedSchoolId(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 text-slate-100 dark:bg-slate-900 dark:text-slate-100 border border-slate-700 dark:border-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#00A396]/50 cursor-pointer shadow-sm"
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
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A396]/50 shadow-sm"
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
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A396]/50 shadow-sm"
                      />
                    </div>
                  </div>
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
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#00A396]/50 shadow-sm"
                    />
                  </div>
                </div>
              </>
            )}

            {/* TAB 4: ORANG TUA (parent) */}
            {tab === "parent" && (
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
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A396]/50 shadow-sm"
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
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#00A396]/50 shadow-sm"
                    />
                  </div>
                </div>
              </>
            )}

            {/* LOGIN CREDENTIAL FIELDS (EXCEPT FOR SCHOOL ENTITY REGISTRATION) */}
            {tab !== "school_entity" && (
              <>
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
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A396]/50 shadow-sm"
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
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#00A396]/50 shadow-sm"
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
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A396]/50 shadow-sm"
                    />
                  </div>
                </div>
              </>
            )}

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
              className="w-full py-3 rounded-xl text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60 text-white bg-[#00A396] hover:bg-[#008f84] active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Memproses...
                </>
              ) : tab === "school_entity" ? (
                <>
                  Daftarkan Sekolah Baru <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                `Daftar Akun ${tab === "school_admin" ? "Admin Sekolah" : tab === "merchant_staff" ? "Kasir Kantin" : "Wali Murid"}`
              )}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-border/60">
            <p className="text-xs text-muted-foreground">
              Sudah memiliki akun?{" "}
              <Link href="/login" className="font-bold text-[#00A396] hover:underline">
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
        <Loader2 className="w-8 h-8 animate-spin text-[#00A396]" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
