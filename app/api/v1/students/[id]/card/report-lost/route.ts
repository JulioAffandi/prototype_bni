import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { dispatchAfterResponse } from "@/lib/telegram/after-dispatch";
import { notifyParentCardLostConfirmation } from "@/lib/telegram/notifier";

/**
 * POST /api/v1/students/[id]/card/report-lost
 * Parent reports a lost/stolen NFC card.
 * Updates public.student_cards status to 'lost_reported' and logs lifecycle event.
 * Reference: Schema v3 §3 (student_cards), §13 (card_lifecycle_events)
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: studentId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const parentId = user.app_metadata?.parent_id as string | undefined;

  const service = createServiceClient();
  let resolvedParentId = parentId;

  if (!resolvedParentId) {
    const { data: profile } = await service
      .from("profiles")
      .select("parent_id")
      .eq("id", user.id)
      .maybeSingle();
    resolvedParentId = profile?.parent_id || undefined;
  }

  if (!resolvedParentId) {
    return NextResponse.json({ error: "RLS_FORBIDDEN" }, { status: 403 });
  }

  // Verify guardianship with can_report_card_lost capability
  const { data: guardianship } = await service
    .from("guardian_student_map")
    .select("id, school_id, can_report_card_lost")
    .eq("parent_id", resolvedParentId)
    .eq("student_id", studentId)
    .eq("status", "active")
    .maybeSingle();

  if (!guardianship || !guardianship.can_report_card_lost) {
    return NextResponse.json({ error: "RLS_FORBIDDEN" }, { status: 403 });
  }

  // Find active card in student_cards
  const { data: activeCard } = await service
    .from("student_cards")
    .select("id, school_id")
    .eq("student_id", studentId)
    .in("status", ["active", "pending_activation"])
    .maybeSingle();

  if (!activeCard) {
    return NextResponse.json({ error: "CARD_NOT_FOUND", message: "Tidak ada kartu aktif untuk siswa ini." }, { status: 404 });
  }

  // Block card in student_cards
  const { error: cardUpdateError } = await service
    .from("student_cards")
    .update({ status: "lost_reported" })
    .eq("id", activeCard.id);

  if (cardUpdateError) {
    return NextResponse.json({ error: "UPDATE_FAILED", detail: cardUpdateError.message }, { status: 500 });
  }

  // Record lifecycle event
  await service.from("card_lifecycle_events").insert({
    student_id: studentId,
    card_id: activeCard.id,
    school_id: activeCard.school_id || guardianship.school_id,
    event_type: "lost_reported",
    notes: "Dilaporkan hilang oleh orang tua via Parent App",
    actor_user_id: user.id,
    actor_role_snapshot: "parent",
  });

  await service.from("audit_log").insert({
    school_id: activeCard.school_id || guardianship.school_id,
    actor_user_id: user.id,
    actor_role_snapshot: "parent",
    action: "CARD_LOST_REPORTED",
    entity_type: "student_cards",
    entity_id: activeCard.id,
    metadata: { student_id: studentId, reported_by: "parent", timestamp: new Date().toISOString() },
  });

  dispatchAfterResponse(async () => {
    const { data: student } = await service
      .from("students")
      .select("full_name")
      .eq("id", studentId)
      .maybeSingle();

    const studentName = student?.full_name ?? "Anak";

    const { data: mapRows } = await service
      .from("guardian_student_map")
      .select("parent_id, parents(id, telegram_chat_id)")
      .eq("student_id", studentId)
      .eq("status", "active");

    const jobs: Promise<unknown>[] = [];
    for (const row of mapRows ?? []) {
      const parent = Array.isArray(row.parents) ? row.parents[0] : row.parents;
      if (parent?.telegram_chat_id) {
        jobs.push(
          notifyParentCardLostConfirmation({
            parentChatId: parent.telegram_chat_id,
            parentId: parent.id,
            studentName,
          })
        );
      }
    }
    await Promise.allSettled(jobs);
  }, "card-lost");

  return NextResponse.json({ status: "lost_reported", card_id: activeCard.id });
}
