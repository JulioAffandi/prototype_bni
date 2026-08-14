import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { NextRequest } from "next/server";
import { MERCHANT_SYSTEM_PROMPT, merchantTools } from "@/lib/ai/merchantPrompt";

/**
 * POST /api/v1/ai/merchant-advisor
 * Streaming AI chat for Canteen Merchant Advisor (Persona A).
 * Uses Vercel AI SDK streamText with function calling.
 * All prompts/responses logged to ai_chat_logs per §10.4.
 * Reference: PRODUCT_SPECIFICATION_v2.md §10.1, §10.4
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401 });
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role, merchant_id")
    .eq("id", user.id)
    .single();

  const profile = profileData as { role: string; merchant_id: string | null } | null;

  if (!profile || profile.role !== "merchant_staff") {
    return new Response(JSON.stringify({ error: "RLS_FORBIDDEN" }), { status: 403 });
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
      const service = createServiceClient();
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
      await service.from("ai_chat_logs").insert({
        persona_type: "merchant_ai",
        actor_profile_id: user.id,
        prompt: lastUserMsg,
        response: text,
        function_calls: toolCalls.length > 0 ? (toolCalls as unknown as Record<string, unknown>) : null,
      });
    },
  });

  return result.toDataStreamResponse();
}
