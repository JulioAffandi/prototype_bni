import { createServiceClient } from "@/lib/supabase/service";
import type { User } from "@supabase/supabase-js";

export type ResolvedEntity = {
  entityType: "parent" | "merchant" | "school";
  entityId: string;
  table: "parents" | "merchants" | "schools";
  chatId: string | null;
};

export async function resolveUserEntity(user: User): Promise<ResolvedEntity | null> {
  const service = createServiceClient();
  const appMetadata = user.app_metadata || {};

  // 1. Check parent profile
  const { data: profile } = await service
    .from("profiles")
    .select("parent_id")
    .eq("id", user.id)
    .maybeSingle();

  const parentId = (appMetadata.parent_id as string) || profile?.parent_id;

  // 2. Fetch roles
  const { data: userRoles } = await service
    .from("user_roles")
    .select("role, school_id, merchant_id")
    .eq("user_id", user.id)
    .is("revoked_at", null);

  const rolesFromMeta = Array.isArray(appMetadata.roles) ? (appMetadata.roles as string[]) : [];
  const dbRoles = userRoles || [];

  // Check parent
  if (parentId || rolesFromMeta.includes("parent") || dbRoles.some((r) => r.role === "parent")) {
    if (parentId) {
      const { data: parentRow } = await service
        .from("parents")
        .select("telegram_chat_id")
        .eq("id", parentId)
        .maybeSingle();

      return {
        entityType: "parent",
        entityId: parentId,
        table: "parents",
        chatId: parentRow?.telegram_chat_id ?? null,
      };
    }
  }

  // Check merchant staff / owner
  const merchantRole = dbRoles.find(
    (r) => r.role === "merchant_staff" || r.role === "merchant_owner"
  );
  const merchantId =
    merchantRole?.merchant_id ||
    (Array.isArray(appMetadata.merchant_ids) ? appMetadata.merchant_ids[0] : null);

  if (merchantId) {
    const { data: merchantRow } = await service
      .from("merchants")
      .select("telegram_chat_id")
      .eq("id", merchantId)
      .maybeSingle();

    return {
      entityType: "merchant",
      entityId: merchantId,
      table: "merchants",
      chatId: merchantRow?.telegram_chat_id ?? null,
    };
  }

  // Check school admin / treasurer
  const schoolRole = dbRoles.find(
    (r) => r.role === "school_admin" || r.role === "school_treasurer"
  );
  const schoolId =
    schoolRole?.school_id ||
    (Array.isArray(appMetadata.school_ids) ? appMetadata.school_ids[0] : null);

  if (schoolId) {
    const { data: schoolRow } = await service
      .from("schools")
      .select("telegram_chat_id")
      .eq("id", schoolId)
      .maybeSingle();

    return {
      entityType: "school",
      entityId: schoolId,
      table: "schools",
      chatId: schoolRow?.telegram_chat_id ?? null,
    };
  }

  return null;
}
