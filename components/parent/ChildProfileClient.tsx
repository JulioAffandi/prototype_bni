"use client";

import { useState } from "react";
import {
  User,
  Building2,
  CreditCard,
  Shield,
  ShieldCheck,
  Phone,
  ArrowRight,
  Sliders,
  History,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { formatRupiah } from "@/lib/format";

export interface StudentProfileData {
  id: string;
  fullName: string;
  studentNumber: string;
  gradeClass: string;
  schoolName: string;
  schoolCode: string;
  dailyLimit: number;
  emergencyLimit: number;
  emergencyApprove: boolean;
  cardUid: string;
  cardStatus: string;
  guardians: Array<{
    id: string;
    fullName: string;
    relationship: string;
    phone: string;
    isPrimary: boolean;
  }>;
}

interface ChildProfileClientProps {
  student: StudentProfileData;
}

export default function ChildProfileClient({ student }: ChildProfileClientProps) {
  return (
    <div className="space-y-4">
      {/* 1. Student Identity Header Card */}
      <div className="rounded-[1.75rem] border border-portal-border bg-portal-surface p-5 sm:p-6 shadow-portal-card text-center space-y-3">
        <div className="w-20 h-20 rounded-3xl bg-purple-50 text-portal-primary border-2 border-purple-100 mx-auto flex items-center justify-center font-black text-2xl shadow-sm">
          {student.fullName.charAt(0).toUpperCase()}
        </div>

        <div>
          <h2 className="text-lg font-black text-portal-text">{student.fullName}</h2>
          <p className="text-xs text-portal-muted mt-0.5">
            Kelas {student.gradeClass || "X-A"} • NISN:{" "}
            <span className="font-mono font-bold text-portal-text">{student.studentNumber}</span>
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-portal-surface-alt border border-portal-border/70 text-xs text-portal-muted mx-auto">
          <Building2 size={13} className="text-portal-primary" />
          <span className="font-semibold text-portal-text">{student.schoolName}</span>
          <span className="font-mono text-[10px] text-portal-muted ml-1">({student.schoolCode})</span>
        </div>
      </div>

      {/* 2. Pagu & NFC Quick Stats */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-[1.5rem] border border-portal-border bg-portal-surface p-4 shadow-portal-card space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-portal-muted font-bold">
            <Sliders size={13} className="text-portal-primary" />
            <span>Pagu Harian</span>
          </div>
          <p className="text-base font-black text-portal-text">{formatRupiah(student.dailyLimit)}</p>
          <Link
            href="/pagu"
            className="text-[10px] font-bold text-portal-primary hover:underline inline-flex items-center gap-0.5 pt-0.5"
          >
            Ubah Pagu <ArrowRight size={10} />
          </Link>
        </div>

        <div className="rounded-[1.5rem] border border-portal-border bg-portal-surface p-4 shadow-portal-card space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-portal-muted font-bold">
            <CreditCard size={13} className="text-[#F97316]" />
            <span>Status Kartu NFC</span>
          </div>
          <p className="text-xs font-mono font-black text-portal-text truncate">{student.cardUid}</p>
          <Link
            href="/kartu"
            className="text-[10px] font-bold text-[#F97316] hover:underline inline-flex items-center gap-0.5 pt-0.5"
          >
            Kelola Kartu <ArrowRight size={10} />
          </Link>
        </div>
      </div>

      {/* 3. Verified Guardians List */}
      <div className="rounded-[1.75rem] border border-portal-border bg-portal-surface p-4 sm:p-5 shadow-portal-card space-y-3">
        <div className="flex items-center justify-between border-b border-portal-border pb-2.5">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600" />
            <h3 className="text-xs font-bold text-portal-text uppercase tracking-wider">
              Wali Terverifikasi ({student.guardians.length})
            </h3>
          </div>
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
            Terhubung BNI
          </span>
        </div>

        <div className="space-y-2">
          {student.guardians.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between p-3 rounded-2xl bg-portal-surface-alt border border-portal-border/60 text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-portal-primary flex items-center justify-center font-bold">
                  <User size={15} />
                </div>
                <div>
                  <p className="font-bold text-portal-text">{g.fullName}</p>
                  <p className="text-[10px] text-portal-muted font-medium capitalize">
                    {g.relationship} {g.isPrimary ? "• Wali Utama" : ""}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-mono text-portal-muted">{g.phone || "-"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Action Buttons */}
      <div className="space-y-2 pt-1">
        <Link
          href={`/kartu/riwayat?studentId=${student.id}`}
          className="w-full py-3.5 rounded-2xl bg-portal-primary text-white text-xs font-bold hover:opacity-95 shadow-portal-glow flex items-center justify-center gap-2 transition-all"
        >
          <History size={15} />
          <span>Lihat Riwayat Jajan {student.fullName}</span>
        </Link>
      </div>
    </div>
  );
}
