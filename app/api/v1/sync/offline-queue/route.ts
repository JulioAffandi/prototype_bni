import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import type { Json, txn_status_t, CanteenTapRpcResult } from "@/types/database";

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
  pagu_snapshot: z.number().nonnegative().optional(),
});

const SyncRequestSchema = z.object({
  transactions: z.array(OfflinePayloadSchema),
});

/**
 * POST /api/v1/sync/offline-queue
 * Schema v3 Offline Queue Sync Handler.
 * Invokes public.fn_process_canteen_tap() with p_channel='OFFLINE_SYNC' for each queued transaction.
 * Reference: Schema v3 §12 (offline_sync_queue) & §17.1 (fn_process_canteen_tap)
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const service = createServiceClient();

  const body = await request.json() as unknown;
  const parsed = SyncRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const results: {
    local_tx_uuid: string;
    status: txn_status_t | "CONFLICT" | "DISCARDED";
    transaction_id?: string;
  }[] = [];

  // Sort by client timestamp — process oldest first
  const sorted = [...parsed.data.transactions].sort(
    (a, b) => a.created_at_local - b.created_at_local,
  );

  for (const tx of sorted) {
    // Check if already synced in offline_sync_queue
    const { data: existingSync } = await service
      .from("offline_sync_queue")
      .select("sync_status, resulting_txn_id")
      .eq("merchant_id", tx.merchant_id)
      .eq("local_tx_uuid", tx.local_tx_uuid)
      .maybeSingle();

    if (existingSync?.sync_status === "SYNCED") {
      results.push({
        local_tx_uuid: tx.local_tx_uuid,
        status: "SETTLED",
        transaction_id: existingSync.resulting_txn_id || undefined,
      });
      continue;
    }

    // Format bytea hash
    let byteaHash: string;
    if (tx.nfc_uid_hash.startsWith("\\x")) {
      byteaHash = tx.nfc_uid_hash.toLowerCase();
    } else if (/^[0-9a-fA-F]{64}$/.test(tx.nfc_uid_hash)) {
      byteaHash = `\\x${tx.nfc_uid_hash.toLowerCase()}`;
    } else {
      const salt = process.env.TENANT_SALT_SECRET || "";
      const rawHash = createHash("sha256")
        .update(tx.nfc_uid_hash + salt)
        .digest("hex");
      byteaHash = `\\x${rawHash.toLowerCase()}`;
    }

    // Lookup merchant school_id for offline_sync_queue record
    const { data: merchantObj } = await service
      .from("merchants")
      .select("school_id")
      .eq("id", tx.merchant_id)
      .maybeSingle();

    const schoolId = merchantObj?.school_id || "00000000-0000-0000-0000-000000000000";
    const capturedAt = new Date(tx.created_at_local).toISOString();

    // Call atomic RPC
    const { data: rpcData, error: rpcError } = await service.rpc("fn_process_canteen_tap", {
      p_idempotency_key: tx.local_tx_uuid,
      p_card_uid_hash: byteaHash,
      p_merchant_id: tx.merchant_id,
      p_amount: tx.amount,
      p_items: tx.items,
      p_client_local_tx_uuid: tx.local_tx_uuid,
      p_channel: "OFFLINE_SYNC",
      p_occurred_at: capturedAt,
    });

    const res = (rpcData || {}) as CanteenTapRpcResult;
    const httpStatus = typeof res.http_status === "number" ? res.http_status : 200;

    if (!rpcError && httpStatus === 200 && res.transaction_id) {
      await service.from("offline_sync_queue").upsert({
        merchant_id: tx.merchant_id,
        school_id: schoolId,
        local_tx_uuid: tx.local_tx_uuid,
        payload: tx as unknown as Json,
        sync_status: "SYNCED",
        resulting_txn_id: res.transaction_id,
        device_captured_at: capturedAt,
        synced_at: new Date().toISOString(),
      });

      results.push({
        local_tx_uuid: tx.local_tx_uuid,
        status: "SETTLED",
        transaction_id: res.transaction_id,
      });
    } else if (httpStatus === 402) {
      // Overlimit conflict
      await service.from("offline_sync_queue").upsert({
        merchant_id: tx.merchant_id,
        school_id: schoolId,
        local_tx_uuid: tx.local_tx_uuid,
        payload: tx as unknown as Json,
        sync_status: "CONFLICT",
        conflict_reason: res.error || "PAGU_EXCEEDED",
        device_captured_at: capturedAt,
        synced_at: new Date().toISOString(),
      });

      results.push({ local_tx_uuid: tx.local_tx_uuid, status: "CONFLICT" });
    } else {
      // Discarded (card blocked, student not found, etc.)
      await service.from("offline_sync_queue").upsert({
        merchant_id: tx.merchant_id,
        school_id: schoolId,
        local_tx_uuid: tx.local_tx_uuid,
        payload: tx as unknown as Json,
        sync_status: "DISCARDED",
        conflict_reason: res.error || "SYNC_FAILED",
        device_captured_at: capturedAt,
        synced_at: new Date().toISOString(),
      });

      results.push({ local_tx_uuid: tx.local_tx_uuid, status: "DISCARDED" });
    }
  }

  return NextResponse.json({ processed: results });
}
