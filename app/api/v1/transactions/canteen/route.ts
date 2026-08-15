import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import type { CanteenTapRpcResult } from "@/types/database";
import { dispatchAfterResponse } from "@/lib/telegram/after-dispatch";
import { notifyParentCanteenTap, notifyParentPaguAlert, notifyMerchantTransaction } from "@/lib/telegram/notifier";

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
        category: z.string().optional(),
        menu_item_id: z.string().uuid().optional(),
        unit_cost: z.number().nonnegative().optional(),
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

  // Persist transaction line items if transaction_id was created and items exist
  if (result.transaction_id && items.length > 0) {
    try {
      const itemNames = items.map((i) => i.menu);
      const { data: dbMenuItems } = await service
        .from("menu_items")
        .select("id, name, category, unit_cost")
        .eq("merchant_id", merchant_id)
        .in("name", itemNames);

      const menuMap = new Map<string, { id: string; name: string; category: string; unit_cost: number | null }>();
      if (dbMenuItems) {
        for (const m of dbMenuItems) {
          menuMap.set(m.name, m as { id: string; name: string; category: string; unit_cost: number | null });
        }
      }

      const validCategories = new Set([
        "makanan_berat",
        "makanan_ringan",
        "gorengan",
        "minuman_manis",
        "minuman_sehat",
        "buah",
        "lainnya",
      ]);

      const itemRows = items.map((item) => {
        const dbMatch = menuMap.get(item.menu);
        const rawCategory = item.category || dbMatch?.category || "lainnya";
        const safeCategory = validCategories.has(rawCategory) ? rawCategory : "lainnya";

        return {
          transaction_id: result.transaction_id!,
          menu_item_id: item.menu_item_id || dbMatch?.id || null,
          item_name_snapshot: item.menu,
          category_snapshot: safeCategory,
          qty: item.qty,
          unit_price_snapshot: item.price,
          unit_cost_snapshot: item.unit_cost ?? dbMatch?.unit_cost ?? null,
          line_total: item.price * item.qty,
        };
      });

      await service.from("canteen_transaction_items").insert(itemRows as any);
    } catch (itemErr) {
      console.error("Failed to persist canteen_transaction_items:", itemErr);
    }
  }

  // Non-blocking Telegram & WA notification dispatch scheduled after response sent
  if (result.transaction_id) {
    const isSettled = httpStatus === 200;
    const isRejectedOverlimit = result.error === "PAGU_EXCEEDED" || httpStatus === 402;

    if (isSettled) {
      dispatchAfterResponse(async () => {
        const { data: tx } = await service
          .from("canteen_transactions")
          .select("student_id, merchant_id, amount")
          .eq("id", result.transaction_id!)
          .maybeSingle();

        if (!tx) return;

        const { data: targets } = await service
          .rpc("fn_get_telegram_targets", {
            p_student_id: tx.student_id,
            p_merchant_id: tx.merchant_id,
          })
          .single();

        if (!targets) return;

        const jobs: Promise<unknown>[] = [];
        for (const parentChatId of targets.parent_chat_ids ?? []) {
          jobs.push(
            notifyParentCanteenTap({
              parentChatId,
              parentId: "",
              studentName: targets.student_full_name,
              merchantName: targets.merchant_name,
              amount: tx.amount,
              remainingLimit: typeof result.sisa_pagu === "number" ? result.sisa_pagu : 0,
            })
          );
        }

        if (targets.merchant_chat_id) {
          jobs.push(
            notifyMerchantTransaction({
              merchantChatId: targets.merchant_chat_id,
              merchantId: tx.merchant_id,
              studentName: targets.student_full_name,
              amount: tx.amount,
            })
          );
        }

        await Promise.allSettled(jobs);
      }, "canteen-tap-settled");
    } else if (isRejectedOverlimit) {
      dispatchAfterResponse(async () => {
        const { data: tx } = await service
          .from("canteen_transactions")
          .select("student_id, merchant_id, amount")
          .eq("id", result.transaction_id!)
          .maybeSingle();

        if (!tx) return;

        const { data: targets } = await service
          .rpc("fn_get_telegram_targets", {
            p_student_id: tx.student_id,
            p_merchant_id: tx.merchant_id,
          })
          .single();

        if (!targets) return;

        const jobs = (targets.parent_chat_ids ?? []).map((chatId) =>
          notifyParentPaguAlert({
            parentChatId: chatId,
            parentId: "",
            studentName: targets.student_full_name,
            attemptedAmount: amount,
          })
        );

        await Promise.allSettled(jobs);
      }, "canteen-tap-rejected");
    }
  }

  return NextResponse.json(result, { status: httpStatus });
}
