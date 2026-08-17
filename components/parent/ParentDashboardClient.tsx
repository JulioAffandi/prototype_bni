"use client";

import { useState } from "react";
import {
  Building2,
  ChevronDown,
  User,
  Bell,
  Sparkles,
  ArrowRight,
  Shield,
  CreditCard,
} from "lucide-react";
import Link from "next/link";
import { formatRupiah } from "@/lib/format";
import EduConnectLogo from "@/components/shared/EduConnectLogo";
import GradientBalanceCard from "@/components/shared/GradientBalanceCard";
import QuickActionGrid from "./QuickActionGrid";
import WeeklySummaryChart, { DaySpending } from "./WeeklySummaryChart";
import RecentActivityCard, { RecentTransactionItem } from "./RecentActivityCard";

export type DashboardStudent = {
  id: string;
  schoolId: string;
  schoolName: string;
  fullName: string;
  studentNumber: string;
  gradeClass: string;
  dailyLimit: number;
  dailyLimitUsed: number;
  vaultBalance: number;
  cardStatus: string;
  cardLast4: string;
};

export type ParentWallet = {
  balance: number;
  accountNumber: string;
  accountName: string;
};

interface ParentDashboardClientProps {
  parentWallet: ParentWallet;
  students: DashboardStudent[];
  recentTaps: RecentTransactionItem[];
  pendingInvoices?: unknown[];
  weeklySpending?: DaySpending[];
  unreadNotificationCount?: number;
}

