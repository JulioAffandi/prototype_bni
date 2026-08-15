# Telegram Notification System — Implementation Plan v2.0
### Production-Hardened Revision — VALO Closed-Loop Education Ecosystem

---

## Changelog from v1

| # | Gap in v1 | Fix in v2 |
|---|---|---|
| 1 | `void notifyX()` fire-and-forget can be killed mid-flight when the serverless function freezes after the response is sent | All dispatches now scheduled via Next.js 15 `after()` from `next/server` |
| 2 | MarkdownV2 templates — one unescaped `.`/`-`/`!` silently breaks delivery | Standardized on `parse_mode: 'HTML'` with a shared `escapeHtml()` helper |
| 3 | No handling for Telegram's `403` (user blocked bot) / `429` (rate limited) | `sendTelegramMessage()` returns a typed result, auto-disables broken links on `403`, retries once on `429` respecting `retry_after` |
| 4 | Multiple round-trips to resolve `telegram_chat_id` per event | Single Postgres RPC `fn_get_telegram_targets()` returns all recipient chat IDs in one round trip |
| 5 | No self-serve way to verify a linked Chat ID | New `POST /api/v1/telegram/test` + "Kirim Pesan Uji Coba" button |
| 6 | No input validation / authorization guard on the link endpoint | Chat ID format validation + ownership check against `profiles` before write |

---

## Architecture Notes

- `lib/telegram/notifier.ts` — Message templates + typed dispatcher functions (HTML parse mode).
- `lib/telegram/client.ts` — Low-level `sendTelegramMessage()` transport: retry, error classification, chat-unlink-on-403.
- `lib/telegram/after-dispatch.ts` — Thin wrapper around `next/server`'s `after()` so every call site uses the same pattern.
- `telegram_chat_id` columns — Added to `parents`, `merchants`, `schools` (matches `PRODUCT_SPECIFICATION_v2.md` §6.1 schema: `parents.id`, `merchants.id`, `schools.id` are all `uuid`).
- `telegram_link_failures` — **New** small table to track consecutive `403 Forbidden` results per chat, so we can surface "notification broken" in Settings UI instead of silently dropping messages forever.
- **Link API** (`/api/v1/telegram/link`) — Server-side PATCH, authenticates via Supabase session, resolves entity through `profiles` (never trusts a client-supplied entity ID), validates Chat ID format, updates `telegram_chat_id`.
- **Test API** (`/api/v1/telegram/test`) — Sends a lightweight confirmation message to the currently-linked Chat ID.
- **Settings UI** — One shared `TelegramSettingsCard` client component used in all three portals (parent, school, canteen/POS), now with a "Send Test Message" action and a broken-link warning state.
- **Event hooks** — Three existing API routes modified to dispatch Telegram notifications via `after()`, using the single-round-trip RPC for recipient lookup.

---

## User Review Required

> [!IMPORTANT]
> **Database Migration**: Two migrations are needed — (1) `telegram_chat_id TEXT NULL` on `parents`, `merchants`, `schools`, and (2) the new `telegram_link_failures` table + `fn_get_telegram_targets()` RPC. Apply both via Supabase CLI/dashboard before deploying the linking feature or the event hooks.

> [!WARNING]
> **Bot Token Security — action required before merging.** The draft plan pasted a live-looking `TELEGRAM_BOT_TOKEN` value directly into a markdown file. Even though `.env.local` is git-ignored, the *plan document itself* is not — if this file is committed, the token leaks. Recommended before proceeding:
> 1. Rotate the token now via `@BotFather` → `/revoke` on the existing bot, generate a new one.
> 2. Store only in `.env.local` (local) and your hosting provider's encrypted env store (production) — never in a `.md` file, ticket, or chat log.
> 3. This plan below uses `TELEGRAM_BOT_TOKEN` as a placeholder reference only.

> [!NOTE]
> **Chat ID Linking Flow**: Users self-link by finding their Chat ID (via `@userinfobot` or starting the bot) and entering it in the Settings card. A deep-link `/start <token>` flow (webhook-based bot) remains out of scope for MVP; manual entry + the new "Send Test Message" verification step compensates for the lack of an automated handshake.

