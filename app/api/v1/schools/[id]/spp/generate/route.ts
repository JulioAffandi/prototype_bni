import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const GenerateSPPSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, "Format period harus YYYY-MM"),
  amount: z.number().positive().optional().default(500000),
  due_date: z.string().optional(),
});

/**
 * POST /api/v1/schools/[id]/spp/generate
 * School Admin bulk-generates monthly SPP invoices for all active students (Schema v3).
 * Inserts pending spp_invoices for students without existing bills in the given period.
 */
export async function POST(
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

  const body = await request.json() as unknown;
  const parsed = GenerateSPPSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { period, amount, due_date: customDueDate } = parsed.data;
  const dueDate = customDueDate || `${period}-10`;

  // 1. Fetch active students in school
  const { data: students, error: studentErr } = await service
    .from("students")
    .select("id, full_name")
    .eq("school_id", schoolId)
    .eq("status", "active");

  if (studentErr || !students || students.length === 0) {
    return NextResponse.json(
      { error: "NO_ACTIVE_STUDENTS", message: "Tidak ada siswa aktif di sekolah ini." },
      { status: 400 },
    );
  }

  // 2. Fetch existing invoices for period
  const { data: existingInvoices } = await service
    .from("spp_invoices")
    .select("student_id")
    .eq("school_id", schoolId)
    .eq("period", period);

  const existingStudentIds = new Set((existingInvoices ?? []).map((i) => i.student_id));
  const newStudents = students.filter((s) => !existingStudentIds.has(s.id));

  if (newStudents.length === 0) {
    return NextResponse.json({
      success: true,
      period,
      generated_count: 0,
      message: `Seluruh ${students.length} siswa aktif sudah memiliki tagihan SPP untuk periode ${period}.`,
    });
  }

  // 3. Bulk insert spp_invoices
  const invoicesToInsert = newStudents.map((s) => ({
    school_id: schoolId,
    student_id: s.id,
    period,
    amount,
    amount_paid: 0,
    status: "UNPAID" as const,
    due_date: dueDate,
    retry_count: 0,
  }));

  const { data: inserted, error: insertErr } = await service
    .from("spp_invoices")
    .insert(invoicesToInsert)
    .select("id");

  if (insertErr) {
    return NextResponse.json(
      { error: "BULK_INSERT_FAILED", detail: insertErr.message },
      { status: 500 },
    );
  }

  const generatedCount = inserted?.length ?? newStudents.length;

  // 4. Audit Log
  await service.from("audit_log").insert({
    school_id: schoolId,
    actor_user_id: user.id,
    actor_role_snapshot: "school_admin",
    action: "SPP_BATCH_GENERATED",
    entity_type: "spp_invoices",
    entity_id: schoolId,
    metadata: { period, amount, generated_count: generatedCount, timestamp: new Date().toISOString() },
  });

  return NextResponse.json({
    success: true,
    period,
    generated_count: generatedCount,
    message: `Berhasil membuat ${generatedCount} tagihan SPP untuk periode ${period}.`,
  });
}
