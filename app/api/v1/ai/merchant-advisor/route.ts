import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { NextRequest } from "next/server";
import { MERCHANT_SYSTEM_PROMPT, merchantTools } from "@/lib/ai/merchantPrompt";
import type { Json } from "@/types/database";

/**
 * POST /api/v1/ai/merchant-advisor
 * Streaming AI chat for Canteen Merchant Advisor (Persona A).
 * Reference: Schema v3 §13 (ai_chat_logs)
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401 });
  }

  const appMetadata = user.app_metadata || {};
  const userRoles: string[] = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];

  const service = createServiceClient();
  const isMerchantUser = userRoles.includes("merchant_staff") || userRoles.includes("merchant_owner") || userRoles.includes("platform_admin");

  if (!isMerchantUser) {
    const { data: roles } = await service
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .is("revoked_at", null);

    const hasAccess = roles?.some(
      (r) => r.role === "merchant_staff" || r.role === "merchant_owner",
    );
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "RLS_FORBIDDEN" }), { status: 403 });
    }
  }

  const { messages } = await request.json() as {
    messages: { role: "user" | "assistant"; content: string }[];
  };

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: MERCHANT_SYSTEM_PROMPT,
    messages,
    tools: merchantTools,
    maxSteps: 5,
    onFinish: async ({ text, toolCalls }) => {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
      await service.from("ai_chat_logs").insert({
        persona_type: "merchant_ai",
        actor_user_id: user.id,
        prompt: lastUserMsg,
        response: text,
        function_calls: toolCalls.length > 0 ? (toolCalls as unknown as Json) : null,
      });
    },
  });

  return result.toDataStreamResponse();
}
