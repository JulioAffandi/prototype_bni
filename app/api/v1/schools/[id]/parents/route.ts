import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/schools/[id]/parents
 * Returns list of registered parent accounts in public.parents (Schema v3).
 * School Admin authorization check.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: schoolId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const service = createServiceClient();

  // Fetch parents table records
  const { data: parents, error } = await service
    .from("parents")
    .select("id, full_name, phone_number, email, bni_account_number, created_at")
    .is("deleted_at", null)
    .order("full_name");

  if (error) {
    return NextResponse.json({ error: "FETCH_FAILED", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ parents: parents ?? [] });
}
