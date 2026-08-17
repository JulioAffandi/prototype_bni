import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const DEMO_SCHOOL_ID = "09c77f03-7f77-4c26-8da4-6ad5462f860c";

const updateCampaignSchema = z.object({
  title: z.string().min(3).optional(),
  category: z.enum(["KEGIATAN", "BUKU", "SERAGAM", "LAINNYA"]).optional(),
  amount: z.number().positive().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "CLOSED"]).optional(),
}).refine((payload) => Object.keys(payload).length > 0, "Tidak ada perubahan yang dikirim");

function resolveSchoolId(rawSchoolId: string) {
  return !rawSchoolId || rawSchoolId === "demo" || rawSchoolId === "undefined"
    ? DEMO_SCHOOL_ID
    : rawSchoolId;
}

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; campaignId: string }> }
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { id: rawSchoolId, campaignId } = await params;
  const schoolId = resolveSchoolId(rawSchoolId);
  const body = await req.json().catch(() => null);
  const parsed = updateCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_PAYLOAD", detail: parsed.error.flatten() }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: existingCampaign, error: findError } = await service
    .from("school_billing_campaigns")
    .select("id, amount")
    .eq("id", campaignId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (findError) {
    return NextResponse.json({ error: "CAMPAIGN_QUERY_FAILED", detail: findError.message }, { status: 500 });
  }
  if (!existingCampaign) {
    return NextResponse.json({ error: "CAMPAIGN_NOT_FOUND" }, { status: 404 });
  }

  if (parsed.data.amount !== undefined && parsed.data.amount !== Number(existingCampaign.amount)) {
    const { count, error: paidCountError } = await service
      .from("campaign_invoices")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("status", "PAID");

    if (paidCountError) {
      return NextResponse.json({ error: "INVOICE_QUERY_FAILED", detail: paidCountError.message }, { status: 500 });
    }
    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: "AMOUNT_LOCKED_AFTER_PAYMENT" }, { status: 409 });
    }
  }

  const { data: campaign, error: updateError } = await service
    .from("school_billing_campaigns")
    .update(parsed.data)
    .eq("id", campaignId)
    .eq("school_id", schoolId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: "CAMPAIGN_UPDATE_FAILED", detail: updateError.message }, { status: 500 });
  }

  if (parsed.data.amount !== undefined) {
    const { error: invoiceUpdateError } = await service
      .from("campaign_invoices")
      .update({ amount: parsed.data.amount })
      .eq("campaign_id", campaignId)
      .eq("status", "UNPAID");

    if (invoiceUpdateError) {
      return NextResponse.json({ error: "INVOICE_UPDATE_FAILED", detail: invoiceUpdateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, campaign });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; campaignId: string }> }
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { id: rawSchoolId, campaignId } = await params;
  const schoolId = resolveSchoolId(rawSchoolId);
  const service = createServiceClient();

  const { data: campaign, error: findError } = await service
    .from("school_billing_campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (findError) {
    return NextResponse.json({ error: "CAMPAIGN_QUERY_FAILED", detail: findError.message }, { status: 500 });
  }
  if (!campaign) {
    return NextResponse.json({ error: "CAMPAIGN_NOT_FOUND" }, { status: 404 });
  }

  const { count: paidCount, error: paidCountError } = await service
    .from("campaign_invoices")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "PAID");

  if (paidCountError) {
    return NextResponse.json({ error: "INVOICE_QUERY_FAILED", detail: paidCountError.message }, { status: 500 });
  }

  const { error: unpaidDeleteError } = await service
    .from("campaign_invoices")
    .delete()
    .eq("campaign_id", campaignId)
    .eq("status", "UNPAID");

  if (unpaidDeleteError) {
    return NextResponse.json({ error: "UNPAID_INVOICE_DELETE_FAILED", detail: unpaidDeleteError.message }, { status: 500 });
  }

  if ((paidCount ?? 0) > 0) {
    const { error: closeError } = await service
      .from("school_billing_campaigns")
      .update({ status: "CLOSED" })
      .eq("id", campaignId)
      .eq("school_id", schoolId);

    if (closeError) {
      return NextResponse.json({ error: "CAMPAIGN_CLOSE_FAILED", detail: closeError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action: "CLOSED",
      message: "Invoice belum lunas dihapus dan event ditutup untuk menjaga histori pembayaran.",
    });
  }

  const { error: deleteError } = await service
    .from("school_billing_campaigns")
    .delete()
    .eq("id", campaignId)
    .eq("school_id", schoolId);

  if (deleteError) {
    return NextResponse.json({ error: "CAMPAIGN_DELETE_FAILED", detail: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, action: "DELETED", message: "Event berhasil dihapus." });
}