---

## Proposed Changes

### 1. Environment Configuration

#### [MODIFY] `.env.local`
```
TELEGRAM_BOT_TOKEN="<rotated-token-here>"
TELEGRAM_API_BASE="https://api.telegram.org"
```
- Rotate the token per the warning above before adding it anywhere.

---

### 2. Database Migration

#### [NEW] `supabase/migrations/20260815_add_telegram_chat_id.sql`
```sql
-- Add telegram_chat_id columns for Telegram notification linking
ALTER TABLE public.parents   ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT NULL;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT NULL;
ALTER TABLE public.schools   ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT NULL;

-- Basic format guard at the DB layer (defense in depth on top of app-level validation)
ALTER TABLE public.parents
  ADD CONSTRAINT chk_parents_chat_id_format
  CHECK (telegram_chat_id IS NULL OR telegram_chat_id ~ '^-?\d{5,15}$');
ALTER TABLE public.merchants
  ADD CONSTRAINT chk_merchants_chat_id_format
  CHECK (telegram_chat_id IS NULL OR telegram_chat_id ~ '^-?\d{5,15}$');
ALTER TABLE public.schools
  ADD CONSTRAINT chk_schools_chat_id_format
  CHECK (telegram_chat_id IS NULL OR telegram_chat_id ~ '^-?\d{5,15}$');
```

#### [NEW] `supabase/migrations/20260815_telegram_dispatch_infra.sql`
```sql
-- Tracks consecutive delivery failures per chat so the Settings UI can warn the user
-- and so we stop wasting Telegram API calls on dead chat IDs.
CREATE TABLE public.telegram_link_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type varchar NOT NULL CHECK (entity_type IN ('parent','merchant','school')),
  entity_id uuid NOT NULL,
  chat_id text NOT NULL,
  consecutive_failures int NOT NULL DEFAULT 0,
  last_error_code int,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

-- Single-round-trip recipient resolution for the canteen tap hook.
-- Returns every guardian's chat id (array) + the merchant's chat id in one call.
CREATE OR REPLACE FUNCTION public.fn_get_telegram_targets(
  p_student_id uuid,
  p_merchant_id uuid
)
RETURNS TABLE (
  parent_chat_ids text[],
  merchant_chat_id text,
  student_full_name varchar,
  merchant_name varchar
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT array_agg(p.telegram_chat_id) FILTER (WHERE p.telegram_chat_id IS NOT NULL)
       FROM public.guardian_student_map gsm
       JOIN public.parents p ON p.id = gsm.parent_id
      WHERE gsm.student_id = p_student_id) AS parent_chat_ids,
    (SELECT m.telegram_chat_id FROM public.merchants m WHERE m.id = p_merchant_id) AS merchant_chat_id,
    (SELECT s.full_name FROM public.students s WHERE s.id = p_student_id) AS student_full_name,
    (SELECT m.name FROM public.merchants m WHERE m.id = p_merchant_id) AS merchant_name;
$$;
```
**Why an RPC instead of two Supabase client calls:** the canteen tap route is latency-critical (p95 target < 800ms per `PRODUCT_SPECIFICATION_v2.md` §14.2). A single `rpc()` call is one network round trip regardless of how many guardians a student has, versus N+1 round trips if you queried `guardian_student_map` → `parents` → `merchants` separately from the client. Because this runs inside `after()` it no longer blocks the tap response either way, but keeping it to one round trip still matters for overall DB load at scale (50 schools × concurrent taps).

---

### 3. TypeScript Types

#### [MODIFY] `types/database.ts`
Add `telegram_chat_id: string | null` to the `Row`/`Insert`/`Update` types for `parents`, `merchants`, `schools`, plus a new `telegram_link_failures` table type and the `fn_get_telegram_targets` RPC return type:

```typescript
export type TelegramTargetsResult = {
  parent_chat_ids: string[] | null;
  merchant_chat_id: string | null;
  student_full_name: string;
  merchant_name: string;
};
```

---

### 4. Low-Level Transport

