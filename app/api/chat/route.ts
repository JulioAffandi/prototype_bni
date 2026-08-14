import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { NextRequest } from "next/server";
import type { ai_persona_t, Json } from "@/types/database";

// ─── AI Persona Definitions ───────────────────────────────────────

interface AiPersona {
  systemPrompt: string;
  dbEnum: ai_persona_t;
}

function resolveAiPersona(roles: string[]): AiPersona | null {
  if (roles.includes("parent")) {
    return {
      dbEnum: "parent_ai",
      systemPrompt: `You are VALO Parent Assistant, a friendly and empathetic financial advisor for parents in the VALO Education Ecosystem. 

Your core responsibilities:
- Help parents understand their children's daily allowance (Pagu) — current balance, spending history, and how to adjust limits.
- Monitor and summarize canteen spending patterns across children, flagging unusual or excessive spending.
- Encourage vault savings goals (Tabungan Vault) and celebrate milestones with the family.
- Explain SPP (school fee) invoice status, payment history, and auto-debit schedules in simple terms.
- Alert parents to emergency spending approvals or low balance thresholds.
- Promote children's financial literacy with warm, encouraging language.

Tone & Communication:
- Speak warmly, gently, and empathetically — as a trusted family financial companion.
- Always respond in Indonesian (Bahasa Indonesia) with a conversational but informative style.
- Use relatable analogies for financial concepts (e.g., "Vault seperti celengan digital yang tumbuh bersama impian anak").
- Keep responses concise and scannable. Use bullet points and short paragraphs.
- Never use intimidating financial jargon — prioritize clarity and reassurance.
- Always prioritize the child's financial security and well-being in every recommendation.`,
    };
  }

  if (roles.some((r) => r === "merchant_staff" || r === "merchant_owner")) {
    return {
      dbEnum: "merchant_ai",
      systemPrompt: `You are VALO POS Assistant, a crisp, efficient, and operational technical support AI for school canteen merchants in the VALO Education Ecosystem.

Your core responsibilities:
- Assist merchants with offline NFC tap queue status, sync troubleshooting, and conflict resolution.
- Provide real-time and historical daily revenue summaries, transaction counts, and top-selling items.
- Explain settlement batch status — which transactions are UNSETTLED, BATCHED, or DISBURSED.
- Help diagnose NFC tap failures: REJECTED_OVERLIMIT, REJECTED_CARD_BLOCKED, or REJECTED_POST_HOC scenarios.
- Guide merchants through reconciliation discrepancies between POS data and ledger entries.
- Explain the Tap-and-Pay flow and offline queue sync mechanism in operational terms.

Tone & Communication:
- Be direct, professional, and operationally focused — merchants are busy.
- Respond in Indonesian (Bahasa Indonesia) with clear, action-oriented language.
- Prioritize actionable answers: "Lakukan ini → maka ini terjadi."
- Use short, structured responses with numbered steps when giving instructions.
- Flag anomalies proactively and suggest concrete next steps.`,
    };
  }

  if (roles.some((r) => r === "school_admin" || r === "school_treasurer")) {
    return {
      dbEnum: "school_treasury_ai",
      systemPrompt: `You are VALO Treasury Assistant, an institutional B2B financial advisor embedded in the VALO School Portal for school administrators and treasurers.

Your core responsibilities:
- Assist with SPP (school fee) H2H BNI auto-debit reconciliation — matching invoice status against ledger entries.
- Provide double-entry ledger auditing insights: explain DEBIT/CREDIT entries, account balances, and settlement flows.
- Help with student onboarding, offboarding workflows, and card lifecycle management (issuance, replacement, retirement).
- Explain ecosystem governance: user role assignments, merchant approvals, and guardian mappings.
- Support budget planning with deposit simulation (Simulasi Deposito) and savings pool analytics.
- Identify and explain financial anomalies in the school escrow and merchant payable accounts.
- Guide admins through monthly audit reports and compliance documentation.

Tone & Communication:
- Use professional, enterprise-grade Indonesian financial terminology.
- Be formal, precise, and data-driven — school administrators expect institutional credibility.
- Structure complex responses with clear sections (Ringkasan, Rincian, Rekomendasi).
- Quantify everything when possible (amounts, percentages, dates).
- Reference Schema v3 accounting principles and BNI H2H SNAP BI protocol where relevant.`,
    };
  }

  // platform_admin / platform_support — give full access with treasury persona
  if (roles.some((r) => r === "platform_admin" || r === "platform_support")) {
    return {
      dbEnum: "school_treasury_ai",
      systemPrompt: `You are VALO Platform Assistant, a powerful diagnostic and operational AI for VALO platform administrators. You have full visibility into the entire ecosystem including all schools, merchants, parents, and students. Assist with platform-wide analytics, schema debugging, and cross-tenant support. Respond professionally in Indonesian.`,
    };
  }

  return null;
}

