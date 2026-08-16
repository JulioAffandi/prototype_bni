// app/api/v1/schools/[id]/procurement/ocr/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { OcrExtractionResult } from "@/types/institution";

export const dynamic = "force-dynamic";

const ocrSchema = z.object({
  receipt_file_path: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = ocrSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Simulated AI OCR receipt extraction pipeline
  const path = parsed.data.receipt_file_path.toLowerCase();
  let confidence = 0.88;
  let vendor = "Toko Bangunan Jaya";
  let total = 350000;
  let items = ["Material Konstruksi", "Semen PC 40kg"];

  if (path.includes("whatsapp")) {
    confidence = 0.68; // low confidence triggers mandatory HITL review form in UI
    vendor = "Toko Material Abadi (Perlu Review)";
    total = 1250000;
    items = ["Genteng", "Semen", "Ongkos Tukang"];
  } else if (path.includes("nota-02")) {
    confidence = 0.94;
    vendor = "Warung Makan Sederhana";
    total = 850000;
    items = ["Nasi Box Rapat Wali Murid x35", "Air Mineral Dus x2"];
  }

  const result: OcrExtractionResult = {
    vendor_guess: vendor,
    date_guess: new Date().toISOString().slice(0, 10),
    total_guess: total,
    items,
    confidence,
  };

  return NextResponse.json(result);
}
