import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { TransactionStatus } from "@/types/database";

const OfflinePayloadSchema = z.object({
  local_tx_uuid: z.string().uuid(),
  nfc_uid_hash: z.string().min(1),
  merchant_id: z.string().uuid(),
  amount: z.number().positive(),
  items: z.array(z.object({
    menu: z.string(),
    qty: z.number().int().positive(),
    price: z.number().nonnegative(),
  })).default([]),
  created_at_local: z.number(),
  pagu_snapshot: z.number().nonnegative(),
});

const SyncRequestSchema = z.object({
  transactions: z.array(OfflinePayloadSchema),
});

/**
 * POST /api/v1/sync/offline-queue
 * Syncs IndexedDB offline transactions when connection is restored.
 * Each transaction is re-validated server-side against current pagu.
 * Per-local_tx_uuid idempotency prevents duplicate processing on retry.
 * Reference: PRODUCT_SPECIFICATION_v2.md §8.2, §8.3
 */
export async function POST(request: NextRequest) {
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

  const body = await request.json() as unknown;
  const parsed = SyncRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const results: {
    local_tx_uuid: string;
    status: TransactionStatus | "CONFLICT" | "DISCARDED";
    transaction_id?: string;
  }[] = [];

  // Sort by client timestamp — process oldest first (§8.2 conflict resolution)
  const sorted = [...parsed.data.transactions].sort(
    (a, b) => a.created_at_local - b.created_at_local,
  );

  for (const tx of sorted) {
    // Check if already synced (idempotent per local_tx_uuid)
    const { data: existingSync } = await service
      .from("offline_sync_queue")
      .select("sync_status, id")
      .eq("local_tx_uuid", tx.local_tx_uuid)
      .single();

    if (existingSync?.sync_status === "SYNCED") {
      results.push({ local_tx_uuid: tx.local_tx_uuid, status: "SETTLED" });
      continue;
    }

    // Validate merchant ownership
    if (tx.merchant_id !== profile.merchant_id) {
      results.push({ local_tx_uuid: tx.local_tx_uuid, status: "DISCARDED" });
      continue;
    }

    // Re-validate pagu server-side
    const { data: student } = await service
      .from("students")
      .select("id, daily_limit, daily_limit_used, card_status")
      .eq("nfc_uid_hash", tx.nfc_uid_hash)
      .single();

    if (!student || student.card_status !== "active") {
      results.push({ local_tx_uuid: tx.local_tx_uuid, status: "DISCARDED" });
      await service.from("offline_sync_queue").upsert({
        merchant_id: tx.merchant_id,
        local_tx_uuid: tx.local_tx_uuid,
        payload: tx as unknown as Record<string, unknown>,
        sync_status: "DISCARDED",
        synced_at: new Date().toISOString(),
      });
      continue;
    }

    const sisa_pagu = student.daily_limit - student.daily_limit_used;

    if (tx.amount > sisa_pagu) {
      // Conflict — pagu was depleted by online transactions processed first
      results.push({ local_tx_uuid: tx.local_tx_uuid, status: "CONFLICT" });
      await service.from("offline_sync_queue").upsert({
        merchant_id: tx.merchant_id,
        local_tx_uuid: tx.local_tx_uuid,
        payload: tx as unknown as Record<string, unknown>,
        sync_status: "CONFLICT",
        synced_at: new Date().toISOString(),
      });
      continue;
    }

    // Settle the transaction
    const txId = crypto.randomUUID();
    const now = new Date().toISOString();

    await service.from("students").update({
      daily_limit_used: student.daily_limit_used + tx.amount,
    }).eq("id", student.id);

    await service.from("canteen_transactions").insert({
      id: txId,
      student_id: student.id,
      merchant_id: tx.merchant_id,
      amount: tx.amount,
      status: "SETTLED",
      is_emergency: false,
      idempotency_key: tx.local_tx_uuid as unknown as string,
      client_local_tx_uuid: tx.local_tx_uuid as unknown as string,
      items: tx.items,
      created_at: now,
    });

    await service.from("offline_sync_queue").upsert({
      merchant_id: tx.merchant_id,
      local_tx_uuid: tx.local_tx_uuid,
      payload: tx as unknown as Record<string, unknown>,
      sync_status: "SYNCED",
      synced_at: now,
    });

    results.push({
      local_tx_uuid: tx.local_tx_uuid,
      status: "SETTLED",
      transaction_id: txId,
    });
  }

  return NextResponse.json({ processed: results });
}
