"use client";

import React from "react";
import { Plus, Wifi, ShieldCheck, CreditCard } from "lucide-react";
import EduConnectLogo from "./EduConnectLogo";
import { formatRupiah } from "@/lib/format";

export interface GradientBalanceCardProps {
  variant?: "wallet" | "card";
  // Wallet props
  balance?: number;
  accountNumber?: string;
  accountName?: string;
  onTopUpClick?: () => void;
  topUpHref?: string;
  // NFC Card props
  studentName?: string;
  studentNumber?: string;
  schoolName?: string;
  cardUid?: string;
  cardStatus?: string;
  isActive?: boolean;
  className?: string;
}

export default function GradientBalanceCard({
  variant = "wallet",
  balance = 0,
  accountNumber = "00023213823",
  accountName = "Wali Siswa",
  onTopUpClick,
  topUpHref,
  studentName = "Kenzou Tanaka",
  studentNumber = "20261001",
  schoolName = "SMA BNI Harapan Bangsa",
  cardUid = "KENZ-2025-0001",
  cardStatus = "ACTIVE",
  isActive = true,
  className = "",
}: GradientBalanceCardProps) {
  if (variant === "card") {
    // Physical NFC Card Mockup
    return (
      <div
        className={`relative overflow-hidden rounded-[1.75rem] p-5 sm:p-6 text-white shadow-xl transition-all duration-300 hover:shadow-2xl ${className}`}
        style={{
          background: "linear-gradient(135deg, #7357C7 0%, #8B5CF6 45%, #F97316 100%)",
        }}
      >
        {/* Decorative Background Circles / Wave Mesh */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-[#C6E63A]/20 blur-xl"
        />

        {/* Card Header: EduConnect White Logo + BNI Logo / Badge */}
        <div className="relative z-10 flex items-center justify-between">
          <EduConnectLogo variant="white" width={110} height={32} />
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase text-white backdrop-blur-md border border-white/20">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isActive ? "bg-[#C6E63A] animate-pulse" : "bg-red-400"
                }`}
              />
              {cardStatus}
            </span>
            <span className="font-extrabold text-sm tracking-widest text-white/90">BNI</span>
          </div>
        </div>

        {/* Card Middle: EMV Chip + Contactless Wifi */}
        <div className="relative z-10 my-4 flex items-center gap-3">
          {/* Metallic Gold EMV Chip */}
          <div className="h-8 w-11 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 p-1 shadow-inner border border-amber-300/60 relative overflow-hidden flex flex-col justify-between">
            <div className="flex justify-between h-full w-full opacity-60">
              <div className="w-[1px] bg-amber-900/50 h-full mx-auto" />
              <div className="h-[1px] bg-amber-900/50 w-full my-auto absolute inset-0" />
            </div>
          </div>

          <Wifi className="h-5 w-5 text-white/80 rotate-90" />
        </div>

        {/* Card Footer: Student Info & Masked UID */}
        <div className="relative z-10 space-y-1">
          <p className="font-mono text-sm sm:text-base font-bold tracking-[0.18em] text-white drop-shadow-sm">
            {cardUid}
          </p>
          <div className="flex items-end justify-between pt-1">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-white">
                {studentName}
              </p>
              <p className="text-[10px] text-white/80 font-medium">
                NISN: {studentNumber} • {schoolName}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-semibold text-white/70 uppercase tracking-wider block">
                Tap & Pay
              </span>
              <span className="text-[11px] font-bold text-[#C6E63A]">KTA NFC</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Wallet / Balance Hero Card
  return (
    <div
      className={`relative overflow-hidden rounded-[1.75rem] p-5 sm:p-6 text-white shadow-xl transition-all duration-300 hover:shadow-2xl ${className}`}
      style={{
        background: "linear-gradient(135deg, #7357C7 0%, #8B5CF6 45%, #F97316 100%)",
      }}
    >
      {/* Decorative Glow Elements */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/15 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-10 -bottom-10 h-36 w-36 rounded-full bg-[#C6E63A]/25 blur-xl"
      />

      {/* Header Info */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md">
            <CreditCard className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">
              Rekening BNI / Saldo Utama
            </p>
            <p className="font-mono text-xs font-semibold text-white/95">
              No. Rek: {accountNumber}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-full bg-black/20 px-2.5 py-1 text-[10px] font-bold text-[#C6E63A] backdrop-blur-md border border-white/10">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>SNAP BI Active</span>
        </div>
      </div>

      {/* Balance Amount & Top Up Action */}
      <div className="relative z-10 mt-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-white/80">Total Saldo Tersedia</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
            {formatRupiah(balance)}
          </h2>
          <p className="text-[10px] text-white/75 mt-0.5">a.n. {accountName}</p>
        </div>

        {topUpHref ? (
          <a
            href={topUpHref}
            id="btn-gradient-topup-link"
            className="flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-[#7357C7] shadow-lg shadow-black/10 transition-all hover:bg-slate-50 hover:scale-105 active:scale-95 shrink-0"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Top Up</span>
          </a>
        ) : (
          <button
            type="button"
            id="btn-gradient-topup"
            onClick={onTopUpClick}
            className="flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-[#7357C7] shadow-lg shadow-black/10 transition-all hover:bg-slate-50 hover:scale-105 active:scale-95 shrink-0"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Top Up</span>
          </button>
        )}
      </div>
    </div>
  );
}