#### [NEW] `lib/telegram/client.ts`
```typescript
type SendResult =
  | { ok: true }
  | { ok: false; code: number; description: string; retryAfterSec?: number };

const TELEGRAM_API = process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org";
const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

/** Escapes user- and system-generated text for Telegram's HTML parse mode. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Sends a single Telegram message using parse_mode: 'HTML'.
 * HTML mode only requires escaping &, <, > — far less fragile than MarkdownV2,
 * which additionally requires escaping . - ! ( ) [ ] { } # + = | ~ ` > and more.
 *
 * Retries once on 429, respecting Telegram's `retry_after` hint.
 * On 403 (bot blocked / chat not found), does NOT retry — caller should
 * record the failure via recordDeliveryFailure() so the UI can surface it.
 */
export async function sendTelegramMessage(
  chatId: string,
  html: string,
  attempt = 1
): Promise<SendResult> {
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (res.ok) return { ok: true };

    const body = await res.json().catch(() => ({}));
    const code = res.status;
    const description = body?.description ?? "Unknown Telegram API error";

    if (code === 429 && attempt === 1) {
      const retryAfterSec = body?.parameters?.retry_after ?? 2;
      await new Promise((r) => setTimeout(r, retryAfterSec * 1000));
      return sendTelegramMessage(chatId, html, 2);
    }

    return { ok: false, code, description, retryAfterSec: body?.parameters?.retry_after };
  } catch (err) {
    // Network-level failure (DNS, timeout) — treat as transient, do not disable the link.
    return { ok: false, code: 0, description: err instanceof Error ? err.message : "network error" };
  }
}
```

---

### 5. Core Telegram Service

#### [NEW] `lib/telegram/notifier.ts`
```typescript
import { sendTelegramMessage, escapeHtml } from "./client";
import { recordDeliveryFailure, clearDeliveryFailure } from "./failure-tracker";
import { createAdminClient } from "@/lib/supabase/admin"; // service-role client, server-only

async function dispatch(
  entityType: "parent" | "merchant" | "school",
  entityId: string,
  chatId: string,
  html: string
) {
  const result = await sendTelegramMessage(chatId, html);
  if (result.ok) {
    await clearDeliveryFailure(entityType, entityId);
  } else if (result.code === 403) {
    await recordDeliveryFailure(entityType, entityId, chatId, result.code);
  }
  // 429/network errors: log only, do not flag the link as broken.
  return result;
}

// ---- 1. SETTLED canteen tap -> parent ----
export async function notifyParentCanteenTap(params: {
  parentChatId: string;
  parentId: string;
  studentName: string;
  merchantName: string;
  amount: number;
  remainingLimit: number;
}) {
  const html =
    `🍱 <b>Transaksi Kantin Berhasil</b>\n` +
    `Anak: <b>${escapeHtml(params.studentName)}</b>\n` +
    `Kantin: ${escapeHtml(params.merchantName)}\n` +
    `Nominal: <b>Rp${params.amount.toLocaleString("id-ID")}</b>\n` +
    `Sisa pagu hari ini: Rp${params.remainingLimit.toLocaleString("id-ID")}`;
  return dispatch("parent", params.parentId, params.parentChatId, html);
}

// ---- 2. PAGU_EXCEEDED rejection -> parent ----
export async function notifyParentPaguAlert(params: {
  parentChatId: string;
  parentId: string;
  studentName: string;
  attemptedAmount: number;
}) {
  const html =
    `⚠️ <b>Pagu Harian Terlampaui</b>\n` +
    `<b>${escapeHtml(params.studentName)}</b> mencoba transaksi Rp${params.attemptedAmount.toLocaleString("id-ID")} ` +
    `namun ditolak karena pagu harian sudah habis.\n` +
    `Buka aplikasi untuk menyesuaikan pagu atau mengaktifkan mode darurat.`;
  return dispatch("parent", params.parentId, params.parentChatId, html);
}

// ---- 3. SPP payment settled -> parent ----
export async function notifyParentSPPSuccess(params: {
  parentChatId: string;
  parentId: string;
  studentName: string;
  period: string;
  amount: number;
}) {
  const html =
    `✅ <b>Pembayaran SPP Berhasil</b>\n` +
    `Anak: <b>${escapeHtml(params.studentName)}</b>\n` +
    `Periode: ${escapeHtml(params.period)}\n` +
    `Nominal: Rp${params.amount.toLocaleString("id-ID")}`;
  return dispatch("parent", params.parentId, params.parentChatId, html);
}

