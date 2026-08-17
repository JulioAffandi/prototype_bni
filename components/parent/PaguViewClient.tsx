"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ChildSelectorBar, { type StudentPaguItem } from "./ChildSelectorBar";
import PaguSlider from "./PaguSlider";
import EmergencyToggle from "./EmergencyToggle";
import CardManagementCard from "./CardManagementCard";

interface PaguViewClientProps {
  students: StudentPaguItem[];
}

export default function PaguViewClient({ students }: PaguViewClientProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    students[0]?.id ?? ""
  );

  if (!students || students.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center space-y-3">
        <p className="text-sm font-semibold">Belum Ada Siswa Terhubung</p>
        <p className="text-xs text-muted-foreground">
          Tautkan data siswa terlebih dahulu di halaman Dashboard untuk mengatur pagu harian.
        </p>
      </div>
    );
  }

  const activeStudent =
    students.find((s) => s.id === selectedStudentId) || students[0];

  return (
    <div className="space-y-4">
      {/* 1. Sticky Segmented Child Selector Bar */}
      {students.length > 1 && (
        <ChildSelectorBar
          students={students}
          selectedStudentId={activeStudent.id}
          onSelectStudent={setSelectedStudentId}
        />
      )}

      {/* 2. Active Student Single View with Smooth Transition */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStudent.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          {/* Active Student Badge / Header info */}
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-extrabold text-foreground tracking-tight flex items-center gap-2">
              <span>{activeStudent.full_name}</span>
              {activeStudent.class_label && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary font-medium">
                  Kelas {activeStudent.class_label}
                </span>
              )}
            </h2>
            <span className="text-xs text-muted-foreground font-mono">
              NFC UID: ****{activeStudent.nfc_uid_last4}
            </span>
          </div>

          {/* Card 1: Usage Card & Daily Pagu Slider */}
          <PaguSlider
            studentId={activeStudent.id}
            studentName={activeStudent.full_name}
            currentLimit={activeStudent.daily_limit}
            currentUsed={activeStudent.daily_limit_used}
          />

          {/* Card 2: Emergency Auto-Approval & Overdraft Status */}
          <EmergencyToggle
            studentId={activeStudent.id}
            studentName={activeStudent.full_name}
            emergencyApprove={activeStudent.emergency_approve}
            emergencyLimit={activeStudent.emergency_limit}
            emergencyUsedToday={activeStudent.emergency_used_today}
            overdraftCount7d={activeStudent.emergency_overdraft_count_7d}
          />

          {/* Card 3: NFC Card & Block/Report Management */}
          <CardManagementCard
            studentId={activeStudent.id}
            studentName={activeStudent.full_name}
            nfcUidLast4={activeStudent.nfc_uid_last4}
            cardStatus={activeStudent.card_status}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
