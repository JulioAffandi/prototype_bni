import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/v1/spp/[id]/retry
 * Manually triggers a retry for a FAILED SPP debit.
 * Max 3 retries — enforced here and in the BNI H2H webhook.
 * Reference: PRODUCT_SPECIFICATION_v2.md §5.4
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

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .single();

  const profile = profileData as { role: string; school_id: string | null } | null;

  if (!profile || profile.role !== "school_admin") {
    return NextResponse.json({ error: "RLS_FORBIDDEN" }, { status: 403 });
  }

  const service = createServiceClient();

  // Fetch invoice and verify ownership
  const { data: invoice } = await service
    .from("spp_invoices")
    .select("id, school_id, status, retry_count, student_id, amount")
    .eq("id", invoiceId)
    .single();

  if (!invoice || invoice.school_id !== profile.school_id) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  if (invoice.status === "PAID") {
    return NextResponse.json({ error: "INVALID_STATE", message: "Invoice sudah lunas." }, { status: 400 });
  }

  if (invoice.retry_count >= 3) {
    return NextResponse.json(
      { error: "MAX_RETRY_EXCEEDED", message: "Batas percobaan ulang (3x) telah tercapai. Hubungi tim VALO." },
      { status: 429 }
    );
  }

  // Mark as UNPAID to trigger next debit cycle
  const { error: updateError } = await service
    .from("spp_invoices")
    .update({ status: "UNPAID" })
    .eq("id", invoiceId);

  if (updateError) {
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }

  await service.from("audit_log").insert({
    actor_profile_id: user.id,
    action: "SPP_RETRY_TRIGGERED",
    entity_type: "spp_invoices",
    entity_id: invoiceId,
    metadata: {
      retry_count: invoice.retry_count,
      school_id: profile.school_id,
    },
  });

  return NextResponse.json({ message: "Percobaan ulang debit SPP dijadwalkan.", retry_count: invoice.retry_count });
}