// ---- 4. Card reported lost -> parent ----
export async function notifyParentCardLostConfirmation(params: {
  parentChatId: string;
  parentId: string;
  studentName: string;
}) {
  const html =
    `🔒 <b>Kartu Diblokir</b>\n` +
    `Kartu <b>${escapeHtml(params.studentName)}</b> telah dilaporkan hilang dan diblokir. ` +
    `Hubungi admin sekolah untuk penerbitan kartu pengganti.`;
  return dispatch("parent", params.parentId, params.parentChatId, html);
}

// ---- 5. SETTLED canteen tap -> merchant ----
export async function notifyMerchantTransaction(params: {
  merchantChatId: string;
  merchantId: string;
  studentName: string;
  amount: number;
}) {
  const html =
    `💰 <b>Transaksi Masuk</b>\n` +
    `Siswa: ${escapeHtml(params.studentName)}\n` +
    `Nominal: <b>Rp${params.amount.toLocaleString("id-ID")}</b>`;
  return dispatch("merchant", params.merchantId, params.merchantChatId, html);
}

// ---- 6. Manual/cron daily summary -> merchant ----
export async function notifyMerchantDailySummary(params: {
  merchantChatId: string;
  merchantId: string;
  date: string;
  totalTransactions: number;
  totalAmount: number;
}) {
  const html =
    `📊 <b>Ringkasan Harian — ${escapeHtml(params.date)}</b>\n` +
    `Jumlah transaksi: ${params.totalTransactions}\n` +
    `Total pendapatan: Rp${params.totalAmount.toLocaleString("id-ID")}`;
  return dispatch("merchant", params.merchantId, params.merchantChatId, html);
}

// ---- 7. SPP batch processed -> school ----
export async function notifySchoolTreasuryBatch(params: {
  schoolChatId: string;
  schoolId: string;
  period: string;
  successCount: number;
  failedCount: number;
  totalAmount: number;
}) {
  const html =
    `🏫 <b>Batch Rekonsiliasi SPP — ${escapeHtml(params.period)}</b>\n` +
    `Berhasil: ${params.successCount} | Gagal: ${params.failedCount}\n` +
    `Total tertagih: Rp${params.totalAmount.toLocaleString("id-ID")}`;
  return dispatch("school", params.schoolId, params.schoolChatId, html);
}

// ---- 8. Test message (new) ----
export async function notifyTestMessage(params: {
  chatId: string;
  entityType: "parent" | "merchant" | "school";
  entityId: string;
}) {
  const html =
    `✅ <b>Koneksi Berhasil</b>\n` +
    `Akun VALO Anda kini terhubung dengan Telegram. Notifikasi akan dikirim ke chat ini.`;
  return dispatch(params.entityType, params.entityId, params.chatId, html);
}
```

All functions return the `SendResult` from `client.ts` rather than `void`/never-throw silently — the caller (route handler, wrapped in `after()`) can log failures, but nothing here ever throws into the request path since it only runs after the response is already sent.

---

### 6. Guaranteed Non-Blocking Dispatch — Next.js 15 `after()`

#### [NEW] `lib/telegram/after-dispatch.ts`
```typescript
import { after } from "next/server";

/**
 * Schedules `task` to run after the response has been sent, using Next.js 15's
 * after() API. Unlike a bare `void asyncFn()`, after() is registered with the
 * request's lifecycle by the runtime, so the platform keeps the function
 * instance alive until the callback settles — it will not be frozen/recycled
 * mid-flight the way an un-awaited promise can be.
 *
 * Errors inside `task` are caught and logged; after() callbacks that throw
 * are surfaced to console/observability but cannot affect the (already-sent)
 * response.
 */
