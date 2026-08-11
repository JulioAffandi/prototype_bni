"use client";

import { useState, useEffect } from "react";
import { X, UserCheck, Phone, CreditCard, Loader2, Link2, Unlink } from "lucide-react";

interface ParentItem {
  id: string;
  full_name: string;
  phone_number: string;
  bni_account_number: string;
}

interface LinkParentModalProps {
  schoolId: string;
  student: {
    id: string;
    full_name: string;
    parent?: { id: string; full_name: string; phone_number: string } | null;
  };
  onClose: () => void;
  onSuccess: (updatedParent: { id: string; full_name: string; phone_number: string } | null) => void;
}

export default function LinkParentModal({
  schoolId,
  student,
  onClose,
  onSuccess,
}: LinkParentModalProps) {
  const [mode, setMode] = useState<"select" | "new">("select");
  const [parentsList, setParentsList] = useState<ParentItem[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string>(student.parent?.id || "");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentBniAccount, setParentBniAccount] = useState("");
  const [relationship, setRelationship] = useState("orang_tua");
  const [loading, setLoading] = useState(false);
  const [fetchingParents, setFetchingParents] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadParents() {
      try {
        const res = await fetch(`/api/v1/schools/${schoolId}/parents`);
        if (res.ok) {
          const data = await res.json() as { parents: ParentItem[] };
          setParentsList(data.parents || []);
        }
      } catch (err) {
        console.error("Failed to load parents list", err);
      } finally {
        setFetchingParents(false);
      }
    }
    loadParents();
  }, [schoolId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload = mode === "select" && selectedParentId
        ? { parent_id: selectedParentId, relationship }
        : {
            parent_phone: parentPhone,
            parent_full_name: parentName,
            parent_bni_account: parentBniAccount,
            relationship,
          };

      const res = await fetch(`/api/v1/schools/${schoolId}/students/${student.id}/link-parent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json() as {
        success?: boolean;
        parent?: { id: string; full_name: string; phone_number: string };
        error?: string;
        message?: string;
      };

      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? "Gagal menghubungkan Orang Tua");
      }

      onSuccess(data.parent || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlink() {
    if (!confirm(`Hapus relasi Orang Tua untuk ${student.full_name}?`)) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/schools/${schoolId}/students/${student.id}/link-parent`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Gagal menghapus relasi orang tua");
      }

      onSuccess(null);
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
              <Link2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-base text-foreground">Hubungkan Orang Tua / Wali</h2>
              <p className="text-xs text-muted-foreground">Siswa: <span className="font-semibold text-foreground">{student.full_name}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Mode Switcher */}
          <div className="flex bg-muted/80 p-1 rounded-xl gap-1 text-xs font-semibold border border-border/50">
            <button
              type="button"
              onClick={() => setMode("select")}
              className={`flex-1 py-2 px-3 rounded-lg transition-all ${
                mode === "select"
                  ? "bg-primary text-primary-foreground shadow-md font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              Pilih Orang Tua Terdaftar
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`flex-1 py-2 px-3 rounded-lg transition-all ${
                mode === "new"
                  ? "bg-primary text-primary-foreground shadow-md font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              Input HP Baru
            </button>
          </div>

          {mode === "select" ? (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Pilih Orang Tua</label>
              {fetchingParents ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-background border border-border/60 rounded-xl">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" /> Memuat data orang tua...
                </div>
              ) : parentsList.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3 bg-muted/50 border border-border/60 rounded-xl">
                  Belum ada akun orang tua terdaftar. Pilih tab "Input HP Baru" di atas.
                </p>
              ) : (
                <select
                  value={selectedParentId}
                  onChange={(e) => setSelectedParentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm cursor-pointer"
                  required
                >
                  <option value="" className="bg-slate-900 text-slate-100 dark:bg-zinc-900 dark:text-zinc-100">
                    -- Pilih Orang Tua / Wali --
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
            <>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">No. HP Orang Tua</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="tel"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    placeholder="08xxxxxxxxxxxx"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Nama Lengkap Orang Tua (Opsional)</label>
                <div className="relative">
                  <UserCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    placeholder={`Wali dari ${student.full_name}`}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Rekening BNI (Opsional)</label>
                <div className="relative">
                  <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={parentBniAccount}
                    onChange={(e) => setParentBniAccount(e.target.value)}
                    placeholder="888012345678"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Hubungan Keluarga</label>
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-background text-foreground border border-border/80 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm cursor-pointer"
            >
              <option value="orang_tua" className="bg-slate-900 text-slate-100 dark:bg-zinc-900 dark:text-zinc-100">Orang Tua (Ayah / Ibu)</option>
              <option value="wali" className="bg-slate-900 text-slate-100 dark:bg-zinc-900 dark:text-zinc-100">Wali / Keluarga</option>
              <option value="kakak" className="bg-slate-900 text-slate-100 dark:bg-zinc-900 dark:text-zinc-100">Kakak / Saudara Kandung</option>
            </select>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/25 rounded-xl px-3.5 py-2.5 font-medium">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-3">
            {student.parent && (
              <button
                type="button"
                onClick={handleUnlink}
                disabled={loading}
                className="px-3.5 py-2.5 rounded-xl border border-destructive/40 text-destructive text-sm font-medium hover:bg-destructive/15 transition-all flex items-center gap-1.5 shadow-sm"
                title="Hapus Relasi Orang Tua"
              >
                <Unlink className="w-4 h-4" />
                Putus
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition-all shadow-sm"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan Relasi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
