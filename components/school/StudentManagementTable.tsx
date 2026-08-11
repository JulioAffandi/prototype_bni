"use client";

import { useState } from "react";
import {
  Search, CreditCard, ShieldAlert, ShieldCheck, ShieldOff,
  AlertTriangle, UserPlus, Link2, UserCheck, Phone,
} from "lucide-react";
import StudentUIDBindingModal, { NewStudentResponse } from "./StudentUIDBindingModal";
import LinkParentModal from "./LinkParentModal";

type CardStatus = "active" | "lost_reported" | "blocked" | "graduated" | "transferred_out";

export interface Student {
  id: string;
  full_name: string;
  nfc_uid_last4: string;
  card_status: CardStatus;
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

interface StudentManagementTableProps {
  schoolId: string;
  students: Student[];
}

const CARD_STATUS_CONFIG: Record<CardStatus, { label: string; class: string; icon: typeof CreditCard }> = {
  active:           { label: "Aktif",        class: "badge-paid",     icon: CreditCard },
  lost_reported:    { label: "Hilang",       class: "badge-failed",   icon: ShieldAlert },
  blocked:          { label: "Diblokir",     class: "badge-failed",   icon: ShieldOff },
  graduated:        { label: "Lulus",        class: "badge-offline",  icon: CreditCard },
  transferred_out:  { label: "Pindah",       class: "badge-offline",  icon: CreditCard },
};

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function StudentManagementTable({ schoolId, students: initialStudents }: StudentManagementTableProps) {
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<CardStatus | "ALL">("ALL");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudentForLink, setSelectedStudentForLink] = useState<Student | null>(null);
  const [offboarding, setOffboarding] = useState<string | null>(null);

  const filtered = students.filter((s) => {
    const matchSearch =
      search === "" ||
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.nfc_uid_last4.includes(search) ||
      (s.parent?.full_name && s.parent.full_name.toLowerCase().includes(search.toLowerCase())) ||
      (s.parent?.phone_number && s.parent.phone_number.includes(search));
    const matchStatus = filterStatus === "ALL" || s.card_status === filterStatus;
    return matchSearch && matchStatus;
  });