export function dispatchAfterResponse(task: () => Promise<unknown>, label: string) {
  after(async () => {
    try {
      await task();
    } catch (err) {
      console.error(`[telegram:after] dispatch failed (${label})`, err);
    }
  });
}
```

**Requirements / caveats to note during implementation:**
- `after()` must be called during the execution of a Route Handler, Server Action, or Middleware — i.e., synchronously within that request's call stack — not from a detached background job. All usages below satisfy this since they're called directly inside the route handlers.
- `after()` works on both the Node.js and Edge runtimes in Next.js 15, but confirm the three modified routes are **not** configured with `export const runtime = 'edge'` while using APIs (like the Supabase service-role client) that need Node — if any route needs Edge, use the `fetch`-based Supabase client instead of the Node SDK.
- On self-hosted Node servers `after()` runs before the process is allowed to exit for that request; on Vercel it extends the invocation's billed duration slightly — budget for it (Telegram calls typically resolve in 100–400ms).

---

### 7. Link API

#### [NEW] `app/api/v1/telegram/link/route.ts`
```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const CHAT_ID_RE = /^-?\d{5,15}$/;

export async function PATCH(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chat_id } = await req.json();
  if (typeof chat_id !== "string" || !CHAT_ID_RE.test(chat_id)) {
    return NextResponse.json(
      { error: "Invalid chat_id: must be a numeric Telegram chat identifier." },
      { status: 400 }
    );
  }

  // Resolve entity strictly from the authenticated session's profile —
  // NEVER from a client-supplied entity id, or any user could overwrite
  // another parent/merchant/school's chat_id.
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role, parent_id, merchant_id, school_id")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const table =
    profile.role === "parent" ? "parents"
    : profile.role === "merchant_staff" ? "merchants"
    : profile.role === "school_admin" ? "schools"
    : null;
  const entityId =
    profile.role === "parent" ? profile.parent_id
    : profile.role === "merchant_staff" ? profile.merchant_id
    : profile.role === "school_admin" ? profile.school_id
    : null;

  if (!table || !entityId) {
    return NextResponse.json({ error: "Role not eligible for Telegram linking" }, { status: 403 });
  }

  const { error: updateErr } = await supabase
    .from(table)
    .update({ telegram_chat_id: chat_id })
    .eq("id", entityId);

  if (updateErr) {
    return NextResponse.json({ error: "Failed to save chat id" }, { status: 500 });
  }

  return NextResponse.json({ connected: true });
}

export async function GET(req: NextRequest) {
  // Mirrors the PATCH resolution logic to return { connected, chat_id_masked }
  // for the Settings UI's status badge. Omitted here for brevity — same
  // profile → table/entityId resolution as above, read-only.
}
```
**Security notes:**
- The role→table→entityId mapping is derived entirely server-side from `profiles`, which is populated at account provisioning time, not by the client — this closes the "link another user's entity" gap.
- The Chat ID regex (`^-?\d{5,15}$`) matches Telegram's actual identifier space (positive for users, negative for groups/channels) and matches the DB-level `CHECK` constraint added in the migration, giving defense in depth.
- Consider adding a Supabase RLS policy on `parents`/`merchants`/`schools` restricting `UPDATE ... telegram_chat_id` to the row matching `auth.uid()`'s profile as a third layer, consistent with the RLS-first posture in `PRODUCT_SPECIFICATION_v2.md` §6.3.

---

### 8. Test Message API

#### [NEW] `app/api/v1/telegram/test/route.ts`
```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { notifyTestMessage } from "@/lib/telegram/notifier";

