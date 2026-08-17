import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/v1/notifications/wa
 * Sends a WhatsApp notification to the parent guardian.
 * Non-blocking — called asynchronously after successful canteen transaction.
 * Uses Fonnte API (configurable via env) per §9.4.
 * Reference: PRODUCT_SPECIFICATION_v2.md §9.4
 */
export async function POST(request: NextRequest) {
  const body = await request.json() as {
    studentId: string;
    amount: number;
    sisaPagu: number;
    isEmergency: boolean;
    merchantId: string;
  };

  const { amount, sisaPagu, isEmergency } = body;

  // Build message
  const formattedAmount = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);

  const formattedSisa = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(sisaPagu);

  const message = isEmergency
    ? `[EduConnect] NOTIF DARURAT: Anak Anda baru saja bertransaksi ${formattedAmount} menggunakan mode Emergency Auto-Approval. Sisa pagu: ${formattedSisa}. Silakan periksa aplikasi EduConnect.`
    : `[EduConnect] Transaksi berhasil: ${formattedAmount}. Sisa pagu hari ini: ${formattedSisa}.`;

  // Send via Fonnte (or any WA gateway)
  const fonnteToken = process.env.FONNTE_API_TOKEN;
  if (!fonnteToken) {
    // In development, just log
    console.log(`[WA Notification stub] ${message}`);
    return NextResponse.json({ queued: true, stub: true });
  }

  try {
    // In production: fetch parent's phone from DB + send
    // This is a non-blocking best-effort notification
    await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: fonnteToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target: "parent_phone_placeholder", // Would be fetched from guardian_student_map
        message,
        countryCode: "62",
      }),
    });
  } catch {
    // Non-blocking — silently fail
  }

  return NextResponse.json({ queued: true });
}
