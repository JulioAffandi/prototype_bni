import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrResolveParentId } from "@/lib/supabase/parent-resolver";
import { NextResponse } from "next/server";

/**
 * GET /api/v1/parents/me/students
 * Returns the list of students under the authenticated parent for Schema v3.
 * Reference: Schema v3 §4 (guardian_student_map) & §3 (students & student_cards)
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Resolve parent_id with fallback auto-binding
  const parentId = await getOrResolveParentId(user, true);
  if (!parentId) {
    return NextResponse.json({ error: "NO_PARENT_PROFILE", students: [] }, { status: 200 });
  }

  const service = createServiceClient();

  // Fetch students via guardian_student_map
  const { data: mappings, error } = await service
    .from("guardian_student_map")
    .select(`
      student_id,
      relationship,
      is_primary_guardian,
      can_view_activity,
      can_manage_pagu,
      can_fund,
      can_approve_vault,
      can_report_card_lost,
      status,
      students!guardian_student_map_student_id_fkey (
        id,
        full_name,
        student_number,
        class_label,
        daily_limit,
        emergency_approve,
        emergency_limit,
        status,
        school_id,
        schools!students_school_id_fkey ( name ),
        student_cards!student_cards_student_id_fkey ( id, uid_last4, status )
      )
    `)
    .eq("parent_id", parentId);

  if (error) {
    return NextResponse.json({ error: "FETCH_FAILED", detail: error.message }, { status: 500 });
  }

  const activeMappings = (mappings ?? []).filter(
    (m) => !m.status || m.status.toLowerCase() === "active"
  );

  const todayStr = new Date().toISOString().slice(0, 10);

  const formattedStudents = await Promise.all(
    activeMappings.map(async (m) => {
      const st = m.students as unknown as {
        id: string;
        full_name: string;
        student_number: string | null;
        class_label: string | null;
        daily_limit: number;
        emergency_approve: boolean;
        emergency_limit: number;
        status: string;
        school_id: string;
        schools: { name: string } | null;
        student_cards?: Array<{ id: string; uid_last4: string | null; status: string }>;
      } | null;

      if (!st) return null;

      const cards = st.student_cards || [];
      const activeCard = cards.find((c) => c.status === "active") || cards[0];

      // Fetch today's counter for spent_amount
      const { data: counter } = await service
        .from("student_daily_counters")
        .select("spent_amount, overdraft_amount, overdraft_count")
        .eq("student_id", st.id)
        .eq("business_date", todayStr)
        .maybeSingle();

      const spentAmount = counter?.spent_amount ?? 0;

      return {
        id: st.id,
        full_name: st.full_name,
        student_number: st.student_number,
        class_label: st.class_label,
        daily_limit: st.daily_limit,
        daily_limit_used: spentAmount,
        emergency_approve: st.emergency_approve,
        emergency_limit: st.emergency_limit,
        emergency_used_today: (counter?.overdraft_count ?? 0) > 0,
        card_status: activeCard?.status ?? "pending_activation",
        nfc_uid_last4: activeCard?.uid_last4 ?? "????",
        school_id: st.school_id,
        school_name: st.schools?.name ?? "",
        relationship: m.relationship,
        is_primary_guardian: m.is_primary_guardian,
        capabilities: {
          can_view_activity: m.can_view_activity,
          can_manage_pagu: m.can_manage_pagu,
          can_fund: m.can_fund,
          can_approve_vault: m.can_approve_vault,
          can_report_card_lost: m.can_report_card_lost,
        },
      };
    }),
  );

  const cleanList = formattedStudents.filter(Boolean);

  return NextResponse.json({ students: cleanList });
}
