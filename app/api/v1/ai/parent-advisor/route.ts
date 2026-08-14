import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { NextRequest } from "next/server";
import { PARENT_SYSTEM_PROMPT, parentAdvisorTools } from "@/lib/ai/parentPrompt";
import type { Json } from "@/types/database";

/**
 * POST /api/v1/ai/parent-advisor
 * Streaming AI chat for Parent Family Advisor (Persona C).
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
  const isParentUser = userRoles.includes("parent") || userRoles.includes("platform_admin");

  if (!isParentUser) {
    const { data: roles } = await service
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .is("revoked_at", null);

    const hasAccess = roles?.some((r) => r.role === "parent");
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "RLS_FORBIDDEN" }), { status: 403 });
    }
  }

  const { messages } = await request.json() as {
    messages: { role: "user" | "assistant"; content: string }[];
  };

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: PARENT_SYSTEM_PROMPT,
    messages,
    tools: parentAdvisorTools,
    maxSteps: 5,
    onFinish: async ({ text, toolCalls }) => {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
      await service.from("ai_chat_logs").insert({
        persona_type: "parent_ai",
        actor_user_id: user.id,
        prompt: lastUserMsg,
        response: text,
        function_calls: toolCalls.length > 0 ? (toolCalls as unknown as Json) : null,
      });
    },
  });

  return result.toDataStreamResponse();
}
