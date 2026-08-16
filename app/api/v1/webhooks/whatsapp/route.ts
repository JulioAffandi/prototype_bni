// app/api/v1/webhooks/whatsapp/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import type { OcrExtractionResult } from "@/types/institution";

export const dynamic = "force-dynamic";

const whatsappWebhookSchema = z.object({
  sender_phone: z.string().min(8),
  sender_name: z.string().optional(),
  receipt_image_url: z.string().min(1),
  school_id: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = whatsappWebhookSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_PAYLOAD", detail: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  const { sender_phone, sender_name, receipt_image_url, school_id } = parsed.data;

  // 1. Resolve school ID if not provided directly
  let targetSchoolId = school_id;
  if (!targetSchoolId) {
    const { data: firstSchool } = await service.from("schools").select("id").limit(1).single();
    if (!firstSchool) {
      return NextResponse.json({ error: "SCHOOL_NOT_FOUND" }, { status: 404 });
    }
    targetSchoolId = firstSchool.id;
  }

  // 2. Perform simulated OCR receipt extraction
  const ocrResult: OcrExtractionResult = {
    vendor_guess: "Toko Bangunan Jaya",
    date_guess: new Date().toISOString().slice(0, 10),
    total_guess: 1250000,
    items: ["Genteng", "Semen", "Ongkos Tukang"],
    confidence: 0.68, // Low confidence requires Human-in-the-Loop review
  };

  // 3. Insert reimbursement into institution_procurement with claimed_by_phone
  const { data: inserted, error: insertErr } = await (service as any)
    .from("institution_procurement")
    .insert({
      school_id: targetSchoolId,
      type: "REIMBURSEMENT",
      claimed_by_name: sender_name ?? "Staf WhatsApp",
      claimed_by_phone: sender_phone,
      vendor_name: ocrResult.vendor_guess,
      category: "Perawatan Gedung",
      description: `Ingested via WhatsApp Webhook (${sender_phone})`,
      amount: ocrResult.total_guess,
      status: "SUBMITTED",
      receipt_file_path: receipt_image_url,
      ocr_raw_json: ocrResult as any,
      ocr_confidence: ocrResult.confidence,
    })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json(
      { error: "WEBHOOK_INSERT_FAILED", detail: insertErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      message: "WhatsApp receipt ingested successfully",
      procurement_id: inserted.id,
      ocr_summary: ocrResult,
      hitl_review_required: ocrResult.confidence < 0.75,
    },
    { status: 201 }
  );
}