  async function handleOffboard(studentId: string, reason: "graduated" | "transfer") {
    if (!confirm(`Konfirmasi offboard siswa ini sebagai "${reason === "graduated" ? "Lulus" : "Pindah Sekolah"}"?`)) return;
    setOffboarding(studentId);
    try {
      const res = await fetch(`/api/v1/schools/${schoolId}/students/${studentId}/offboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        const { card_status } = await res.json() as { card_status: CardStatus };
        setStudents((prev) =>
          prev.map((s) => (s.id === studentId ? { ...s, card_status } : s))
        );
      }
    } finally {
      setOffboarding(null);
    }
  }

  function handleStudentAdded(newStudent: NewStudentResponse) {
    setStudents((prev) => [newStudent as Student, ...prev]);
    setShowAddModal(false);
  }

  function handleParentLinked(updatedParent: { id: string; full_name: string; phone_number: string } | null) {
    if (!selectedStudentForLink) return;
    const targetId = selectedStudentForLink.id;
    setStudents((prev) =>
      prev.map((s) => (s.id === targetId ? { ...s, parent: updatedParent } : s))
    );
    setSelectedStudentForLink(null);
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm flex-wrap">
        <span className="text-muted-foreground">Total: <strong>{students.length}</strong> siswa</span>
        <span className="text-primary">Aktif: <strong>{students.filter((s) => s.card_status === "active").length}</strong></span>
        <span className="text-emerald-500">Wali Terhubung: <strong>{students.filter((s) => !!s.parent).length}</strong></span>
        <span className="text-destructive">Masalah: <strong>{students.filter((s) => ["lost_reported","blocked"].includes(s.card_status)).length}</strong></span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            id="student-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, UID, atau nama/HP wali..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <select
          id="student-status-filter"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as CardStatus | "ALL")}
          className="bg-muted border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="ALL">Semua Status</option>
          {Object.entries(CARD_STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>

        <button
          id="add-student-btn"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-all"
        >
          <UserPlus className="w-4 h-4" />
          Daftarkan Siswa
        </button>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-4 text-xs text-muted-foreground font-medium">Siswa</th>
              <th className="text-left p-4 text-xs text-muted-foreground font-medium">Orang Tua / Wali</th>
              <th className="text-left p-4 text-xs text-muted-foreground font-medium">Kartu UID</th>
              <th className="text-left p-4 text-xs text-muted-foreground font-medium">Status</th>
              <th className="text-left p-4 text-xs text-muted-foreground font-medium">Pagu Harian</th>
              <th className="text-left p-4 text-xs text-muted-foreground font-medium">Darurat</th>
              <th className="text-right p-4 text-xs text-muted-foreground font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((student) => {
              const cfg = CARD_STATUS_CONFIG[student.card_status];
              const Icon = cfg.icon;
              const isFrequent = student.emergency_overdraft_count_7d > 2;
              return (
                <tr key={student.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{student.full_name}</p>
                      {isFrequent && (
                        <span title="Frequent Overdraft">
                          <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Bergabung {new Date(student.created_at).toLocaleDateString("id-ID")}
                    </p>
                  </td>
                  <td className="p-4">
                    {student.parent ? (
                      <div>
                        <p className="font-medium text-xs flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-primary" />
                          {student.parent.full_name}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-muted-foreground/70" />
                          {student.parent.phone_number}
                        </p>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectedStudentForLink(student)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 text-xs font-medium transition-colors"
                      >
                        <Link2 className="w-3 h-3" />
                        Hubungkan Wali
                      </button>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded-lg">
                      ****{student.nfc_uid_last4}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.class}`}>
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </td>
                  <td className="p-4">
                    <p className="text-sm font-semibold">{formatRupiah(student.daily_limit)}</p>
                    <div className="h-1 rounded-full bg-muted mt-1 w-20 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min(100, (student.daily_limit_used / student.daily_limit) * 100)}%` }}
                      />
                    </div>
                  </td>
                  <td className="p-4">
                    {student.emergency_approve ? (
                      <span className="flex items-center gap-1 text-xs text-primary">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Aktif
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ShieldOff className="w-3.5 h-3.5" />
                        Off
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedStudentForLink(student)}
                        className="text-xs px-2 py-1.5 rounded-lg border border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-all flex items-center gap-1"
                        title="Edit Relasi Wali"
                      >
                        <Link2 className="w-3 h-3" />
                        {student.parent ? "Edit Wali" : "Hubungkan"}
                      </button>
                      {student.card_status === "active" && (
                        <>
                          <button
                            id={`offboard-graduate-${student.id}`}
                            onClick={() => handleOffboard(student.id, "graduated")}
                            disabled={offboarding === student.id}
                            className="text-xs px-2 py-1.5 rounded-lg border border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-all disabled:opacity-50"
                          >
                            Lulus
                          </button>
                          <button
                            id={`offboard-transfer-${student.id}`}
                            onClick={() => handleOffboard(student.id, "transfer")}
                            disabled={offboarding === student.id}
                            className="text-xs px-2 py-1.5 rounded-lg border border-border text-muted-foreground hover:border-destructive/50 hover:text-destructive transition-all disabled:opacity-50"
                          >
                            Pindah
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                  Tidak ada siswa yang sesuai dengan filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <StudentUIDBindingModal
          schoolId={schoolId}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleStudentAdded}
        />
      )}

      {selectedStudentForLink && (
        <LinkParentModal
          schoolId={schoolId}
          student={selectedStudentForLink}
          onClose={() => setSelectedStudentForLink(null)}
          onSuccess={handleParentLinked}
        />
      )}
    </div>
  );
}
