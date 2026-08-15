import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

/**
 * GET /api/v1/schools/public-list
 * Public directory listing of active schools for parent claim school selector.
 */
export async function GET() {
  const service = createServiceClient();

  const { data: schools, error } = await service
    .from("schools")
    .select("id, name, npsn, address, status")
    .is("deleted_at", null)
    .order("name");

  if (error) {
    return NextResponse.json({ error: "FETCH_FAILED", detail: error.message }, { status: 500 });
  }

  const activeSchools = (schools || []).filter((s) => s.status !== "suspended");

  return NextResponse.json({
    schools: activeSchools.map((s) => ({
      id: s.id,
      name: s.name,
      npsn: s.npsn || null,
      address: s.address || null,
    })),
  });
}