export default function ParentDashboardClient({
  parentWallet,
  students,
  recentTaps,
  weeklySpending,
  unreadNotificationCount = 2,
}: ParentDashboardClientProps) {
  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id || "");
  const activeStudent = students.find((student) => student.id === selectedStudentId) || students[0];

  const sisaPagu = activeStudent
    ? Math.max(0, activeStudent.dailyLimit - activeStudent.dailyLimitUsed)
    : 0;
  const paguPercent = activeStudent && activeStudent.dailyLimit > 0
    ? Math.min(100, Math.round((activeStudent.dailyLimitUsed / activeStudent.dailyLimit) * 100))
    : 0;

  return (
    <div className="space-y-4">
      {/* 1. Header Bar: Logo & Parent Greeting + Notification Bell */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3">
          <EduConnectLogo variant="full" width={130} height={38} href="/dashboard" priority />
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/notifikasi"
            id="btn-dashboard-notification"
            className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-portal-border bg-portal-surface text-portal-text shadow-sm hover:bg-portal-surface-alt transition-colors"
            aria-label="Notifikasi"
          >
            <Bell size={18} className="text-portal-text" />
            {unreadNotificationCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-portal-accent text-[10px] font-bold text-white shadow-sm animate-pulse">
                {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Parent Welcome Subheading */}
      <div className="px-1">
        <p className="text-xs font-semibold text-portal-muted">Selamat datang,</p>
        <h1 className="text-lg font-extrabold text-portal-text tracking-tight">
          Hai, {parentWallet.accountName || "Ayah / Bunda"} 👋
        </h1>
      </div>

      {/* 2. Gradient Hero Balance Card */}
      <GradientBalanceCard
        variant="wallet"
        balance={parentWallet.balance}
        accountNumber={parentWallet.accountNumber}
        accountName={parentWallet.accountName}
        topUpHref="/topup"
      />

      {/* 3. Quick Action Grid (4 Actions) */}
      <QuickActionGrid />

      {/* 4. Child Selector (if multiple children) */}
      {students.length > 1 && (
        <div className="space-y-1.5">
          <label
            htmlFor="dashboard-student-selector"
            className="text-[11px] font-bold uppercase tracking-wider text-portal-muted flex items-center gap-1.5"
          >
            <User className="text-portal-primary" size={13} />
            Pilih Siswa / Anak
          </label>
          <div className="relative">
            <select
              id="dashboard-student-selector"
              value={selectedStudentId}
              onChange={(event) => setSelectedStudentId(event.target.value)}
              className="w-full appearance-none rounded-2xl border border-portal-border bg-portal-surface px-4 py-2.5 text-xs font-bold text-portal-text focus:border-portal-primary focus:outline-none focus:ring-2 focus:ring-portal-primary/20 pr-10 shadow-portal-card cursor-pointer"
            >
              {students.map((student) => (
                <option key={student.id} value={student.id} className="bg-white text-slate-900">
                  {student.fullName} — {student.gradeClass ? `${student.gradeClass} • ` : ""}{student.schoolName}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-portal-muted">
              <ChevronDown size={16} />
            </div>
          </div>
        </div>
      )}

      {/* 5. Active Child Status Card */}
      {activeStudent ? (
        <div className="rounded-[1.5rem] border border-portal-border bg-portal-surface p-4 sm:p-5 space-y-3.5 shadow-portal-card">
          <div className="flex items-center justify-between border-b border-portal-border pb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-portal-text truncate">
                  {activeStudent.fullName}
                </h2>
                <Link
                  href={`/profil-anak/${activeStudent.id}`}
                  className="text-[10px] font-bold text-portal-primary hover:underline"
                >
                  Detail Profil
                </Link>
              </div>
              <p className="text-[11px] text-portal-muted flex items-center gap-1 mt-0.5 min-w-0">
                <Building2 className="text-portal-primary shrink-0" size={12} />
                <span className="truncate">{activeStudent.schoolName}</span>
              </p>
            </div>
            <span className="shrink-0 text-[10px] font-mono font-bold text-portal-primary bg-purple-50 border border-purple-100 px-2.5 py-1 rounded-lg">
              NISN: {activeStudent.studentNumber}
            </span>
          </div>

          {/* Pagu Consumption Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-portal-muted">Penggunaan Pagu Hari Ini</span>
              <span className="text-portal-text font-bold">
                {formatRupiah(activeStudent.dailyLimitUsed)} / {formatRupiah(activeStudent.dailyLimit)}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  paguPercent > 90
                    ? "bg-red-500"
                    : paguPercent > 70
                    ? "bg-[#F97316]"
                    : "bg-[#7357C7]"
                }`}
                style={{ width: `${paguPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] pt-0.5">
              <span className="text-emerald-600 font-semibold">
                Sisa Pagu: {formatRupiah(sisaPagu)}
              </span>
              <span className="text-portal-muted">{paguPercent}% terpakai</span>
            </div>
          </div>

          {/* Quick Stats Grid: Sisa Pagu & Vault Balance */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div className="bg-portal-surface-alt p-3 rounded-2xl border border-portal-border/60">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-portal-muted font-bold">
                <Shield size={12} className="text-portal-primary" />
                <span>Limit Pagu</span>
              </div>
              <p className="text-sm font-extrabold text-portal-text mt-1 truncate">
                {formatRupiah(activeStudent.dailyLimit)}
              </p>
              <Link
                className="text-[10px] font-bold text-portal-primary hover:underline mt-1 inline-flex items-center gap-0.5"
                href="/pagu"
              >
                Atur Pagu <ArrowRight size={10} />
              </Link>
            </div>

            <div className="bg-portal-surface-alt p-3 rounded-2xl border border-portal-border/60">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-portal-muted font-bold">
                <CreditCard size={12} className="text-portal-accent" />
                <span>Kartu NFC</span>
              </div>
              <p className="text-xs font-mono font-bold text-portal-text mt-1 truncate">
                {activeStudent.cardLast4}
              </p>
              <Link
                className="text-[10px] font-bold text-portal-accent hover:underline mt-1 inline-flex items-center gap-0.5"
                href="/kartu"
              >
                Status Kartu <ArrowRight size={10} />
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[1.5rem] border border-portal-border bg-portal-surface p-8 text-center space-y-2 shadow-portal-card">
          <p className="text-sm font-bold text-portal-text">Belum Ada Siswa Terhubung</p>
          <p className="text-xs text-portal-muted">Tautkan data siswa terlebih dahulu di menu profil.</p>
        </div>
      )}

      {/* 6. Weekly Spending Chart (Recharts) */}
      <WeeklySummaryChart
        data={weeklySpending}
        studentName={activeStudent?.fullName || "Anak"}
      />

      {/* 7. Recent Canteen Activity Card */}
      <RecentActivityCard transactions={recentTaps} />
    </div>
  );
}
