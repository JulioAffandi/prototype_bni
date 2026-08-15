import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveUserEntity } from "@/lib/telegram/user-resolver";
import { clearDeliveryFailure } from "@/lib/telegram/failure-tracker";

const CHAT_ID_RE = /^-?\d{5,15}$/;

export async function GET(_req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolved = await resolveUserEntity(user);
  if (!resolved) {
    return NextResponse.json({ error: "Role not eligible for Telegram linking" }, { status: 403 });
  }

  const service = createServiceClient();
  const { data: failure } = await service
    .from("telegram_link_failures")
    .select("consecutive_failures, last_error_code, last_attempt_at")
    .eq("entity_type", resolved.entityType)
    .eq("entity_id", resolved.entityId)
    .maybeSingle();

  return NextResponse.json({
    connected: Boolean(resolved.chatId),
    chat_id: resolved.chatId,
    entity_type: resolved.entityType,
    failure: failure ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolved = await resolveUserEntity(user);
  if (!resolved) {
    return NextResponse.json({ error: "Role not eligible for Telegram linking" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const rawChatId = body?.chat_id;

  let chatIdToSave: string | null = null;
  if (typeof rawChatId === "string" && rawChatId.trim() !== "") {
    const trimmed = rawChatId.trim();
    if (!CHAT_ID_RE.test(trimmed)) {
      return NextResponse.json(
        { error: "Invalid chat_id: must be a numeric Telegram chat identifier (5-15 digits)." },
        { status: 400 }
      );
    }
    chatIdToSave = trimmed;
  }

  const service = createServiceClient();
  const { error: updateErr } = await service
    .from(resolved.table)
    .update({ telegram_chat_id: chatIdToSave })
    .eq("id", resolved.entityId);

  if (updateErr) {
    return NextResponse.json({ error: "Failed to save chat id: " + updateErr.message }, { status: 500 });
  }

  // Clear any past failure record on link update
  await clearDeliveryFailure(resolved.entityType, resolved.entityId);

  return NextResponse.json({
    connected: Boolean(chatIdToSave),
    chat_id: chatIdToSave,
  });
}
