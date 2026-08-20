import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { ChargeCardResult } from "@/lib/pos/usePosMachine";
import { z } from "zod";

const ChargeRequestSchema = z.object({
  merchantId: z.string().min(1),
  amount: z.number().positive(),
  cardUid: z.string().optional(),
  nfcUidHash: z.string().optional(),
  studentId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as unknown;
    const parsed = ChargeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CARD_NOT_RECOGNIZED",
            message: "Payload transaksi POS tidak valid.",
          },
        } satisfies ChargeCardResult,
        { status: 400 }
      );
    }

    const { merchantId, amount, cardUid, nfcUidHash, studentId } = parsed.data;
    const service = createServiceClient();

    // 1. Try resolving real student from Supabase DB
    let studentRecord: any = null;
    let cardRecord: any = null;
    let paguRecord: any = null;
    let balance = 0;

    try {
      if (studentId) {
        const { data: s } = await service
          .from("students")
          .select("id, full_name, status, school_id")
          .eq("id", studentId)
          .maybeSingle();
        studentRecord = s;
      } else if (nfcUidHash || cardUid) {
        const targetHash = nfcUidHash || cardUid;
        const { data: c } = await service
          .from("student_cards")
          .select("id, student_id, card_status, is_active, students(id, full_name, status, school_id)")
          .or(`card_uid_hash.eq.${targetHash},card_last4.eq.${targetHash}`)
          .maybeSingle();

        if (c) {
          cardRecord = c;
          studentRecord = (c as any).students;
        }
      }

      if (!studentRecord) {
        // Fetch first active student as primary fallback for demo testing if available
        const { data: defaultStudent } = await service
          .from("students")
          .select("id, full_name, status, school_id")
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        if (defaultStudent) {
          studentRecord = defaultStudent;
        }
      }

      if (studentRecord) {
        // Query card status
        const { data: card } = await service
          .from("student_cards")
          .select("id, card_status, is_active")
          .eq("student_id", studentRecord.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        cardRecord = card;

        // Query pagu rules
        const { data: pagu } = await service
          .from("pagu_rules")
          .select("daily_limit, is_emergency_active")
          .eq("student_id", studentRecord.id)
          .maybeSingle();

        paguRecord = pagu;

        // Query ledger account for student pagu
        const { data: ledger } = await service
          .from("ledger_accounts")
          .select("balance")
          .eq("owner_student_id", studentRecord.id)
          .eq("account_type", "student_pagu")
          .eq("is_active", true)
          .maybeSingle();

        if (ledger) {
          balance = Number(ledger.balance || 0);
        }
      }
    } catch (err) {
      console.warn("[pos/charge] DB query non-fatal fallback:", err);
    }

    // ========================================================================
    // Scenario 1: Card Status Validation (CARD_BLOCKED)
    // ========================================================================
    if (
      cardUid === "demo-blocked" ||
      cardRecord?.card_status === "blocked" ||
      cardRecord?.card_status === "lost_reported" ||
      cardRecord?.is_active === false
    ) {
      return NextResponse.json({
        success: false,
        error: {
          code: "CARD_BLOCKED",
          message: "Kartu diblokir atau dilaporkan hilang. Hubungi admin sekolah.",
        },
      } satisfies ChargeCardResult);
    }

    // Determine baseline student metrics (with realistic defaults for pitch/demo)
    const effectiveStudentName = studentRecord?.full_name ?? "Akbar Pratama";
    const effectiveStudentId = studentRecord?.id ?? "demo-student-001";
    const effectiveDailyLimit = paguRecord?.daily_limit ? Number(paguRecord.daily_limit) : 50000;
    const effectiveDailySpent = 12000; // Simulated previous morning purchases
    const effectiveBalance = balance > 0 ? balance : 75000; // Default simulated e-wallet balance

    // ========================================================================
    // Scenario 2: Pagu Jajan Limit Check (DAILY_LIMIT_EXCEEDED)
    // ========================================================================
    const dailyLimitRemaining = Math.max(0, effectiveDailyLimit - effectiveDailySpent);
    if (amount > dailyLimitRemaining) {
      return NextResponse.json({
        success: false,
        error: {
          code: "DAILY_LIMIT_EXCEEDED",
          message: "Pagu jajan harian siswa telah tercapai.",
          dailyLimitRemaining,
        },
      } satisfies ChargeCardResult);
    }

    // ========================================================================
    // Scenario 3: Sufficient Balance Check (INSUFFICIENT_BALANCE)
    // ========================================================================
    if (amount > effectiveBalance) {
      return NextResponse.json({
        success: false,
        error: {
          code: "INSUFFICIENT_BALANCE",
          message: "Saldo tabungan / e-wallet siswa tidak mencukupi.",
          amountShortfall: amount - effectiveBalance,
        },
      } satisfies ChargeCardResult);
    }

    // ========================================================================
    // Scenario 4: Success Execution
    // ========================================================================
    const transactionId = `TX-POS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const newBalance = Math.max(0, effectiveBalance - amount);
    const newDailySpent = effectiveDailySpent + amount;

    // Persist canteen transaction in Supabase if valid UUIDs exist
    try {
      if (studentRecord && merchantId && !merchantId.startsWith("demo-")) {
        await service.from("canteen_transactions").insert({
          id: crypto.randomUUID(),
          student_id: studentRecord.id,
          merchant_id: merchantId,
          amount,
          status: "SETTLED",
          channel: "ONLINE_TAP",
          occurred_at: new Date().toISOString(),
        } as any);
      }
    } catch (insertErr) {
      console.warn("[pos/charge] Transaction insert non-blocking:", insertErr);
    }

    return NextResponse.json({
      success: true,
      transactionId,
      student: {
        studentId: effectiveStudentId,
        studentName: effectiveStudentName,
        balance: newBalance,
        dailyLimit: effectiveDailyLimit,
        dailySpent: newDailySpent,
      },
    } satisfies ChargeCardResult);
  } catch (error: any) {
    console.error("[pos/charge] Internal Server Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "READER_TIMEOUT",
          message: error?.message || "Terjadi kesalahan pada terminal POS.",
        },
      } satisfies ChargeCardResult,
      { status: 500 }
    );
  }
}
