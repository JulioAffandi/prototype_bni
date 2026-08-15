import { streamText, convertToCoreMessages, type UIMessage } from "ai";
import { google } from "@ai-sdk/google";
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
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MODEL_ID: Record<AiScope["personaType"], string> = {
  parent_ai: process.env.AI_MODEL_PARENT ?? "gemini-1.5-flash",
  merchant_ai: process.env.AI_MODEL_MERCHANT ?? "gemini-1.5-flash",
  school_treasury_ai: process.env.AI_MODEL_SCHOOL ?? "gemini-1.5-flash",
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

  const db = await createServerSupabase();
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth?.user) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let scope: AiScope;
  try {
    scope = await resolveAiScope(db);
  } catch (e) {
    const code = e instanceof ScopeError ? e.code : "SCOPE_UNKNOWN";
    return Response.json({ error: "FORBIDDEN", code }, { status: 403 });
  }

  const rl = await consumeRateLimit(scope.actorProfileId);
  if (!rl.diizinkan) {
    return Response.json(
      { error: "RATE_LIMITED", retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
  }
  const semua = parsed.data.messages as UIMessage[];
  const messages = semua.slice(-MAX_RIWAYAT);
  const rawId = parsed.data.id;
  const sessionId = rawId && UUID_RE.test(rawId) ? rawId : crypto.randomUUID();
  const promptTerakhir = teksTerakhir(messages);

  const system = buildSystemPrompt(scope);
  const tools = buildToolsForScope(db, scope);
  const modelId = MODEL_ID[scope.personaType];

  const audit = createServiceSupabase();
  const scopeSnapshot = {
    role: scope.role,
    school_id: scope.schoolId,
    parent_id: scope.parentId,
    merchant_id: scope.merchantId,
    child_count: scope.children.length,
  };

  async function tulisAudit(row: Record<string, unknown>) {
    const { error } = await audit.from("ai_chat_logs").insert({
      persona_type: scope.personaType,
      actor_profile_id: scope.actorProfileId,
      session_id: sessionId,
      prompt: promptTerakhir,
      model_id: modelId,
      latency_ms: Date.now() - mulai,
      scope_snapshot: scopeSnapshot as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      ...row,
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (error) {
      console.error(JSON.stringify({ level: "error", scope: "ai_audit_write", msg: error.message }));
    }
  }

  const result = streamText({
    model: google(modelId),
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
      console.error(JSON.stringify({ level: "error", scope: "ai_stream", sessionId, msg: String(error) }));
    },
  });

  return result.toDataStreamResponse({
    getErrorMessage: () => "Maaf, terjadi gangguan pada asisten. Silakan coba lagi.",
  });
}
