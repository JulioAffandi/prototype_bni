import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/v1/schools/[id]/spp?period=YYYY-MM
 * Returns all SPP invoices for a school in a given period.
 * Reference: Schema v3 §9 (spp_invoices)
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

  const appMetadata = user.app_metadata || {};
  const userRoles: string[] = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
  const userSchoolIds: string[] = Array.isArray(appMetadata.school_ids) ? appMetadata.school_ids : [];

  const isSchoolAdmin = (userRoles.includes("school_admin") || userRoles.includes("school_treasurer") || userRoles.includes("platform_admin")) &&
    (userSchoolIds.includes(schoolId) || userRoles.includes("platform_admin"));

  const service = createServiceClient();

  if (!isSchoolAdmin) {
    const { data: roles } = await service
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", user.id)
      .is("revoked_at", null);

    const hasAccess = roles?.some(
      (r) => (r.role === "school_admin" || r.role === "school_treasurer") && r.school_id === schoolId,
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "RLS_FORBIDDEN" }, { status: 403 });
    }
  }

  const period = request.nextUrl.searchParams.get("period");
  if (!period) {
    return NextResponse.json({ error: "INVALID_PAYLOAD", message: "period query param required (YYYY-MM)" }, { status: 400 });
  }

  const { data: invoices, error } = await (service as any)
    .from("spp_invoices")
    .select(`
      id, student_id, period, amount, amount_paid, status, due_date, paid_at,
      retry_count, bni_h2h_reference,
      students ( full_name )
    `)
    .eq("school_id", schoolId)
    .eq("period", period)
    .order("status");

  if (error) {
    return NextResponse.json({ error: "FETCH_FAILED" }, { status: 500 });
  }

  const mapped = (invoices ?? []).map((inv: any) => {
    const studentObj = inv.students as unknown as { full_name?: string } | null;
    return {
      id: inv.id,
      student_id: inv.student_id,
      period: inv.period,
      amount: inv.amount,
      amount_paid: inv.amount_paid,
      status: inv.status,
      due_date: inv.due_date,
      paid_at: inv.paid_at,
      retry_count: inv.retry_count,
      bni_h2h_reference: inv.bni_h2h_reference,
      student_name: studentObj?.full_name ?? "Siswa",
    };
  });

  return NextResponse.json({ invoices: mapped });
}
