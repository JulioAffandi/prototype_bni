import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { streamText, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { NextRequest } from "next/server";
import { SCHOOL_SYSTEM_PROMPT, schoolTreasuryTools } from "@/lib/ai/schoolPrompt";
import type { Json } from "@/types/database";

/**
 * POST /api/v1/ai/treasury-advisor
 * Streaming AI chat for School Treasury Advisor (Persona B).
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
  const userSchoolIds: string[] = Array.isArray(appMetadata.school_ids) ? appMetadata.school_ids : [];

  const service = createServiceClient();
  const isSchoolStaff = userRoles.includes("school_admin") || userRoles.includes("school_treasurer") || userRoles.includes("platform_admin");

  if (!isSchoolStaff) {
    const { data: roles } = await service
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", user.id)
      .is("revoked_at", null);

    const hasAccess = roles?.some(
      (r) => r.role === "school_admin" || r.role === "school_treasurer",
    );
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "RLS_FORBIDDEN" }), { status: 403 });
    }
  }

  const schoolId = userSchoolIds[0] || null;

  const { messages } = await request.json() as {
    messages: { role: "user" | "assistant"; content: string }[];
  };

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: SCHOOL_SYSTEM_PROMPT,
    messages,
    tools: schoolTreasuryTools,
    stopWhen: stepCountIs(5),
    onFinish: async ({ text, toolCalls }) => {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
      await service.from("ai_chat_logs").insert({
        persona_type: "school_treasury_ai",
        actor_user_id: user.id,
        school_id: schoolId,
        prompt: lastUserMsg,
        response: text,
        function_calls: toolCalls.length > 0 ? (toolCalls as unknown as Json) : null,
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
