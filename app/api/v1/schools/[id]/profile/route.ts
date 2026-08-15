import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Database } from "@/types/database";

type SchoolUpdatePayload = Database["public"]["Tables"]["schools"]["Update"];

const SchoolProfileUpdateSchema = z.object({
  school_name: z.string().min(2).optional(),
  phone_number: z.string().optional(),
  address: z.string().nullable().optional(),
  default_daily_limit: z.number().positive().optional(),
  default_emergency_limit: z.number().nonnegative().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: schoolId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json() as unknown;
  const parsed = SchoolProfileUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const updateData: SchoolUpdatePayload = {};

  if (parsed.data.school_name) updateData.name = parsed.data.school_name;
  if (parsed.data.address !== undefined) updateData.address = parsed.data.address;
  if (parsed.data.default_daily_limit !== undefined) updateData.default_daily_limit = parsed.data.default_daily_limit;
  if (parsed.data.default_emergency_limit !== undefined) updateData.default_emergency_limit = parsed.data.default_emergency_limit;

  updateData.updated_at = new Date().toISOString();

  const { error: updateErr } = await service
    .from("schools")
    .update(updateData)
    .eq("id", schoolId);

  if (updateErr) {
    return NextResponse.json({ error: "UPDATE_FAILED", detail: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Profil Sekolah berhasil diperbarui!" });
}
