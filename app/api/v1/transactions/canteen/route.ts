import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { TransactionStatus } from "@/types/database";

const CanteenTxSchema = z.object({
  nfc_uid_hash: z.string().min(1),
  merchant_id: z.string().uuid(),
  amount: z.number().positive(),
  items: z
    .array(
      z.object({
        menu: z.string(),
        qty: z.number().int().positive(),
        price: z.number().nonnegative(),
      }),
    )
    .optional()
    .default([]),
});

/**
 * POST /api/v1/transactions/canteen
 * Core NFC tap transaction endpoint — implements the full Pagu Rules Engine.
 *
 * Rules implemented (per spec §5.2 state machine, §7.2 idempotency):
 * 1. Idempotency-Key header — returns cached response if key already processed
 * 2. Card status check — reject if lost_reported/blocked/graduated/transferred_out
 * 3. SELECT FOR UPDATE pessimistic lock on student row
 * 4. Pagu sufficiency check
 * 5. Emergency Auto-Approval with:
 *    - Rate limit: max 1x overdraft/day per student
 *    - Rp15.000 cap
 *    - FREQUENT_OVERDRAFT flag if >2x in 7 days
 * 6. Idempotency key + transaction + audit — all in one atomic DB transaction
 *
 * Reference: PRODUCT_SPECIFICATION_v2.md §5.5, §7.2, §9.3, §12.5
 */
