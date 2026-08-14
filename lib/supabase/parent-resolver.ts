import { createServiceClient } from "@/lib/supabase/service";
import type { User } from "@supabase/supabase-js";

/**
 * Resolves the parent_id for an authenticated Supabase user.
 * Schema v3: Single source of truth is profiles.parent_id or user.app_metadata.parent_id.
 * 1. Checks user.app_metadata.parent_id
 * 2. Checks profiles.parent_id
 * 3. If null, searches parents by phone or email and binds profiles.parent_id
 */
export async function getOrResolveParentId(user: User): Promise<string | null> {
  // 1. Check JWT app_metadata
  const metaParentId = user.app_metadata?.parent_id as string | undefined;
  if (metaParentId) {
    return metaParentId;
  }

  const service = createServiceClient();

  // 2. Check existing profile
  const { data: profile } = await service
    .from("profiles")
    .select("parent_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.parent_id) {
    return profile.parent_id;
  }

  // 3. Search parents by phone number (user.phone or metadata.phone_number)
  const phone = user.phone || (user.user_metadata?.phone_number as string | undefined);
  if (phone && phone.trim()) {
    const cleanPhone = phone.trim();
    const { data: byPhone } = await service
      .from("parents")
      .select("id")
      .eq("phone_number", cleanPhone)
      .maybeSingle();

    if (byPhone) {
      await service.from("profiles").upsert({
        id: user.id,
        display_name: user.user_metadata?.full_name || user.email || "Parent",
        parent_id: byPhone.id,
      });
      return byPhone.id;
    }
  }

  // 4. Search parents by email
  if (user.email && user.email.trim()) {
    const cleanEmail = user.email.trim();
    const { data: byEmail } = await service
      .from("parents")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (byEmail) {
      await service.from("profiles").upsert({
        id: user.id,
        display_name: user.user_metadata?.full_name || user.email || "Parent",
        parent_id: byEmail.id,
      });
      return byEmail.id;
    }
  }

  return null;
}
