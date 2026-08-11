# VALO Education Ecosystem — Full Production-Grade Implementation Plan

## Overview

Build a full-stack Next.js 15 monorepo implementing the **VALO Education Ecosystem** — a closed-loop institutional banking platform for K-12 schools, tying together Parent Control, Canteen Merchant POS, and School B2B Portal into one unified Supabase-backed system.

The spec (§1–15 of `PRODUCT_SPECIFICATION_v2.md`) is the Single Source of Truth. Everything below maps 1:1 to that document.

---

## Open Questions

> [!IMPORTANT]
> **Supabase Credentials** — No `.env` file exists yet. The implementation will scaffold all code and create a `.env.example` with all required environment variables. You will need to supply actual values from your Supabase project and OpenAI account.

> [!IMPORTANT]
> **NFC Simulator** — Per §2.3, `NEXT_PUBLIC_NFC_SIMULATOR_ENABLED` must be `true` for staging/demo. The generated code will default to `true` (demo mode) with the full simulator UI. Set to `false` for production.

> [!IMPORTANT]
> **BNI H2H / SNAP BI** — Real BNI H2H credentials are not available. All H2H integration code will be fully scaffolded per §9.1 and §11.3 (asymmetric RSA-SHA256 + HMAC signature) with mock responses in dev. Swap in real keys at go-live.

---

## Proposed Changes

### Phase 0 — Project Initialization

#### [NEW] Bootstrap Next.js 15 + Tailwind CSS v4 + Shadcn UI
- `npx create-next-app@latest ./ --typescript --tailwind --app --no-src-dir --import-alias "@/*"`
- Add Shadcn UI, `lucide-react`, `idb`, `@supabase/supabase-js`, `@supabase/ssr`, `ai` (Vercel AI SDK), `openai`, `@ducanh2912/next-pwa`, `zod`
- Configure `tsconfig.json` strict mode, `next.config.ts`, `tailwind.config.ts` (v4)

---

### Phase 1 — Foundation & Infrastructure

#### [NEW] `lib/supabase/client.ts`
Browser Supabase client (anon key, RLS-scoped)

#### [NEW] `lib/supabase/server.ts`
Server-side Supabase client using `@supabase/ssr` cookie store (for Next.js Server Components / Server Actions)

#### [NEW] `lib/supabase/service.ts`
Service-role client (bypass RLS) — used only in API Route handlers for financial mutations

#### [NEW] `types/database.ts`
Full TypeScript types mirroring all 16 tables from §6.2 DDL:
`schools`, `parents`, `profiles`, `merchants`, `students`, `guardian_student_map`, `student_vault`, `canteen_transactions`, `spp_invoices`, `wallet_ledger`, `idempotency_keys`, `offline_sync_queue`, `card_lifecycle_events`, `parental_consent`, `audit_log`, `ai_chat_logs`

#### [NEW] `lib/offlineQueue.ts`
IndexedDB Local-First queue using `idb` — exactly as specified in §8.3:
- `openDB` with `tx_queue` + `pagu_cache` object stores
- `queueOfflineTransaction()`, `syncQueueWhenOnline()`
- 15-minute cache expiry, 50%-of-daily-limit threshold guard
- Window `online` event listener

#### [NEW] `lib/ai/merchantPrompt.ts`
System prompt + 3 function-calling tool schemas for Merchant AI (§10.1):
`get_daily_sales_summary`, `get_menu_stock_status`, `get_top_selling_items`

#### [NEW] `lib/ai/schoolPrompt.ts`
System prompt + 3 tools for School Treasury AI (§10.2):
`get_spp_collection_rate`, `get_giro_balance_trend`, `simulate_deposito_allocation`

#### [NEW] `lib/ai/parentPrompt.ts`
System prompt + 3 tools for Parent AI Advisor (§10.3):
`get_child_spending_breakdown`, `get_vault_savings_status`, `simulate_reksadana_allocation`

#### [NEW] `lib/snap.ts`
SNAP BI signature utilities:
- `generateHmacSignature()` for inbound webhook verification
- `generateRsaSignature()` for outbound H2H calls
- Timestamp drift validation (±5 min)

#### [NEW] `public/manifest.json`
PWA manifest (name, icons, theme_color, display: standalone, start_url per app route)

#### [NEW] `next.config.ts`
Next.js 15 config with `@ducanh2912/next-pwa` integration

#### [NEW] `supabase/migrations/001_core_schema.sql`
Complete DDL from §6.2 — all 16 tables, indexes, extensions

#### [NEW] `supabase/migrations/002_rls_policies.sql`
All helper functions + RLS policies from §6.3

