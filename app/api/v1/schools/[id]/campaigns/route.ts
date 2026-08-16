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
  const { id: schoolId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const service = createServiceClient();
  const { data: campaigns, error } = await (service as any)
    .from("school_billing_campaigns")
    .select("*, campaign_invoices(id, status, amount)")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "QUERY_FAILED", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ campaigns: campaigns ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: schoolId } = await params;
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
  const service = createServiceClient();

  // 1. Insert into school_billing_campaigns
  const { data: campaign, error: campaignErr } = await (service as any)
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
    return NextResponse.json({ error: "CAMPAIGN_CREATE_FAILED", detail: campaignErr?.message }, { status: 500 });
  }

  // 2. Query targeted students
  let studentQuery = service
    .from("students")
    .select("id, full_name, grade_level, class_label")
    .eq("school_id", schoolId)
    .eq("status", "active");

  if (target_scope === "GRADE_LEVEL" && target_filter?.grade_level) {
    studentQuery = studentQuery.eq("grade_level", target_filter.grade_level);
  }

  const { data: targetedStudents, error: studentErr } = await studentQuery;

  if (studentErr || !targetedStudents || targetedStudents.length === 0) {
    return NextResponse.json({
      success: true,
      campaign,
      total_students: 0,
      message: "Kampanye dibuat, namun tidak ada siswa aktif yang cocok dengan filter target.",
    });
  }

  // 3. Batch insert campaign_invoices
  const invoiceRows = targetedStudents.map((st) => ({
    campaign_id: campaign.id,
    school_id: schoolId,
    student_id: st.id,
    amount,
    status: "UNPAID",
  }));

  const { error: invBatchErr } = await (service as any)
    .from("campaign_invoices")
    .insert(invoiceRows);

  if (invBatchErr) {
    console.warn("[Campaign API] Invoice batch warning:", invBatchErr.message);
  }

  // 4. Query linked parents and insert portal_notifications
  const studentIds = targetedStudents.map((s) => s.id);
  const { data: mapRows } = await service
    .from("guardian_student_map")
    .select("parent_id")
    .in("student_id", studentIds)
    .ilike("status", "active");

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

    await (service as any).from("portal_notifications").insert(notifRows);
  }

  return NextResponse.json({
    success: true,
    campaign_id: campaign.id,
    total_students: targetedStudents.length,
    notifications_sent: parentIds.length,
    message: `Berhasil menerbitkan tagihan ${title} ke ${targetedStudents.length} siswa`,
  }, { status: 201 });
}
