"use client";

import { useState } from "react";
import {
  CreditCard,
  Shield,
  History,
  Lock,
  Unlock,
  AlertTriangle,
  PlusCircle,
  CheckCircle2,
  ChevronDown,
  User,
  Info,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import GradientBalanceCard from "@/components/shared/GradientBalanceCard";

export interface StudentCardInfo {
  id: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  schoolName: string;
  cardUid: string;
  cardStatus: string;
  isActive: boolean;
  issuedDate?: string;
}

interface NfcCardClientProps {
  cards: StudentCardInfo[];
}

export default function NfcCardClient({ cards }: NfcCardClientProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(cards[0]?.studentId || "");
  const [isLockedTemporarily, setIsLockedTemporarily] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (cards.length === 0) {
    return (
      <div className="rounded-3xl border border-portal-border bg-portal-surface p-8 text-center space-y-2 shadow-portal-card">
        <p className="text-sm font-bold text-portal-text">Tidak Ada Kartu NFC Ditemukan</p>
        <p className="text-xs text-portal-muted">Siswa belum memiliki kartu fisik KTA NFC yang terdaftar.</p>
      </div>
    );
  }

  const activeCard = cards.find((c) => c.studentId === selectedStudentId) || cards[0];

  const handleToggleLock = () => {
    const nextState = !isLockedTemporarily;
    setIsLockedTemporarily(nextState);
    setToastMessage(
      nextState
        ? `Kartu ${activeCard.studentName} berhasil diblokir sementara.`
        : `Kartu ${activeCard.studentName} kembali aktif.`
    );
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div className="space-y-4">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Child Selector */}
      {cards.length > 1 && (
        <div className="space-y-1.5">
          <label
            htmlFor="nfc-child-selector"
            className="text-[11px] font-bold uppercase tracking-wider text-portal-muted flex items-center gap-1.5"
          >
            <User className="text-portal-primary" size={13} />
            Pilih Kartu Siswa
          </label>
          <div className="relative">
            <select
              id="nfc-child-selector"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full appearance-none rounded-2xl border border-portal-border bg-portal-surface px-4 py-2.5 text-xs font-bold text-portal-text focus:border-portal-primary focus:outline-none focus:ring-2 focus:ring-portal-primary/20 pr-10 shadow-portal-card cursor-pointer"
            >
              {cards.map((card) => (
                <option key={card.studentId} value={card.studentId} className="bg-white text-slate-900">
                  {card.studentName} — {card.cardUid}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-portal-muted">
              <ChevronDown size={16} />
            </div>
          </div>
        </div>
      )}

      {/* Physical NFC Card Mockup */}
      <GradientBalanceCard
        variant="card"
        studentName={activeCard.studentName}
        studentNumber={activeCard.studentNumber}
        schoolName={activeCard.schoolName}
        cardUid={activeCard.cardUid}
        cardStatus={isLockedTemporarily ? "TERKUNCI SEMENTARA" : activeCard.cardStatus}
        isActive={!isLockedTemporarily && activeCard.isActive}
      />

      {/* Primary Actions List */}
      <div className="rounded-[1.75rem] border border-portal-border bg-portal-surface p-4 sm:p-5 space-y-2.5 shadow-portal-card">
        <h3 className="text-xs font-bold uppercase tracking-wider text-portal-muted pb-1">
          Menu &amp; Tindakan Kartu
        </h3>

        {/* 1. Lihat Riwayat Penggunaan */}
        <Link
          href={`/kartu/riwayat?studentId=${activeCard.studentId}`}
          className="flex items-center justify-between p-3.5 rounded-2xl bg-portal-surface-alt hover:bg-slate-100 border border-portal-border/70 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-portal-primary flex items-center justify-center">
              <History size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-portal-text group-hover:text-portal-primary transition-colors">
                Riwayat Penggunaan Kartu
              </p>
              <p className="text-[11px] text-portal-muted">Detail tap kantin &amp; jam transaksi</p>
            </div>
          </div>
          <ArrowRight size={16} className="text-portal-muted group-hover:text-portal-primary transition-colors" />
        </Link>

        {/* 2. Blokir Sementara */}
        <button
          type="button"
          onClick={handleToggleLock}
          className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-portal-surface-alt hover:bg-slate-100 border border-portal-border/70 transition-colors text-left group"
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                isLockedTemporarily
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-orange-50 text-[#F97316]"
              }`}
            >
              {isLockedTemporarily ? <Unlock size={18} /> : <Lock size={18} />}
            </div>
            <div>
              <p className="text-xs font-bold text-portal-text group-hover:text-portal-primary transition-colors">
                {isLockedTemporarily ? "Buka Kunci Kartu" : "Kunci Sementara (Freeze)"}
              </p>
              <p className="text-[11px] text-portal-muted">
                {isLockedTemporarily
                  ? "Aktifkan kembali transaksi kantin"
                  : "Nonaktifkan transaksi tap tanpa ganti kartu"}
              </p>
            </div>
          </div>
          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border ${
              isLockedTemporarily
                ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                : "bg-orange-50 text-[#F97316] border-orange-200"
            }`}
          >
            {isLockedTemporarily ? "Buka" : "Kunci"}
          </span>
        </button>

        {/* 3. Laporkan Hilang / Rusak */}
        <Link
          href={`/kartu/lapor-hilang?studentId=${activeCard.studentId}`}
          className="flex items-center justify-between p-3.5 rounded-2xl bg-red-50/50 hover:bg-red-50 border border-red-100 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
              <AlertTriangle size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-red-600">Laporkan Kartu Hilang / Rusak</p>
              <p className="text-[11px] text-red-400">Blokir permanen &amp; proses kartu pengganti</p>
            </div>
          </div>
          <ArrowRight size={16} className="text-red-400 group-hover:text-red-600 transition-colors" />
        </Link>
      </div>

      {/* Card Technical Specs */}
      <div className="rounded-[1.75rem] border border-portal-border bg-portal-surface p-4 sm:p-5 space-y-3 shadow-portal-card text-xs">
        <div className="flex items-center gap-2 text-portal-text font-bold pb-1 border-b border-portal-border">
          <Info size={15} className="text-portal-primary" />
          <span>Informasi KTA Digital Siswa</span>
        </div>

        <div className="space-y-2 text-portal-muted">
          <div className="flex justify-between py-1 border-b border-portal-border/50">
            <span>Tipe Kartu:</span>
            <span className="font-semibold text-portal-text">KTA NFC Multi-Fungsi BNI</span>
          </div>
          <div className="flex justify-between py-1 border-b border-portal-border/50">
            <span>Protokol NFC:</span>
            <span className="font-mono text-portal-text">ISO/IEC 14443 Type A</span>
          </div>
          <div className="flex justify-between py-1 border-b border-portal-border/50">
            <span>Status Akun:</span>
            <span className="font-bold text-emerald-600">Terhubung ke Rekening Wali</span>
          </div>
          <div className="flex justify-between py-1">
            <span>Perlindungan Transaksi:</span>
            <span className="font-bold text-portal-primary">Pagu Harian + SNAP BI</span>
          </div>
        </div>
      </div>
    </div>
  );
}
