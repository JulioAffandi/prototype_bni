import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/schools/[id]/spp?period=YYYY-MM
 * Returns all SPP invoices for a school in a given period.
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "school_admin" || profile.school_id !== schoolId) {
    return NextResponse.json({ error: "RLS_FORBIDDEN" }, { status: 403 });
  }

  const period = request.nextUrl.searchParams.get("period");
  if (!period) {
    return NextResponse.json({ error: "INVALID_PAYLOAD", message: "period query param required (YYYY-MM)" }, { status: 400 });
  }

  const { data: invoices, error } = await supabase
    .from("spp_invoices")
    .select(`
      id, student_id, period, amount, status, due_date, paid_at,
      retry_count, bni_h2h_reference,
      students ( full_name )
    `)
    .eq("school_id", schoolId)
    .eq("period", period)
    .order("status");

  if (error) {
    return NextResponse.json({ error: "FETCH_FAILED" }, { status: 500 });
  }

  const mapped = (invoices ?? []).map((inv) => ({
    ...inv,
    student_name: (inv.students as { full_name?: string } | null)?.full_name ?? "Siswa",
  }));

  return NextResponse.json({ invoices: mapped });
}