export async function POST(_req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ... same profile resolution as the link route to get { table, entityId, role } ...
  const { table, entityId, role, chatId } = await resolveEntityAndChatId(supabase, user.id);

  if (!chatId) {
    return NextResponse.json({ error: "No chat id linked yet" }, { status: 400 });
  }

  const result = await notifyTestMessage({ chatId, entityType: role, entityId });

  if (!result.ok) {
    return NextResponse.json(
      { sent: false, error: result.description, code: result.code },
      { status: 502 }
    );
  }
  return NextResponse.json({ sent: true });
}
```
This is intentionally **awaited synchronously** (not wrapped in `after()`) — it's a direct user action expecting immediate feedback ("did it arrive or not"), not a background side-effect of an unrelated critical-path operation like the NFC tap.

---

### 9. Settings UI Component

#### [MODIFY] `components/shared/TelegramSettingsCard.tsx`
Additions on top of the v1 design:
- **Connection status badge**: `Connected ✅` / `Not Connected` / `⚠️ Broken (last error 403)` — the third state reads from `telegram_link_failures` (exposed via the `GET` link endpoint) so users see when their linked chat has gone stale (e.g., they blocked the bot).
- Input field for Telegram Chat ID (client-side regex mirrors the server's `^-?\d{5,15}$` for instant feedback).
- **"Kirim Pesan Uji Coba" button** — calls `POST /api/v1/telegram/test`, shows a toast: success ("Pesan terkirim, cek Telegram Anda") or failure with the specific reason (e.g., "Bot diblokir, silakan /start ulang bot lalu simpan Chat ID kembali" for a 403).
- Instructions collapsible: "How to get your Chat ID" (via `@userinfobot`).

```tsx
async function handleTestMessage() {
  setTesting(true);
  const res = await fetch("/api/v1/telegram/test", { method: "POST" });
  const data = await res.json();
  setTesting(false);
  if (data.sent) {
    toast.success("Pesan uji coba terkirim! Cek Telegram Anda.");
  } else if (data.code === 403) {
    toast.error("Bot Anda blokir/tidak ditemukan. Mulai ulang chat dengan bot, lalu simpan Chat ID lagi.");
  } else {
    toast.error(`Gagal mengirim: ${data.error}`);
  }
}
```

---

### 10. Settings Pages
*(unchanged from v1)*

#### [NEW] `app/(parent)/settings/page.tsx` — embeds `TelegramSettingsCard` with `role="parent"`.
#### [NEW] `app/(school)/school/settings/page.tsx` — embeds with `role="school"`.
#### [NEW] `app/(canteen)/pos/settings/page.tsx` — embeds with `role="merchant"`.
#### [MODIFY] `components/parent/ParentBottomNav.tsx` — add "Pengaturan" nav item.
#### [MODIFY] `components/school/SchoolSidebar.tsx` — add "Pengaturan" nav item.

---

### 11. Event Integration

#### [MODIFY] `app/api/v1/transactions/canteen/route.ts`
```typescript
import { dispatchAfterResponse } from "@/lib/telegram/after-dispatch";
import {
  notifyParentCanteenTap, notifyParentPaguAlert, notifyMerchantTransaction,
} from "@/lib/telegram/notifier";

// ... after fn_process_canteen_tap() resolves and the HTTP response body is built ...

if (result.status === "SETTLED" || result.status === "SETTLED_OVERDRAFT") {
  dispatchAfterResponse(async () => {
    const { data: targets } = await supabaseAdmin
      .rpc("fn_get_telegram_targets", {
        p_student_id: result.student_id,
        p_merchant_id: result.merchant_id,
      })
      .single();
    if (!targets) return;

    const jobs = [];
    for (const parentChatId of targets.parent_chat_ids ?? []) {
      jobs.push(notifyParentCanteenTap({
        parentChatId, parentId: "", // resolved per-parent if needed for failure tracking
        studentName: targets.student_full_name,
        merchantName: targets.merchant_name,
        amount: result.amount,
        remainingLimit: result.remaining_daily_limit,
      }));
    }
    if (targets.merchant_chat_id) {
      jobs.push(notifyMerchantTransaction({
        merchantChatId: targets.merchant_chat_id, merchantId: result.merchant_id,
        studentName: targets.student_full_name, amount: result.amount,
      }));
    }
    await Promise.allSettled(jobs);
  }, "canteen-tap-settled");
}

if (result.status === "REJECTED_OVERLIMIT") {
  dispatchAfterResponse(async () => {
    const { data: targets } = await supabaseAdmin
      .rpc("fn_get_telegram_targets", { p_student_id: result.student_id, p_merchant_id: result.merchant_id })
      .single();
    const jobs = (targets?.parent_chat_ids ?? []).map((chatId) =>
      notifyParentPaguAlert({
        parentChatId: chatId, parentId: "",
        studentName: targets!.student_full_name, attemptedAmount: result.attempted_amount,
      })
    );
    await Promise.allSettled(jobs);
  }, "canteen-tap-rejected");
}

