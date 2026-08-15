import "server-only";
import { createServiceSupabase } from "@/lib/supabase/server";

const MAX_REQ_PER_JAM = Number(process.env.AI_MAX_REQ_PER_HOUR ?? 40);
const WINDOW_MENIT = 60;

export async function consumeRateLimit(actorProfileId: string) {
  const svc = createServiceSupabase();
  const { data, error } = await svc.rpc("rpc_ai_consume_rate_limit", {
    p_profile: actorProfileId,
    p_max_req: MAX_REQ_PER_JAM,
    p_window_minutes: WINDOW_MENIT,
  });

  if (error) {
    console.error(JSON.stringify({ level: "error", scope: "ai_rate_limit", msg: error.message }));
    return { diizinkan: true, sisaRequest: -1, retryAfterSeconds: 0 };
  }

  const row = (data as any[])?.[0] ?? { diizinkan: true, sisa_request: -1 };
  const detikKeJamBerikutnya = 3600 - Math.floor((Date.now() % 3_600_000) / 1000);

  return {
    diizinkan: Boolean(row.diizinkan),
    sisaRequest: Number(row.sisa_request),
    retryAfterSeconds: row.diizinkan ? 0 : detikKeJamBerikutnya,
  };
}
