import { getRotatedGeminiApiKey } from "@/lib/ai/keys";

export const runtime = "nodejs";

export async function GET() {
  try {
    const apiKey = getRotatedGeminiApiKey();

    if (!apiKey) {
      return Response.json(
        {
          error: "MISSING_API_KEY",
          message: "GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY is missing or invalid.",
        },
        { status: 500 }
      );
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        {
          error: "API_ERROR",
          status: response.status,
          statusText: response.statusText,
          details: data,
        },
        { status: response.status }
      );
    }

    const models = Array.isArray(data.models)
      ? data.models.map((m: { name: string; displayName?: string; description?: string; supportedGenerationMethods?: string[] }) => ({
          name: m.name,
          id: typeof m.name === "string" ? m.name.replace(/^models\//, "") : m.name,
          displayName: m.displayName,
          description: m.description,
          supportedGenerationMethods: m.supportedGenerationMethods,
        }))
      : [];

    return Response.json({
      success: true,
      count: models.length,
      models,
      raw: data,
    });
  } catch (err) {
    console.error("❌ [AI Diagnostics Error]:", err);
    return Response.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
