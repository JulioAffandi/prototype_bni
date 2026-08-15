import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";

const ReissueCardSchema = z.object({
  raw_nfc_uid: z.string().min(4),
  nfc_uid_last4: z.string().length(4).optional(),
});

/**
 * POST /api/v1/schools/[id]/students/[sid]/reissue-card
 * School Admin re-issues a new NFC card for a student (Schema v3).
 * Revokes old card credentials, hashes new UID (SHA-256), inserts active student_cards record,
 * resets student.card_status to 'active', and logs lifecycle & audit events.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> },
) {
  const { id: schoolId, sid: studentId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const appMetadata = user.app_metadata || {};
  const userRoles: string[] = Array.isArray(appMetadata.roles) ? appMetadata.roles : [];
  const userSchoolIds: string[] = Array.isArray(appMetadata.school_ids) ? appMetadata.school_ids : [];

  const isSchoolAdmin = userRoles.includes("school_admin") || userRoles.includes("platform_admin");
  const isSchoolScoped = userSchoolIds.includes(schoolId) || userRoles.includes("platform_admin");

  const service = createServiceClient();

  if (!isSchoolAdmin && !isSchoolScoped) {
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
  const parsed = ReissueCardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { raw_nfc_uid, nfc_uid_last4 } = parsed.data;

  // 1. Tokenize Card UID (SHA-256)
  const tenantSalt = process.env.TENANT_SALT_SECRET || "default_tenant_salt";
  const rawHash = createHash("sha256")
    .update(raw_nfc_uid + tenantSalt)
    .digest("hex");
  const byteaHash = `\\x${rawHash.toLowerCase()}`;
  const last4 = nfc_uid_last4 || raw_nfc_uid.slice(-4);

  // Check if UID is already active in tenant
  const { data: existingCard } = await service
    .from("student_cards")
    .select("id")
    .eq("school_id", schoolId)
    .eq("uid_hash", byteaHash)
    .in("status", ["active", "pending_activation"])
    .maybeSingle();

  if (existingCard) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", message: "UID kartu ini sudah digunakan oleh siswa lain." },
      { status: 409 },
    );
  }

  // 2. Retire/replace all previous active/lost cards for student
  const nowIso = new Date().toISOString();
  await service
    .from("student_cards")
    .update({ status: "replaced", retired_at: nowIso })
    .eq("student_id", studentId)
    .in("status", ["active", "lost_reported", "blocked", "pending_activation"]);

  // 3. Provision new active card credential
  const { data: newCard, error: cardError } = await service
    .from("student_cards")
    .insert({
      student_id: studentId,
      school_id: schoolId,
      uid_hash: byteaHash,
      uid_last4: last4,
      status: "active",
      activated_at: nowIso,
    })
    .select("id, uid_last4, status, activated_at")
    .single();

  if (cardError || !newCard) {
    return NextResponse.json(
      { error: "CARD_PROVISIONING_FAILED", detail: cardError?.message },
      { status: 500 },
    );
  }

  // 4. Reset student status in public.students table
  await service
    .from("students")
    .update({ status: "active" })
    .eq("id", studentId);

  // 5. Log lifecycle event & audit trail
  await service.from("card_lifecycle_events").insert({
    student_id: studentId,
    card_id: newCard.id,
    school_id: schoolId,
    event_type: "reissued",
    notes: "Kartu NFC baru diterbitkan (re-binding) oleh admin sekolah",
    actor_user_id: user.id,
    actor_role_snapshot: "school_admin",
  });

  await service.from("audit_log").insert({
    school_id: schoolId,
    actor_user_id: user.id,
    actor_role_snapshot: "school_admin",
    action: "CARD_REISSUED",
    entity_type: "student_cards",
    entity_id: newCard.id,
    metadata: { student_id: studentId, new_card_id: newCard.id, uid_last4: last4, timestamp: nowIso },
  });

  return NextResponse.json({
    success: true,
    card: newCard,
    card_status: "active",
  });
}
