import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { NextRequest } from "next/server";
import { SCHOOL_SYSTEM_PROMPT, schoolTreasuryTools } from "@/lib/ai/schoolPrompt";

/**
 * POST /api/v1/ai/treasury-advisor
 * Streaming AI chat for School Treasury Advisor (Persona B).
 * Reference: PRODUCT_SPECIFICATION_v2.md §10.2, §10.4
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401 });
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .single();

  const profile = profileData as { role: string; school_id: string | null } | null;

  if (!profile || profile.role !== "school_admin") {
    return new Response(JSON.stringify({ error: "RLS_FORBIDDEN" }), { status: 403 });
  }

  const { messages } = await request.json() as {
    messages: { role: "user" | "assistant"; content: string }[];
  };

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: SCHOOL_SYSTEM_PROMPT,
    messages,
    tools: schoolTreasuryTools,
    maxSteps: 5,
    onFinish: async ({ text, toolCalls }) => {
      const service = createServiceClient();
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
      await service.from("ai_chat_logs").insert({
        persona_type: "school_treasury_ai",
        actor_profile_id: user.id,
        prompt: lastUserMsg,
        response: text,
        function_calls: toolCalls.length > 0 ? (toolCalls as unknown as Record<string, unknown>) : null,
      });
    },
  });

  return result.toDataStreamResponse();
}