#### [NEW] `supabase/migrations/003_functions.sql`
`sp_rollover_daily_vault()` + `pg_cron` schedule from §7.3

---

### Phase 2 — API Routes

All routes use **Bearer JWT** auth (§9.1). Financial mutations use service-role client.

#### [NEW] `app/api/v1/parents/me/students/route.ts`
`GET` — list children for authenticated parent

#### [NEW] `app/api/v1/students/[id]/pagu/route.ts`
`PATCH` — update daily limit + category lock (§9.2)

#### [NEW] `app/api/v1/students/[id]/emergency-toggle/route.ts`
`PATCH` — toggle Emergency Auto-Approval (§2.4)

#### [NEW] `app/api/v1/students/[id]/vault/route.ts`
`GET` — Student Vault balance + goal status

#### [NEW] `app/api/v1/students/[id]/vault/withdraw/route.ts`
`POST` — Dual-control vault withdrawal request

#### [NEW] `app/api/v1/students/[id]/card/report-lost/route.ts`
`POST` — Card loss report → `lost_reported` status + `card_lifecycle_events` (§12.1)

#### [NEW] `app/api/v1/transactions/canteen/route.ts`
`POST` — **Core NFC transaction endpoint** (§9.3):
- Idempotency-Key header validation
- `SELECT FOR UPDATE` pessimistic lock (§7.2)
- Full Pagu Rules Engine (§5.5 state machine)
- Emergency overdraft rate-limit (§2.4)
- `FREQUENT_OVERDRAFT` anomaly flag (§12.5)
- Async WA notification dispatch

#### [NEW] `app/api/v1/sync/offline-queue/route.ts`
`POST` — Batch sync from IndexedDB (§8.2), per-`local_tx_uuid` idempotency

#### [NEW] `app/api/v1/merchants/[id]/settlement/route.ts`
`GET` — Settlement H+0 status panel

#### [NEW] `app/api/v1/schools/[id]/students/route.ts`
`POST` — Register student + NFC binding (UID tokenization per §11.2)

#### [NEW] `app/api/v1/schools/[id]/students/[sid]/offboard/route.ts`
`POST` — Student offboarding (§12.4)

#### [NEW] `app/api/v1/schools/[id]/spp/reconciliation/route.ts`
`GET` — SPP reconciliation dashboard data

#### [NEW] `app/api/v1/spp/retry/route.ts`
`POST` — Manual retry of failed SPP invoice

#### [NEW] `app/api/v1/ai/merchant-advisor/route.ts`
`POST` — Streaming AI chat (Vercel AI SDK `streamText`) with Merchant tools

#### [NEW] `app/api/v1/ai/treasury-advisor/route.ts`
`POST` — Streaming AI chat with School Treasury tools

#### [NEW] `app/api/v1/ai/parent-advisor/route.ts`
`POST` — Streaming AI chat with Parent Advisor tools

#### [NEW] `app/webhooks/bni/h2h/debit-callback/route.ts`
`POST` — Inbound BNI webhook: verify HMAC (§9.1), update `spp_invoices` status

#### [NEW] `app/webhooks/bni/h2h/settlement-confirm/route.ts`
`POST` — Inbound BNI webhook: confirm merchant settlement batch

---

### Phase 3 — Parent App `(parent)`

Route group `/app/(parent)/` — mobile-first PWA, authenticated as `role='parent'`

#### [NEW] `app/(parent)/layout.tsx`
Parent shell: bottom navigation, auth guard

#### [NEW] `app/(parent)/page.tsx`
Dashboard: child selector, current pagu, vault progress, SPP status, recent transactions

#### [NEW] `app/(parent)/pagu/page.tsx`
Pagu control: daily limit slider, category locks, emergency toggle

#### [NEW] `app/(parent)/vault/page.tsx`
Student Vault: balance, goal progress bar, withdrawal request

#### [NEW] `app/(parent)/spp/page.tsx`
SPP invoices: status badges (PAID/UNPAID/FAILED/OVERDUE), payment history

#### [NEW] `app/(parent)/ai/page.tsx`
Parent AI Advisor chat interface

#### [NEW] `components/parent/PaguSlider.tsx`
Animated daily limit slider with Rp formatting (lucide-react icons only)

#### [NEW] `components/parent/EmergencyToggle.tsx`
Emergency Auto-Approval toggle with overdraft cap display + rate limit warning

#### [NEW] `components/parent/VaultGoalCard.tsx`
Savings goal progress card with target amount + animated progress bar

---

### Phase 4 — Canteen Merchant POS `(canteen)`

Route group `/app/(canteen)/` — tablet/desktop POS, authenticated as `role='merchant_staff'`

