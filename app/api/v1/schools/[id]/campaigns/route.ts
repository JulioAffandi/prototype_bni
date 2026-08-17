// app/api/v1/schools/[id]/campaigns/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const createCampaignSchema = z.object({
  title: z.string().min(3, "Judul event minimal 3 karakter"),
  category: z.enum(["KEGIATAN", "BUKU", "SERAGAM", "LAINNYA"]).default("KEGIATAN"),
  amount: z.number().positive("Nominal harus lebih dari 0"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  target_scope: z.enum(["ALL", "GRADE_LEVEL", "CLASS_GROUP"]).default("ALL"),
  target_filter: z.record(z.any()).optional().default({}),
  description: z.string().optional(),
  is_mandatory: z.boolean().optional().default(true),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawSchoolId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const service = createServiceClient();
  const schoolId = !rawSchoolId || rawSchoolId === "demo" || rawSchoolId === "undefined"
    ? "09c77f03-7f77-4c26-8da4-6ad5462f860c"
    : rawSchoolId;

  const { data: campaigns, error } = await service
    .from("school_billing_campaigns")
    .select("*")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "QUERY_FAILED", detail: error.message }, { status: 500 });
  }

  const campaignIds = (campaigns ?? []).map((campaign) => campaign.id);
  if (campaignIds.length === 0) {
    return NextResponse.json({ campaigns: [] });
  }

  const { data: invoices, error: invoiceError } = await service
    .from("campaign_invoices")
    .select("campaign_id, amount, status")
    .in("campaign_id", campaignIds);

  if (invoiceError) {
    return NextResponse.json({ error: "INVOICE_STATS_FAILED", detail: invoiceError.message }, { status: 500 });
  }

  const statsMap = new Map<string, {
    totalStudents: number;
    paidStudents: number;
    totalCollected: number;
    targetAmount: number;
  }>();

  for (const invoice of invoices ?? []) {
    const stats = statsMap.get(invoice.campaign_id) ?? {
      totalStudents: 0,
      paidStudents: 0,
      totalCollected: 0,
      targetAmount: 0,
    };
    const invoiceAmount = Number(invoice.amount);
    stats.totalStudents += 1;
    stats.targetAmount += invoiceAmount;
    if (invoice.status === "PAID") {
      stats.paidStudents += 1;
      stats.totalCollected += invoiceAmount;
    }
    statsMap.set(invoice.campaign_id, stats);
  }

  const enrichedCampaigns = (campaigns ?? []).map((campaign) => {
    const stats = statsMap.get(campaign.id) ?? {
      totalStudents: 0,
      paidStudents: 0,
      totalCollected: 0,
      targetAmount: 0,
    };

    return {
      ...campaign,
      stats: {
        ...stats,
        progressPct: stats.totalStudents > 0
          ? Math.round((stats.paidStudents / stats.totalStudents) * 100)
          : 0,
      },
    };
  });

  return NextResponse.json({ campaigns: enrichedCampaigns });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawSchoolId } = await params;
  const service = createServiceClient();
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { title, category, amount, due_date, target_scope, target_filter, description, is_mandatory } = parsed.data;
  let schoolId = rawSchoolId;
  if (!schoolId || schoolId === "demo" || schoolId === "undefined") {
    schoolId = "09c77f03-7f77-4c26-8da4-6ad5462f860c";
  }

  const { data: campaign, error: campaignErr } = await service
    .from("school_billing_campaigns")
    .insert({
      school_id: schoolId,
      title,
      category,
      amount,
      due_date,
      target_scope,
      target_filter,
      description: description ?? null,
      is_mandatory,
      status: "ACTIVE",
    })
    .select()
    .single();

  if (campaignErr || !campaign) {
    return NextResponse.json({ error: "CAMPAIGN_INSERT_FAILED", detail: campaignErr?.message }, { status: 500 });
  }

  // Do not rely on status casing; non-deleted students are eligible for ad-hoc billing.
  let studentQuery = (service as any)
    .from("students")
    .select("id, full_name, school_id, status, grade_level, class_group")
    .is("deleted_at", null)
    .or(`school_id.eq.${schoolId},school_id.is.null`);

  if (target_scope === "GRADE_LEVEL" && target_filter?.grade_level) {
    studentQuery = studentQuery.eq("grade_level", target_filter.grade_level);
  } else if (target_scope === "CLASS_GROUP" && target_filter?.class_group) {
    studentQuery = studentQuery.eq("class_group", target_filter.class_group);
  }

  const { data: matchedStudents, error: studentErr } = await studentQuery;

  if (studentErr) {
    return NextResponse.json({ error: "STUDENTS_QUERY_FAILED", detail: studentErr.message }, { status: 500 });
  }

  const targetStudents = matchedStudents ?? [];
  if (targetStudents.length === 0) {
    return NextResponse.json({
      success: true,
      campaign,
      invoices_created: 0,
      warning: "Kampanye dibuat, namun tidak ada siswa yang ditemukan di sekolah ini.",
    });
  }

  const invoiceRows = targetStudents.map((student: { id: string; school_id: string | null }) => ({
    campaign_id: campaign.id,
    school_id: student.school_id || schoolId,
    student_id: student.id,
    amount,
    status: "UNPAID",
  }));

  const { data: createdInvoices, error: invBatchErr } = await service
    .from("campaign_invoices")
    .insert(invoiceRows)
    .select();

  if (invBatchErr) {
    return NextResponse.json({ error: "INVOICE_GENERATION_FAILED", detail: invBatchErr.message }, { status: 500 });
  }

  const studentIds = targetStudents.map((student: { id: string }) => student.id);
  const { data: mapRows } = await service
    .from("guardian_student_map")
    .select("parent_id, student_id")
    .in("student_id", studentIds);

  const parentIds = Array.from(new Set((mapRows ?? []).map((m) => m.parent_id)));

  if (parentIds.length > 0) {
    const formattedAmount = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);
    const notifRows = parentIds.map((pid) => ({
      parent_id: pid,
      title: `Tagihan Baru: ${title}`,
      message: `Tagihan ${title} sebesar ${formattedAmount} telah diterbitkan. Jatuh tempo: ${due_date}.`,
      type: "BILLING_ALERT",
      action_url: "/spp?tab=kegiatan",
      is_read: false,
    }));

    await service.from("portal_notifications").insert(notifRows);
  }

  return NextResponse.json({
    success: true,
    campaign,
    invoices_created: createdInvoices?.length ?? invoiceRows.length,
    notifications_sent: parentIds.length,
    message: `Berhasil menerbitkan tagihan kepada ${invoiceRows.length} siswa.`,
  }, { status: 201 });
}