// Response is returned to the client immediately above/before this point —
// after() guarantees the block above still runs to completion.
return NextResponse.json(result);
```
**Key change vs v1:** the route no longer does `void notifyParentCanteenTap(...)` immediately after the DB call with the response still being assembled — everything Telegram-related, including the recipient lookup itself, is deferred into a single `after()` callback that fires once the JSON response has already been flushed to the NFC terminal. This keeps the p95 < 800ms target (§14.2) intact regardless of Telegram's latency or the number of guardians linked to a student.

#### [MODIFY] `app/api/webhooks/bni/h2h/debit-callback/route.ts`
```typescript
dispatchAfterResponse(async () => {
  const { data: parent } = await supabaseAdmin
    .from("parents").select("telegram_chat_id")
    .eq("id", invoice.parent_id).single();
  if (parent?.telegram_chat_id) {
    await notifyParentSPPSuccess({
      parentChatId: parent.telegram_chat_id, parentId: invoice.parent_id,
      studentName: invoice.student_full_name, period: invoice.period, amount: invoice.amount,
    });
  }
}, "spp-settled");
```

#### [MODIFY] `app/api/v1/students/[id]/card/report-lost/route.ts`
```typescript
dispatchAfterResponse(async () => {
  const { data: guardians } = await supabaseAdmin
    .from("guardian_student_map")
    .select("parents(id, telegram_chat_id)")
    .eq("student_id", studentId);

  const jobs = (guardians ?? [])
    .filter((g) => g.parents?.telegram_chat_id)
    .map((g) => notifyParentCardLostConfirmation({
      parentChatId: g.parents!.telegram_chat_id!, parentId: g.parents!.id, studentName,
    }));
  await Promise.allSettled(jobs);
}, "card-lost");
```

---

## Verification Plan

### Automated
1. `npx tsc --noEmit` — no new type errors.
2. Unit tests for `escapeHtml()` — confirm `&`, `<`, `>` are escaped and other characters (`.`, `-`, `!`) pass through untouched (regression guard against re-introducing MarkdownV2 fragility).
3. Unit test for `sendTelegramMessage()` against a mocked `fetch`: assert a 429 response triggers exactly one retry honoring `retry_after`, and a 403 response does **not** retry.
4. Migration dry-run: `supabase db diff` shows the expected `ALTER TABLE` + new table/function with no unrelated drift.

### Manual
1. Rotate the bot token via `@BotFather`; add the new `TELEGRAM_BOT_TOKEN` to `.env.local`; restart dev server.
2. Apply both migrations in the Supabase dashboard/CLI.
3. Go to `/settings` (Parent), enter a valid Chat ID → Save → verify `200` and badge flips to `Connected`.
4. Click **"Kirim Pesan Uji Coba"** → confirm the message arrives in Telegram within a few seconds and the toast reflects success.
5. Block the bot in Telegram, click **Test** again → confirm the UI surfaces the 403-specific guidance ("bot diblokir...") rather than a generic error, and `telegram_link_failures.consecutive_failures` increments.
6. Unblock the bot, click **Test** once more → confirm `telegram_link_failures` is cleared and the badge returns to `Connected`.
7. Trigger a demo NFC tap in `/pos` with the response time monitored (e.g., browser devtools network tab) → confirm the `POST /api/v1/transactions/canteen` response returns in the usual <800ms range **regardless** of whether Telegram is slow or unreachable, and that the parent + merchant notifications still arrive shortly after.
8. Temporarily point `TELEGRAM_API_BASE` at an unreachable host, repeat step 7 → confirm the tap still succeeds and returns fast (proving the dispatch is truly decoupled from the response), and the error is visible in server logs.
9. Trigger a `REJECTED_OVERLIMIT` tap (pagu exceeded) → confirm only the pagu-alert message is sent, not the settlement message.
10. Report a card lost via the parent app → confirm all linked guardians (test with 2 guardians on one student) receive the lock confirmation.
11. Confirm `.env.local` and this plan file are excluded from any commit containing the live token (`git status`, `git diff --staged`).
