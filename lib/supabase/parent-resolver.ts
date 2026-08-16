import { createServiceClient } from "@/lib/supabase/service";
import type { User } from "@supabase/supabase-js";

/**
 * Resolves the parent_id for an authenticated Supabase user.
 * Schema v3: Single source of truth is profiles.parent_id or user.app_metadata.parent_id.
 * 1. Checks user.app_metadata.parent_id
 * 2. Checks profiles.parent_id
 * 3. Checks parents by id = user.id
 * 4. Searches parents by email or phone
 * 5. Auto-creates parent record in public.parents if missing
 */
export async function getOrResolveParentId(user: User, autoCreate = true): Promise<string | null> {
  const service = createServiceClient();

  // 1. Check JWT app_metadata
  const metaParentId = user.app_metadata?.parent_id as string | undefined;
  if (metaParentId) {
    const { data: validParent } = await service
      .from("parents")
      .select("id")
      .eq("id", metaParentId)
      .maybeSingle();
    if (validParent) return validParent.id;
  }

  // 2. Check existing profile
  const { data: profile } = await service
    .from("profiles")
    .select("parent_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.parent_id) {
    const { data: validParent } = await service
      .from("parents")
      .select("id")
      .eq("id", profile.parent_id)
      .maybeSingle();
    if (validParent) return validParent.id;
  }

  // 3. Check parents table directly by auth_user_id = user.id or id = user.id
  const { data: byDirectId } = await service
    .from("parents")
    .select("id")
    .or(`auth_user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle();

  if (byDirectId) {
    await service.from("profiles").upsert({
      id: user.id,
      display_name: user.user_metadata?.full_name || user.email || "Parent",
      parent_id: byDirectId.id,
    });
    return byDirectId.id;
  }

  // 4. Search parents by email
  if (user.email && user.email.trim()) {
    const cleanEmail = user.email.trim().toLowerCase();
    const { data: byEmail } = await service
      .from("parents")
      .select("id")
      .ilike("email", cleanEmail)
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

  // 5. Search parents by phone number
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

  // 6. Auto-create parent record if no record exists in public.parents for current user
  if (autoCreate) {
    const displayName = user.user_metadata?.full_name || user.email || "Parent";
    const userEmail = user.email || null;
    const userPhone =
      phone && phone.trim()
        ? phone.trim()
        : `+628${Math.floor(100000000 + Math.random() * 900000000)}`;

    const { data: newParent, error: createErr } = await service
      .from("parents")
      .insert({
        full_name: displayName,
        phone_number: userPhone,
        email: userEmail,
        bni_link_status: "LINKED",
      })
      .select("id")
      .single();

    if (createErr) {
      console.error("Failed to auto-create parent record:", createErr);
    }

    if (newParent) {
      await service.from("profiles").upsert({
        id: user.id,
        display_name: displayName,
        parent_id: newParent.id,
      });
      return newParent.id;
    }
  }

  return null;
}