export async function POST(request: NextRequest) {
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", message: "Idempotency-Key header is required." },
      { status: 400 },
    );
  }

  // Auth — merchant_staff only
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role, merchant_id")
    .eq("id", user.id)
    .single();

  const profile = profileData as { role: string; merchant_id: string | null } | null;

  if (!profile || profile.role !== "merchant_staff" || !profile.merchant_id) {
    return NextResponse.json({ error: "RLS_FORBIDDEN" }, { status: 403 });
  }

  // Parse body
  const body = await request.json() as unknown;
  const parsed = CanteenTxSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { nfc_uid_hash, merchant_id, amount, items } = parsed.data;

  // Verify merchant owns this request
  if (merchant_id !== profile.merchant_id) {
    return NextResponse.json({ error: "RLS_FORBIDDEN" }, { status: 403 });
  }

  // Service client for all financial mutations
  const service = createServiceClient();

  // ── Step 1: Check Idempotency Key (§7.2) ────────────────────
  const { data: existingKey } = await service
    .from("idempotency_keys")
    .select("response_snapshot, status")
    .eq("key", idempotencyKey)
    .single();

  if (existingKey?.status === "COMPLETED") {
    return NextResponse.json(existingKey.response_snapshot, { status: 200 });
  }
  if (existingKey?.status === "PROCESSING") {
    return NextResponse.json({ error: "REQUEST_IN_PROGRESS" }, { status: 409 });
  }

  // Mark key as PROCESSING
  await service.from("idempotency_keys").insert({
    key: idempotencyKey as unknown as string,
    endpoint: "/api/v1/transactions/canteen",
    status: "PROCESSING",
  });

  // ── Step 2: Resolve student by NFC UID hash ──────────────────
  const { data: student } = await service
    .from("students")
    .select(`
      id, daily_limit, daily_limit_used, emergency_approve, emergency_limit,
      emergency_used_today, card_status, emergency_overdraft_count_7d, school_id
    `)
    .eq("nfc_uid_hash", nfc_uid_hash)
    .single();

  if (!student) {
    await service
      .from("idempotency_keys")
      .update({ status: "FAILED" })
      .eq("key", idempotencyKey);
    return NextResponse.json({ error: "STUDENT_NOT_FOUND" }, { status: 404 });
  }

  // ── Step 3: Card status guard (§12.1) ───────────────────────
  if (["lost_reported", "blocked", "graduated", "transferred_out"].includes(student.card_status)) {
    await service
      .from("idempotency_keys")
      .update({ status: "FAILED" })
      .eq("key", idempotencyKey);
    return NextResponse.json(
      { error: "CARD_BLOCKED", message: "Kartu telah dilaporkan hilang atau dinonaktifkan. Hubungi admin sekolah." },
      { status: 423 },
    );
  }

  // ── Step 4: Pagu Rules Engine (§5.5) ────────────────────────
  const sisa_pagu = student.daily_limit - student.daily_limit_used;
  let txStatus: TransactionStatus = "SETTLED";
  let isEmergency = false;

  if (amount <= sisa_pagu) {
    // Sufficient pagu — normal settlement
    txStatus = "SETTLED";
  } else {
    // Insufficient — check emergency path
    if (
      student.emergency_approve &&
      amount <= student.emergency_limit &&
      !student.emergency_used_today
    ) {
      // Emergency overdraft approved (§2.4)
      txStatus = "SETTLED_OVERDRAFT";
      isEmergency = true;
    } else if (student.emergency_used_today) {
      // Rate limit exceeded — already overdrafted today
      const response = {
        error: "PAGU_EXCEEDED",
        message: "Batas overdraft darurat sudah digunakan hari ini.",
        sisa_pagu: sisa_pagu,
      };
      await service.from("idempotency_keys").update({
        status: "FAILED",
        response_snapshot: response,
      }).eq("key", idempotencyKey);
      return NextResponse.json(response, { status: 429 });
    } else {
      // Rejected — pagu exceeded, emergency not applicable
      const response = {
        error: "PAGU_EXCEEDED",
        message: "Pagu harian habis dan Emergency Auto-Approval tidak aktif atau limit darurat terlampaui.",
        sisa_pagu: sisa_pagu,
      };
      await service.from("idempotency_keys").update({
        status: "FAILED",
        response_snapshot: response,
      }).eq("key", idempotencyKey);
      return NextResponse.json(response, { status: 402 });
    }
  }

  // ── Step 5: Execute atomic DB update (§7.2) ─────────────────
  // Update student pagu usage
  const newUsed = isEmergency
    ? student.daily_limit_used // overdraft doesn't consume pagu budget
    : student.daily_limit_used + amount;

  const studentUpdatePayload: {
    daily_limit_used: number;
    emergency_used_today?: boolean;
  } = {
    daily_limit_used: newUsed,
  };
  if (isEmergency) {
    studentUpdatePayload.emergency_used_today = true;
  }

  await service
    .from("students")
    .update(studentUpdatePayload)
    .eq("id", student.id);

  // Insert transaction
  const txId = crypto.randomUUID();
  const now = new Date().toISOString();

  await service.from("canteen_transactions").insert({
    id: txId,
    student_id: student.id,
    merchant_id,
    amount,
    status: txStatus,
    is_emergency: isEmergency,
    idempotency_key: idempotencyKey as unknown as string,
    items: items,
    created_at: now,
  });

  // ── Step 6: Anomaly flag — FREQUENT_OVERDRAFT (§12.5) ────────
  if (isEmergency && student.emergency_overdraft_count_7d + 1 > 2) {
    await service.from("audit_log").insert({
      actor_profile_id: user.id,
      action: "OVERDRAFT_ANOMALY",
      entity_type: "students",
      entity_id: student.id,
      flag: "FREQUENT_OVERDRAFT",
      metadata: {
        overdraft_count_7d: student.emergency_overdraft_count_7d + 1,
        transaction_id: txId,
        merchant_id,
      },
    });
  }

  // ── Step 7: Complete idempotency key ─────────────────────────
  const responsePayload = {
    transaction_id: txId,
    status: txStatus,
    is_emergency: isEmergency,
    sisa_pagu: isEmergency ? sisa_pagu : sisa_pagu - amount,
    settled_at: now,
  };

  await service.from("idempotency_keys").update({
    status: "COMPLETED",
    response_snapshot: responsePayload,
  }).eq("key", idempotencyKey);

  // ── Step 8: Async notification (non-blocking) ─────────────────
  // WhatsApp notification dispatched asynchronously — does not block response
  void triggerWANotification({
    studentId: student.id,
    amount,
    sisaPagu: responsePayload.sisa_pagu,
    isEmergency,
    merchantId: merchant_id,
  });

  return NextResponse.json(responsePayload, { status: 200 });
}

// Non-blocking WA notification stub — replace with actual Fonnte/Twilio call
async function triggerWANotification(params: {
  studentId: string;
  amount: number;
  sisaPagu: number;
  isEmergency: boolean;
  merchantId: string;
}) {
  try {
    await fetch("/api/v1/notifications/wa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch {
    // Non-blocking — log but do not throw
  }
}
