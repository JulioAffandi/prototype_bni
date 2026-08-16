import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export interface PublicSchoolItem {
  id: string;
  name: string;
  npsn: string | null;
  address?: string | null;
  bni_giro_account?: string | null;
  status?: string;
}

const DEFAULT_FALLBACK_SCHOOLS: PublicSchoolItem[] = [
  {
    id: "09c77f03-7f77-4c26-8da4-6ad5462f860c",
    name: "SMA BNI Harapan Bangsa",
    npsn: "20260001",
    address: "Jl. Jend. Sudirman No. 1, Jakarta",
    bni_giro_account: "88800001111",
    status: "active",
  },
];

/**
 * GET /api/v1/schools/public-list
 * Public directory listing of active schools for registration & parent claim dropdowns.
 */
export async function GET() {
  try {
    const service = createServiceClient();

    const { data: schools, error } = await service
      .from("schools")
      .select("id, name, npsn, address, bni_giro_account, status")
      .order("name", { ascending: true });

    if (error) {
      console.error("Supabase query error /schools/public-list:", error.message);
      return NextResponse.json({
        success: true,
        schools: DEFAULT_FALLBACK_SCHOOLS,
        error: error.message,
      }, { status: 200 });
    }

    const activeSchools = (schools || []).filter((s) => s.status !== "suspended");
    const resultSchools = activeSchools.length > 0
      ? activeSchools.map((s) => ({
          id: s.id,
          name: s.name,
          npsn: s.npsn || null,
          address: s.address || null,
          bni_giro_account: s.bni_giro_account || null,
          status: s.status || "active",
        }))
      : DEFAULT_FALLBACK_SCHOOLS;

    return NextResponse.json({
      success: true,
      schools: resultSchools,
    }, { status: 200 });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Terjadi kesalahan internal server";
    console.error("API /schools/public-list failed:", errorMsg);
    return NextResponse.json({
      success: true,
      schools: DEFAULT_FALLBACK_SCHOOLS,
      error: errorMsg,
    }, { status: 200 });
  }
}
