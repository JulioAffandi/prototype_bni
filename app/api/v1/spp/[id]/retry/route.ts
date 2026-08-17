import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/v1/spp/[id]/retry
 * Manually triggers a retry for a FAILED SPP debit.
 * Max 3 retries — enforced here and in the BNI H2H webhook.
 * Reference: Schema v3 §9 (spp_invoices)
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: invoiceId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const service = createServiceClient();

  // Fetch invoice
  const { data: invoice } = await service
    .from("spp_invoices")
    .select("id, school_id, status, retry_count, student_id, amount")
    .eq("id", invoiceId)
    .single();

  if (!invoice) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Authorization check
  const appMetadata = user.app_metadata || {};
  const userRoles: string[] = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
  const userSchoolIds: string[] = Array.isArray(appMetadata.school_ids) ? appMetadata.school_ids : [];

  const isAuthorized = (userRoles.includes("school_admin") || userRoles.includes("school_treasurer") || userRoles.includes("platform_admin")) &&
    (userSchoolIds.includes(invoice.school_id) || userRoles.includes("platform_admin"));

  if (!isAuthorized) {
    const { data: roles } = await service
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", user.id)
      .is("revoked_at", null);

    const hasAccess = roles?.some(
      (r) => (r.role === "school_admin" || r.role === "school_treasurer") && r.school_id === invoice.school_id,
    );

    if (!hasAccess) {
      return NextResponse.json({ error: "RLS_FORBIDDEN" }, { status: 403 });
    }
  }

  if (invoice.status === "PAID") {
    return NextResponse.json({ error: "INVALID_STATE", message: "Invoice sudah lunas." }, { status: 400 });
  }

  if (invoice.retry_count >= 3) {
    return NextResponse.json(
      { error: "MAX_RETRY_EXCEEDED", message: "Batas percobaan ulang (3x) telah tercapai. Hubungi tim EduConnect." },
      { status: 429 },
    );
  }

  // Mark as UNPAID to trigger next debit cycle
  const { error: updateError } = await service
    .from("spp_invoices")
    .update({ status: "UNPAID", updated_at: new Date().toISOString() })
    .eq("id", invoiceId);

  if (updateError) {
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }

  await service.from("audit_log").insert({
    school_id: invoice.school_id,
    actor_user_id: user.id,
    actor_role_snapshot: "school_admin",
    action: "SPP_RETRY_TRIGGERED",
    entity_type: "spp_invoices",
    entity_id: invoiceId,
    metadata: {
      retry_count: invoice.retry_count,
      school_id: invoice.school_id,
    },
  });

  return NextResponse.json({ message: "Percobaan ulang debit SPP dijadwalkan.", retry_count: invoice.retry_count });
}
