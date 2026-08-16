import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const supabase = createServiceClient();
  const { data: students, error } = await supabase
    .from("students")
    .select("id, full_name, student_number, school_id, status, deleted_at")
    .is("deleted_at", null);

  return NextResponse.json({ total: students?.length ?? 0, students, error });
}
