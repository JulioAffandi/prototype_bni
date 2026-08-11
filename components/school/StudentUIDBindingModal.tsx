"use client";

import { useState } from "react";
import { X, Nfc, User, Phone, CreditCard, Loader2, CheckCircle2 } from "lucide-react";

interface StudentUIDBindingModalProps {
  schoolId: string;
  onClose: () => void;
  onSuccess: (student: {
    id: string;
    full_name: string;
    nfc_uid_last4: string;
    card_status: "active";
    daily_limit: number;
    daily_limit_used: number;
    emergency_approve: boolean;
    emergency_overdraft_count_7d: number;
    created_at: string;
  }) => void;
}

export default function StudentUIDBindingModal({ schoolId, onClose, onSuccess }: StudentUIDBindingModalProps) {
  const [step, setStep] = useState<"form" | "nfc" | "success">("form");
  const [fullName, setFullName] = useState("");
  const [rawNfcUid, setRawNfcUid] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentBniAccount, setParentBniAccount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const simulatorEnabled = process.env.NEXT_PUBLIC_NFC_SIMULATOR_ENABLED === "true";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate
    if (!fullName.trim() || !rawNfcUid.trim()) {
      setError("Nama siswa dan UID kartu NFC wajib diisi.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/v1/schools/${schoolId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          raw_nfc_uid: rawNfcUid,
          nfc_uid_last4: rawNfcUid.slice(-4),
          parent_phone: parentPhone,
          parent_bni_account: parentBniAccount,
        }),
      });

      const data = await res.json() as {
        student?: {
          id: string; full_name: string; card_status: string; created_at: string;
        };
        error?: string; message?: string;
      };

      if (!res.ok) {
        if (res.status === 409) throw new Error("UID kartu ini sudah terdaftar untuk siswa lain.");
        throw new Error(data.message ?? data.error ?? "Gagal mendaftarkan siswa");
      }

      setStep("success");
      setTimeout(() => {
        onSuccess({
          id: data.student!.id,
          full_name: data.student!.full_name,
          nfc_uid_last4: rawNfcUid.slice(-4),
          card_status: "active",
          daily_limit: 30000,
          daily_limit_used: 0,
          emergency_approve: false,
          emergency_overdraft_count_7d: 0,
          created_at: data.student!.created_at,
        });
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                <Nfc className="w-4 h-4 text-primary" />
              </div>
              <h2 className="font-semibold">Daftarkan Siswa Baru</h2>
            </div>
            <button
              id="modal-close-btn"
              onClick={onClose}
              className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5">
            {step === "success" ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">Siswa Berhasil Didaftarkan</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Kartu NFC <strong>{fullName}</strong> telah diaktifkan dan siap digunakan.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label htmlFor="student-name" className="block text-sm font-medium mb-1.5">
                    Nama Lengkap Siswa
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="student-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Contoh: Akbar Pratama"
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>

                {/* NFC UID */}
                <div>
                  <label htmlFor="nfc-uid" className="block text-sm font-medium mb-1.5">
                    UID Kartu NFC
                    {simulatorEnabled && (
                      <span className="ml-2 text-xs text-accent font-normal">(Simulator aktif)</span>
                    )}
                  </label>
                  <div className="relative">
                    <Nfc className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="nfc-uid"
                      type="text"
                      value={rawNfcUid}
                      onChange={(e) => setRawNfcUid(e.target.value)}
                      placeholder={simulatorEnabled ? "Masukkan UID manual (demo)" : "Tempelkan kartu ke reader..."}
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    UID akan di-hash (SHA-256) dan tidak disimpan dalam bentuk asli. Ref: §11.2
                  </p>
                </div>

                {/* Parent phone */}
                <div>
                  <label htmlFor="parent-phone" className="block text-sm font-medium mb-1.5">
                    No. HP Orang Tua (Opsional)
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="parent-phone"
                      type="tel"
                      value={parentPhone}
                      onChange={(e) => setParentPhone(e.target.value)}
                      placeholder="08xxxxxxxxxxxx"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>

                {/* BNI account */}
                <div>
                  <label htmlFor="parent-bni" className="block text-sm font-medium mb-1.5">
                    Rekening BNI Orang Tua (Opsional)
                  </label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      id="parent-bni"
                      type="text"
                      value={parentBniAccount}
                      onChange={(e) => setParentBniAccount(e.target.value)}
                      placeholder="0123456789"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 border border-destructive/25 rounded-xl px-3 py-2">
                    {error}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    id="submit-student-btn"
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
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
