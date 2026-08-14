import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import type { CanteenTapRpcResult } from "@/types/database";

const CanteenTxSchema = z.object({
  nfc_uid_hash: z.string().min(1),
  merchant_id: z.string().uuid(),
  amount: z.number().positive(),
  client_local_tx_uuid: z.string().uuid().optional(),
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
 * Canteen POS Transaction Route — Schema v3 Atomic Single-RPC Execution.
 *
 * Calls public.fn_process_canteen_tap() to perform idempotency checks,
 * card resolution, daily counter updates, pagu rules validation, and
 * double-entry ledger journal postings in a single database transaction.
 *
 * Reference: Schema v3 DDL §17.1 (fn_process_canteen_tap)
 */
export async function POST(request: NextRequest) {
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", message: "Idempotency-Key header is required." },
      { status: 400 },
    );
  }

  // Authenticate caller
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
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

  const { nfc_uid_hash, merchant_id, amount, items, client_local_tx_uuid } = parsed.data;

  // Format SHA-256 card UID hash into Postgres bytea hex string (\x...)
  let byteaHash: string;
  if (nfc_uid_hash.startsWith("\\x")) {
    byteaHash = nfc_uid_hash.toLowerCase();
  } else if (/^[0-9a-fA-F]{64}$/.test(nfc_uid_hash)) {
    byteaHash = `\\x${nfc_uid_hash.toLowerCase()}`;
  } else {
    // Treat as raw UID: digest with salt
    const salt = process.env.TENANT_SALT_SECRET || "";
    const rawHash = createHash("sha256")
      .update(nfc_uid_hash + salt)
      .digest("hex");
    byteaHash = `\\x${rawHash.toLowerCase()}`;
  }

  // Execute atomic RPC fn_process_canteen_tap using service client
  const service = createServiceClient();

  const { data: rpcData, error: rpcError } = await service.rpc("fn_process_canteen_tap", {
    p_idempotency_key: idempotencyKey,
    p_card_uid_hash: byteaHash,
    p_merchant_id: merchant_id,
    p_amount: amount,
    p_items: items,
    p_client_local_tx_uuid: client_local_tx_uuid ?? null,
    p_channel: "ONLINE_TAP",
    p_occurred_at: new Date().toISOString(),
  });

  if (rpcError) {
    return NextResponse.json(
      { error: "RPC_EXECUTION_ERROR", detail: rpcError.message },
      { status: 500 },
    );
  }

  const result = (rpcData || {}) as CanteenTapRpcResult;
  const httpStatus = typeof result.http_status === "number" ? result.http_status : 200;

  // Non-blocking WA notification dispatch on successful settlement
  if (httpStatus === 200 && result.transaction_id) {
    void triggerWANotification({
      merchantId: merchant_id,
      amount,
      sisaPagu: result.sisa_pagu ?? 0,
      isEmergency: !!result.is_emergency,
    });
  }

  return NextResponse.json(result, { status: httpStatus });
}

// Non-blocking WA notification helper
async function triggerWANotification(params: {
  merchantId: string;
  amount: number;
  sisaPagu: number;
  isEmergency: boolean;
}) {
  try {
    await fetch("/api/v1/notifications/wa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch {
    // Non-blocking — silently ignore failures
  }
}
