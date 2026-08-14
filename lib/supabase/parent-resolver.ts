import { createServiceClient } from "@/lib/supabase/service";
import type { User } from "@supabase/supabase-js";

/**
 * Resolves the parent_id for an authenticated Supabase user.
 * 1. Checks profiles.parent_id
 * 2. If null, searches parents by auth_user_id, phone, or email
 * 3. Auto-binds profiles.parent_id and parents.auth_user_id if found
 */
export async function getOrResolveParentId(user: User): Promise<string | null> {
  const service = createServiceClient();

  // 1. Check existing profile
  const { data: profileData } = await service
    .from("profiles")
    .select("parent_id")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileData as { parent_id: string | null } | null;

  if (profile?.parent_id) {
    return profile.parent_id;
  }

  // 2. Search parents by auth_user_id
  const { data: byAuth } = await service
    .from("parents")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (byAuth) {
    await service
      .from("profiles")
      .upsert({ id: user.id, role: "parent", parent_id: byAuth.id });
    return byAuth.id;
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
      await service.from("parents").update({ auth_user_id: user.id }).eq("id", byPhone.id);
      await service.from("profiles").upsert({ id: user.id, role: "parent", parent_id: byPhone.id });
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
      await service.from("parents").update({ auth_user_id: user.id }).eq("id", byEmail.id);
      await service.from("profiles").upsert({ id: user.id, role: "parent", parent_id: byEmail.id });
      return byEmail.id;
    }
  }

  return null;
}
