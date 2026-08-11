import { createServiceClient } from "@/lib/supabase/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/schools/[id]/parents
 * Lists or searches registered parents for the school admin picker.
 * Reference: PRODUCT_SPECIFICATION_v2.md §9.2
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: schoolId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .single();

  const profile = profileData as { role?: string; school_id?: string | null } | null;

  if (!profile || profile.role !== "school_admin" || profile.school_id !== schoolId) {
    return NextResponse.json({ error: "RLS_FORBIDDEN" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";

  const service = createServiceClient();
  let dbQuery = service
    .from("parents")
    .select("id, full_name, phone_number, email, bni_account_number, created_at")
    .order("full_name");

  if (query) {
    dbQuery = dbQuery.or(`full_name.ilike.%${query}%,phone_number.ilike.%${query}%,email.ilike.%${query}%`);
  }

  const { data: parents, error } = await dbQuery.limit(50);

  if (error) {
    return NextResponse.json({ error: "FETCH_FAILED", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ parents: parents ?? [] });
}
