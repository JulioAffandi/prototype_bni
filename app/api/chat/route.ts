import { streamText, convertToCoreMessages, type UIMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { resolveAiScope, ScopeError, type AiScope } from "@/lib/ai/context";
import { buildSystemPrompt } from "@/lib/ai/prompts";
import { buildToolsForScope, MAX_STEPS } from "@/lib/ai/tools/registry";
import { consumeRateLimit } from "@/lib/ai/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 45;

const MAX_RIWAYAT = 12;

const bodySchema = z.object({
  id: z.string().min(1).max(64).optional(),
  messages: z.array(z.any()).min(1).max(200),
  persona: z.string().optional(),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const resolveModelIdentifier = (rawName?: string) => {
  if (!rawName) return "gemini-flash-latest";
  const clean = rawName.replace(/^models\//, "").trim();
  if (clean === "gemini-1.5-flash" || clean === "gemini-2.5-flash" || clean.includes("1.5-flash") || clean.includes("2.5-flash")) {
    return "gemini-flash-latest";
  }
  return clean || "gemini-flash-latest";
};

function teksTerakhir(messages: UIMessage[]): string {
  const last = messages[messages.length - 1];
  if (!last) return "";
  if (last.parts && Array.isArray(last.parts)) {
    const textParts = (last.parts as any[]) // eslint-disable-line @typescript-eslint/no-explicit-any
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join(" ");
    if (textParts) return textParts.slice(0, 4000);
  }
  return typeof last.content === "string" ? last.content.slice(0, 4000) : "";
}

export async function POST(req: Request) {
  const mulai = Date.now();

  try {
    const apiKey = (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || "").trim();
    if (!apiKey || apiKey.includes("your-api-key")) {
      console.error("❌ [AI Route Error] Missing or invalid API key (GOOGLE_GENERATIVE_AI_API_KEY / GEMINI_API_KEY).");
      return new Response(
        JSON.stringify({
          error: "Missing Gemini API Key",
          message: "API Key Google Gemini belum dikonfigurasi. Harap atur GOOGLE_GENERATIVE_AI_API_KEY atau GEMINI_API_KEY di environment variables.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const google = createGoogleGenerativeAI({
      apiKey: apiKey.trim(),
    });

    const db = await createServerSupabase();
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth?.user) {
      return Response.json({ error: "UNAUTHORIZED", message: "Sesi telah berakhir. Silakan login kembali." }, { status: 401 });
    }

    const bodyText = await req.text();
    let bodyJson: unknown;
    try {
      bodyJson = JSON.parse(bodyText);
    } catch {
      return Response.json({ error: "INVALID_JSON", message: "Format payload JSON tidak valid." }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(bodyJson);
    if (!parsed.success) {
      return Response.json({ error: "INVALID_PAYLOAD", message: "Payload pesan AI tidak sesuai skema." }, { status: 400 });
    }

    const requestedPersona = parsed.data.persona;

    let scope: AiScope;
    try {
      scope = await resolveAiScope(db, auth.user, requestedPersona);
    } catch (e) {
      const code = e instanceof ScopeError ? e.code : "SCOPE_UNKNOWN";
      console.error(`❌ [AI Route Error] Failed to resolve AI scope: ${code}`, e);
      return Response.json({ error: "FORBIDDEN", code, message: `Otorisasi gagal: ${code}` }, { status: 403 });
    }

    const rl = await consumeRateLimit(scope.actorProfileId);
    if (!rl.diizinkan) {
      return Response.json(
        { error: "RATE_LIMITED", retryAfterSeconds: rl.retryAfterSeconds, message: "Batas permintaan terlampaui. Coba lagi dalam beberapa saat." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
      );
    }

    const semua = parsed.data.messages as UIMessage[];
    const messages = semua.slice(-MAX_RIWAYAT);
    const rawId = parsed.data.id;
    const sessionId = rawId && UUID_RE.test(rawId) ? rawId : crypto.randomUUID();
    const promptTerakhir = teksTerakhir(messages);

    const system = buildSystemPrompt(scope);
    const tools = buildToolsForScope(db, scope);

    // Determine model based on persona / role
    const rawModel =
      requestedPersona === "school" || scope.personaType === "school_treasury_ai"
        ? process.env.AI_MODEL_SCHOOL
        : requestedPersona === "merchant" || scope.personaType === "merchant_ai"
        ? process.env.AI_MODEL_MERCHANT
        : process.env.AI_MODEL_PARENT;

    const modelName = resolveModelIdentifier(rawModel);

    const audit = createServiceSupabase();
    const scopeSnapshot = {
      role: scope.role,
      school_id: scope.schoolId,
      parent_id: scope.parentId,
      merchant_id: scope.merchantId,
      child_count: scope.children.length,
    };

    async function tulisAudit(row: Record<string, unknown>) {
      try {
        const { error } = await audit.from("ai_chat_logs").insert({
          persona_type: scope.personaType,
          actor_profile_id: scope.actorProfileId,
          session_id: sessionId,
          prompt: promptTerakhir,
          model_id: modelName,
          latency_ms: Date.now() - mulai,
          scope_snapshot: scopeSnapshot as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          ...row,
        } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
        if (error) {
          console.error("⚠️ [AI Audit Write Error]:", error.message);
        }
      } catch (auditErr) {
        console.error("⚠️ [AI Audit Exception]:", auditErr);
      }
    }

    const result = streamText({
      model: google(modelName),
      system,
      messages: convertToCoreMessages(messages as any),
      tools: tools as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      maxSteps: MAX_STEPS[scope.personaType],
      temperature: 0.2,

      onFinish: async ({ text, usage, steps, finishReason }) => {
        const toolsInvoked = (steps || []).flatMap((s) => (s.toolCalls || []).map((c) => c.toolName));
        await tulisAudit({
          response: text,
          function_calls: (steps || []).map((s) => ({
            tools: (s.toolCalls || []).map((c) => ({ nama: c.toolName, input: (c as any).args })), // eslint-disable-line @typescript-eslint/no-explicit-any
          })),
          tools_invoked: [...new Set(toolsInvoked)],
          step_count: (steps || []).length,
          input_tokens: (usage as any)?.promptTokens ?? (usage as any)?.inputTokens ?? null, // eslint-disable-line @typescript-eslint/no-explicit-any
          output_tokens: (usage as any)?.completionTokens ?? (usage as any)?.outputTokens ?? null, // eslint-disable-line @typescript-eslint/no-explicit-any
          total_tokens: (usage as any)?.totalTokens ?? null, // eslint-disable-line @typescript-eslint/no-explicit-any
          finish_reason: finishReason,
        });
      },

      onError: async ({ error }) => {
        await tulisAudit({
          response: null,
          error_code: error instanceof Error ? error.name : "UNKNOWN",
          finish_reason: "error",
        });
        console.error("❌ [AI Route Error] Stream Execution Error:", error);
      },
    });

    return result.toDataStreamResponse({
      getErrorMessage: (err) => {
        console.error("❌ [AI Route Error] Stream Response Error:", err);
        return err instanceof Error ? err.message : "Maaf, terjadi gangguan pada asisten. Silakan coba lagi.";
      },
    });
  } catch (globalErr) {
    console.error("❌ [AI Route Error] POST /api/chat Global Exception:", globalErr);
    return Response.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: globalErr instanceof Error ? globalErr.message : "Terjadi kesalahan internal pada server AI.",
      },
      { status: 500 },
    );
  }
}