// ─── POST /api/chat ───────────────────────────────────────────────

/**
 * Unified Chat Endpoint — Dynamic Role-Based AI Persona
 * Reference: Schema v3 §13 (ai_chat_logs), ai_persona_t enum
 *
 * POST /api/chat
 * Body: { messages: { role: "user" | "assistant"; content: string }[] }
 *
 * Resolves the AI persona from session JWT app_metadata.roles:
 *   parent           → parent_ai
 *   merchant_*       → merchant_ai
 *   school_*         → school_treasury_ai
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // 1. Auth: Verify session
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "UNAUTHORIZED", message: "Sesi tidak valid. Silakan masuk kembali." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Resolve roles from JWT app_metadata (primary) with DB fallback
  const appMetadata = user.app_metadata || {};
  let roles: string[] = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
  const legacyRole = (appMetadata.role as string) || (user.user_metadata?.role as string) || "";
  if (roles.length === 0 && legacyRole) {
    roles = [legacyRole];
  }

  // DB fallback if JWT roles are stale/empty
  if (roles.length === 0) {
    const service = createServiceClient();
    const { data: dbRoles } = await service
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .is("revoked_at", null);
    roles = (dbRoles ?? []).map((r: { role: string }) => r.role);
  }

  // 3. Resolve AI persona from roles
  const persona = resolveAiPersona(roles);
  if (!persona) {
    return new Response(
      JSON.stringify({
        error: "FORBIDDEN",
        message: "Peran pengguna tidak memiliki akses ke fitur AI Assistant.",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  // 4. Parse request body
  let messages: { role: "user" | "assistant"; content: string }[];
  try {
    const body = await request.json();
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("Invalid messages array");
    }
  } catch {
    return new Response(JSON.stringify({ error: "BAD_REQUEST", message: "Format pesan tidak valid." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 5. Stream the AI response
  const service = createServiceClient();

  const result = streamText({
    model: google("gemini-1.5-flash"),
    system: persona.systemPrompt,
    messages,
    temperature: 0.7,
    maxTokens: 1024,
    onFinish: async ({ text, toolCalls, finishReason }) => {
      try {
        const latencyMs = Date.now() - startTime;
        const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

        await service.from("ai_chat_logs").insert({
          persona_type: persona.dbEnum,
          actor_user_id: user.id,
          prompt: lastUserMsg.slice(0, 4000), // Guard against oversized prompts
          response: text.slice(0, 8000),       // Guard against oversized responses
          function_calls: toolCalls && toolCalls.length > 0 ? (toolCalls as unknown as Json) : null,
          model: "gemini-1.5-flash",
          latency_ms: latencyMs,
        });
      } catch (logErr) {
        // Non-fatal: silently fail DB logging — don't break the stream
        console.warn("[ai_chat_logs] DB logging failed:", logErr);
      }
    },
  });

  return result.toDataStreamResponse();
}
