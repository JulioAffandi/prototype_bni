import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveUserEntity } from "@/lib/telegram/user-resolver";
import { notifyTestMessage } from "@/lib/telegram/notifier";

export async function POST(_req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolved = await resolveUserEntity(user);
  if (!resolved) {
    return NextResponse.json({ error: "Role not eligible for Telegram testing" }, { status: 403 });
  }

  if (!resolved.chatId) {
    return NextResponse.json({ error: "Belum ada ID Telegram yang terhubung." }, { status: 400 });
  }

  const result = await notifyTestMessage({
    chatId: resolved.chatId,
    entityType: resolved.entityType,
    entityId: resolved.entityId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { sent: false, error: result.description, code: result.code },
      { status: 502 }
    );
  }

  return NextResponse.json({ sent: true });
}
