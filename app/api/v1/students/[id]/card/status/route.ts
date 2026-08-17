import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: studentId } = await params;
  const body = await req.json().catch(() => ({}));
  const { is_locked } = body;

  const service = createServiceClient() as any;
  const newStatus = is_locked ? "BLOCKED" : "ACTIVE";
  const dbStatus = is_locked ? "blocked" : "active";

  // 1. Update status in student_cards
  const { error } = await service
    .from("student_cards")
    .update({
      status: dbStatus,
    })
    .eq("student_id", studentId);

  // If no specific card row updated or error occurred, also ensure students table status if present
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update students table if card_status exists
  try {
    await service
      .from("students")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", studentId);
  } catch {
    // Ignore if not present
  }

  return NextResponse.json({ success: true, status: newStatus });
}
