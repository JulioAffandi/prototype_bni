import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrResolveParentId } from "@/lib/supabase/parent-resolver";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Database } from "@/types/database";

type ParentUpdatePayload = Database["public"]["Tables"]["parents"]["Update"];

const ParentProfileUpdateSchema = z.object({
  full_name: z.string().min(2).optional(),
  phone_number: z.string().min(8).optional(),
  bni_account_number: z.string().optional().nullable().or(z.literal("")),
  telegram_chat_id: z.string().optional().nullable().or(z.literal("")),
});

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "+62" + cleaned.slice(1);
  } else if (cleaned.startsWith("62")) {
    cleaned = "+" + cleaned;
  } else if (!cleaned.startsWith("+")) {
    cleaned = "+62" + cleaned;
  }
  return cleaned;
}

export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json() as unknown;
  const parsed = ParentProfileUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  let parentId = await getOrResolveParentId(user);

  // Auto-provision parent record if not yet linked
  if (!parentId) {
    const defaultName = parsed.data.full_name || user.user_metadata?.full_name || "Wali Siswa";
    const rawPhone = parsed.data.phone_number || user.phone || "+6281200001111";
    const normPhone = normalizePhone(rawPhone);

    const { data: newParent, error: createErr } = await service
      .from("parents")
      .insert({
        full_name: defaultName,
        phone_number: normPhone,
        email: user.email || null,
        bni_account_number: parsed.data.bni_account_number || null,
        bni_link_status: parsed.data.bni_account_number ? "LINKED" : "UNLINKED",
        telegram_chat_id: parsed.data.telegram_chat_id || null,
      })
      .select("id")
      .single();

    if (createErr || !newParent) {
      console.error("Auto-provision parent profile failed:", createErr);
      return NextResponse.json(
        { error: "PROVISION_FAILED", message: createErr?.message || "Gagal membuat data profil wali." },
        { status: 500 },
      );
    }

    parentId = newParent.id;
    await service.from("profiles").upsert({
      id: user.id,
      display_name: defaultName,
      role: "parent",
      parent_id: parentId,
    });
  }

  const updateData: ParentUpdatePayload = {};

  if (parsed.data.full_name !== undefined) updateData.full_name = parsed.data.full_name.trim();
  if (parsed.data.phone_number !== undefined) {
    updateData.phone_number = normalizePhone(parsed.data.phone_number);
  }
  if (parsed.data.bni_account_number !== undefined) {
    const cleanBni = parsed.data.bni_account_number?.trim() || null;
    updateData.bni_account_number = cleanBni;
    updateData.bni_link_status = cleanBni ? "LINKED" : "UNLINKED";
  }
  if (parsed.data.telegram_chat_id !== undefined) {
    const cleanTg = parsed.data.telegram_chat_id?.trim() || null;
    updateData.telegram_chat_id = cleanTg;
  }

  updateData.updated_at = new Date().toISOString();

  try {
    const { error: updateErr } = await service
      .from("parents")
      .update(updateData)
      .eq("id", parentId);

    if (updateErr) {
      console.error("Update parent profile error:", updateErr);
      return NextResponse.json(
        { error: "UPDATE_FAILED", message: updateErr.message, detail: updateErr.details },
        { status: 400 },
      );
    }

    if (parsed.data.full_name) {
      await service.from("profiles").update({ display_name: parsed.data.full_name }).eq("id", user.id);
    }

    return NextResponse.json({ success: true, message: "Profil Orang Tua berhasil diperbarui!" });
  } catch (err) {
    console.error("Update parent profile exception:", err);
    return NextResponse.json(
      {
        error: "UPDATE_EXCEPTION",
        message: err instanceof Error ? err.message : "Terjadi kesalahan server saat memperbarui profil.",
      },
      { status: 500 },
    );
  }
}
