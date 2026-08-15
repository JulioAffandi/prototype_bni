import { createServiceClient } from "@/lib/supabase/service";

export async function recordDeliveryFailure(
  entityType: "parent" | "merchant" | "school",
  entityId: string,
  chatId: string,
  errorCode: number
) {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("telegram_link_failures")
    .select("consecutive_failures")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .maybeSingle();

  const currentCount = existing?.consecutive_failures ?? 0;

  await supabase.from("telegram_link_failures").upsert(
    {
      entity_type: entityType,
      entity_id: entityId,
      chat_id: chatId,
      consecutive_failures: currentCount + 1,
      last_error_code: errorCode,
      last_attempt_at: new Date().toISOString(),
    },
    { onConflict: "entity_type,entity_id" }
  );
}

export async function clearDeliveryFailure(
  entityType: "parent" | "merchant" | "school",
  entityId: string
) {
  const supabase = createServiceClient();
  await supabase
    .from("telegram_link_failures")
    .delete()
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);
}
