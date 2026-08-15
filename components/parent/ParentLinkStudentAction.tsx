"use client";

import { useState } from "react";
import { UserPlus, Wallet } from "lucide-react";
import ClaimStudentModal from "./ClaimStudentModal";

interface ParentLinkStudentActionProps {
  variant?: "empty" | "button";
  userContact?: string;
}

export default function ParentLinkStudentAction({
  variant = "button",
  userContact,
}: ParentLinkStudentActionProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      {variant === "empty" ? (
        <div className="glass rounded-2xl p-8 text-center space-y-4 border border-border/60">
          <Wallet className="w-12 h-12 text-muted-foreground/70 mx-auto" />
          <div className="space-y-1">
            <h2 className="font-bold text-base text-foreground">Belum Ada Siswa Terhubung</h2>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Akun Anda ({userContact}) belum terhubung dengan data siswa di sekolah. Masukkan NISN anak Anda untuk klaim dan tautkan data siswa secara mandiri.
            </p>
          </div>

          <button
            id="claim-student-empty-btn"
            onClick={() => setShowModal(true)}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md inline-flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            + Hubungkan / Klaim Data Siswa
          </button>
        </div>
      ) : (
        <button
          id="claim-student-header-btn"
          onClick={() => setShowModal(true)}
          className="px-3.5 py-2 rounded-xl bg-primary/15 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/25 active:scale-[0.98] transition-all inline-flex items-center gap-1.5"
        >
          <UserPlus className="w-3.5 h-3.5" />
          + Klaim Siswa
        </button>
      )}

      <ClaimStudentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => window.location.reload()}
      />
    </>
  );
}
