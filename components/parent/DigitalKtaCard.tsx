"use client";

import type { ComponentType } from "react";

interface DigitalKtaCardProps {
  studentName: string;
  schoolName: string;
  studentNumber: string;
  /** Sudah diformat masking, mis. "**** **** **** 8E01" */
  cardLast4: string;
  className?: string;
}

/**
 * Kartu KTA NFC digital EduConnect x BNI.
 * Proporsi kartu kredit (aspect-[1.586/1]), gradient brand Purple -> Orange.
 * Murni presentational — semua data dinamis dikirim lewat props dari NfcCardClient.
 */
export default function DigitalKtaCard({
  studentName,
  schoolName,
  studentNumber,
  cardLast4,
  className = "",
}: DigitalKtaCardProps) {
  return (
    <div
      role="img"
      aria-label={`Kartu digital EduConnect milik ${studentName}`}
      className={`relative w-full max-w-sm aspect-[1.586/1] overflow-hidden rounded-2xl shadow-portal-card transition-transform duration-300 hover:-translate-y-1 hover:shadow-portal-glow ${className}`}
      style={{
        background: "linear-gradient(135deg, #7357C7 0%, #F97316 100%)",
      }}
    >
      {/* Overlay tekstur dekoratif */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at 85% 15%, rgba(255,255,255,0.5) 0%, transparent 45%)",
        }}
      />

      <div className="relative z-10 flex h-full flex-col justify-between p-5 sm:p-6">
        {/* Baris atas: logo BNI & indikator NFC */}
        <div className="flex items-start justify-between">
          <BniLogoMark />
          <ContactlessIcon />
        </div>

        {/* Bagian tengah: chip emas + brand */}
        <div className="flex items-center gap-3">
          <ChipGraphic />
          <div>
            <p className="text-lg font-extrabold leading-tight tracking-tight text-white sm:text-xl">
              EduConnect
            </p>
            <p className="text-[11px] font-medium leading-tight text-white/80 sm:text-xs">
              {schoolName}
            </p>
          </div>
        </div>

        {/* Baris bawah: identitas siswa + logo infinity */}
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold uppercase tracking-wide text-white sm:text-base">
              {studentName}
            </p>
            <p className="truncate font-mono text-[11px] tracking-wide text-white/75 sm:text-xs">
              {cardLast4} &bull; NISN {studentNumber}
            </p>
          </div>
          <InfinityLogoMark />
        </div>
      </div>
    </div>
  );
}

function BniLogoMark() {
  return (
    <div className="rounded bg-white/95 px-1.5 py-0.5">
      <span className="text-[11px] font-black tracking-tighter text-[#7357C7]">BNI</span>
    </div>
  );
}

/** Ikon gelombang contactless/NFC, dibuat manual agar presisi mirip kartu fisik */
function ContactlessIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <path d="M8 9a5 5 0 0 1 0 7" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
      <path d="M11 6.5a9 9 0 0 1 0 12" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
      <path d="M14 4a13 13 0 0 1 0 17" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

/** Chip EMV emas dengan tekstur kontak sederhana (CSS gradient, tanpa asset image) */
function ChipGraphic() {
  return (
    <div
      aria-hidden
      className="relative h-8 w-10 shrink-0 overflow-hidden rounded-md sm:h-9 sm:w-11"
      style={{
        background: "linear-gradient(135deg, #FDE68A 0%, #D4A017 50%, #FDE68A 100%)",
      }}
    >
      <div className="absolute inset-0 grid grid-cols-3 gap-[1px] p-[3px]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-[1px] bg-black/10" />
        ))}
      </div>
    </div>
  );
}

/** Logo infinity loop EduConnect versi putih, untuk stamp di atas gradient */
function InfinityLogoMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" className="shrink-0">
      <path
        d="M7 8.5a3.5 3.5 0 1 0 0 7c1.2 0 2.1-.5 3-1.5l4-4c.9-1 1.8-1.5 3-1.5a3.5 3.5 0 1 1 0 7c-1.2 0-2.1-.5-3-1.5"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.95"
      />
      <circle cx="17.2" cy="6.8" r="1.1" fill="white" opacity="0.9" />
    </svg>
  );
}

// Re-export tipe util agar bisa dipakai composer icon di NfcCardClient tanpa import ganda
export type IconComponent = ComponentType<{ size?: number; className?: string }>;