#### [NEW] `app/(canteen)/layout.tsx`
Canteen shell: header with offline indicator, settlement summary

#### [NEW] `app/(canteen)/page.tsx`
POS main: menu catalog grid, cart, total, NFC tap trigger

#### [NEW] `app/(canteen)/settlement/page.tsx`
Settlement H+0 panel: today's transactions, batch status

#### [NEW] `app/(canteen)/ai/page.tsx`
Merchant AI chat with streaming responses

#### [NEW] `components/canteen/NFCTriggerCard.tsx`
**Disguised Interactive NFC Trigger** (§2.3):
- Animated NFC wave card (CSS keyframes)
- Opens Bottom Sheet (`Sheet` from Shadcn) with UID simulator list
- Feature-flagged by `NEXT_PUBLIC_NFC_SIMULATOR_ENABLED`
- Lucide `Nfc`, `Wifi`, `CreditCard` icons

#### [NEW] `components/canteen/POSCatalog.tsx`
Menu catalog: item cards, add-to-cart, quantity controls

#### [NEW] `components/canteen/AIChatDrawer.tsx`
AI chat drawer overlay for merchant (Shadcn `Drawer`)

#### [NEW] `components/canteen/OfflineQueueIndicator.tsx`
Visual badge showing offline queue depth + sync status

---

### Phase 5 — School B2B Portal `(school)`

Route group `/app/(school)/` — desktop dashboard, authenticated as `role='school_admin'`

#### [NEW] `app/(school)/layout.tsx`
School portal shell: sidebar navigation, school name header

#### [NEW] `app/(school)/page.tsx`
School dashboard: SPP collection rate, student count, canteen volume

#### [NEW] `app/(school)/spp/page.tsx`
SPP reconciliation table with real-time Supabase subscription

#### [NEW] `app/(school)/students/page.tsx`
Student management: list, NFC binding, offboarding

#### [NEW] `app/(school)/students/new/page.tsx`
New student registration + NFC UID binding form

#### [NEW] `app/(school)/audit/page.tsx`
Audit log viewer (compliance center)

#### [NEW] `app/(school)/ai/page.tsx`
Treasury AI chat

#### [NEW] `components/school/SPPReconciliationTable.tsx`
Real-time SPP table with status badges, retry action, Supabase Realtime subscription

#### [NEW] `components/school/StudentUIDBindingModal.tsx`
Modal for binding NFC UID to student (simulates card tap, calls SHA-256 tokenization)

---

### Phase 6 — Root Layout & Global UI

#### [NEW] `app/layout.tsx`
Root layout: PWA metadata, viewport, theme, Google Fonts (Inter)

#### [NEW] `app/page.tsx`
Landing/auth router: redirect based on profile role

#### [NEW] `app/login/page.tsx`
Auth page: Supabase Auth UI (email/OTP), role-based redirect after sign-in

#### [NEW] `components/ui/`
Shadcn primitives: `button`, `card`, `dialog`, `drawer`, `sheet`, `badge`, `input`, `label`, `progress`, `slider`, `switch`, `table`, `toast`, `skeleton`, `separator`

---

### Phase 7 — Environment & Config

#### [NEW] `.env.example`
All required environment variables:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
NEXT_PUBLIC_NFC_SIMULATOR_ENABLED=true
BNI_H2H_CLIENT_KEY=
BNI_H2H_CLIENT_SECRET=
BNI_H2H_PRIVATE_KEY_PEM=
BNI_H2H_BASE_URL=
TENANT_SALT_SECRET=
```

---

## Verification Plan

### Automated
- `npm run build` — TypeScript strict compilation, zero errors
- `npm run lint` — ESLint clean

### Manual Verification
1. Spin up local dev server `npm run dev`
2. Navigate to `/login` → sign in → redirected to correct portal by role
3. Parent App: set pagu slider → PATCH API → Supabase row updated
4. Canteen POS: tap NFC simulator → transaction appears, pagu deducted
5. Offline mode: disconnect network → queue builds in IndexedDB → reconnect → sync fires
6. School Portal: SPP table shows real-time updates via Supabase Realtime
7. AI chat: all 3 personas return grounded responses via function calling
8. PWA: installable on mobile, works offline

---

## Execution Order

1. Bootstrap + deps install
2. Supabase migrations (SQL files)
3. Types + lib layer (supabase clients, offlineQueue, AI prompts, snap utils)
4. API routes (all 20+ endpoints)
5. Shadcn UI component installation
6. App route groups: parent → canteen → school
7. Custom components
8. Root layout, login, env files
9. PWA config
10. Build verification
