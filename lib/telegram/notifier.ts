import { sendTelegramMessage, escapeHtml } from "./client";
import { recordDeliveryFailure, clearDeliveryFailure } from "./failure-tracker";

async function dispatch(
  entityType: "parent" | "merchant" | "school",
  entityId: string,
  chatId: string,
  html: string
) {
  const result = await sendTelegramMessage(chatId, html);
  if (result.ok) {
    if (entityId) {
      await clearDeliveryFailure(entityType, entityId);
    }
  } else if (result.code === 403) {
    if (entityId) {
      await recordDeliveryFailure(entityType, entityId, chatId, result.code);
    }
  }
  // 429/network errors: log only, do not flag the link as broken.
  return result;
}

// ---- 1. SETTLED canteen tap -> parent ----
export async function notifyParentCanteenTap(params: {
  parentChatId: string;
  parentId: string;
  studentName: string;
  merchantName: string;
  amount: number;
  remainingLimit: number;
}) {
  const html =
    `🍱 <b>Transaksi Kantin Berhasil</b>\n` +
    `Anak: <b>${escapeHtml(params.studentName)}</b>\n` +
    `Kantin: ${escapeHtml(params.merchantName)}\n` +
    `Nominal: <b>Rp${params.amount.toLocaleString("id-ID")}</b>\n` +
    `Sisa pagu hari ini: Rp${params.remainingLimit.toLocaleString("id-ID")}`;
  return dispatch("parent", params.parentId, params.parentChatId, html);
}

// ---- 2. PAGU_EXCEEDED rejection -> parent ----
export async function notifyParentPaguAlert(params: {
  parentChatId: string;
  parentId: string;
  studentName: string;
  attemptedAmount: number;
}) {
  const html =
    `⚠️ <b>Pagu Harian Terlampaui</b>\n` +
    `<b>${escapeHtml(params.studentName)}</b> mencoba transaksi Rp${params.attemptedAmount.toLocaleString("id-ID")} ` +
    `namun ditolak karena pagu harian sudah habis.\n` +
    `Buka aplikasi untuk menyesuaikan pagu atau mengaktifkan mode darurat.`;
  return dispatch("parent", params.parentId, params.parentChatId, html);
}

// ---- 3. SPP payment settled -> parent ----
export async function notifyParentSPPSuccess(params: {
  parentChatId: string;
  parentId: string;
  studentName: string;
  period: string;
  amount: number;
}) {
  const html =
    `✅ <b>Pembayaran SPP Berhasil</b>\n` +
    `Anak: <b>${escapeHtml(params.studentName)}</b>\n` +
    `Periode: ${escapeHtml(params.period)}\n` +
    `Nominal: Rp${params.amount.toLocaleString("id-ID")}`;
  return dispatch("parent", params.parentId, params.parentChatId, html);
}

// ---- 4. Card reported lost -> parent ----
export async function notifyParentCardLostConfirmation(params: {
  parentChatId: string;
  parentId: string;
  studentName: string;
}) {
  const html =
    `🔒 <b>Kartu Diblokir</b>\n` +
    `Kartu <b>${escapeHtml(params.studentName)}</b> telah dilaporkan hilang dan diblokir. ` +
    `Hubungi admin sekolah untuk penerbitan kartu pengganti.`;
  return dispatch("parent", params.parentId, params.parentChatId, html);
}

// ---- 5. SETTLED canteen tap -> merchant ----
export async function notifyMerchantTransaction(params: {
  merchantChatId: string;
  merchantId: string;
  studentName: string;
  amount: number;
}) {
  const html =
    `💰 <b>Transaksi Masuk</b>\n` +
    `Siswa: ${escapeHtml(params.studentName)}\n` +
    `Nominal: <b>Rp${params.amount.toLocaleString("id-ID")}</b>`;
  return dispatch("merchant", params.merchantId, params.merchantChatId, html);
}

// ---- 6. Manual/cron daily summary -> merchant ----
export async function notifyMerchantDailySummary(params: {
  merchantChatId: string;
  merchantId: string;
  date: string;
  totalTransactions: number;
  totalAmount: number;
}) {
  const html =
    `📊 <b>Ringkasan Harian — ${escapeHtml(params.date)}</b>\n` +
    `Jumlah transaksi: ${params.totalTransactions}\n` +
    `Total pendapatan: Rp${params.totalAmount.toLocaleString("id-ID")}`;
  return dispatch("merchant", params.merchantId, params.merchantChatId, html);
}

// ---- 7. SPP batch processed -> school ----
export async function notifySchoolTreasuryBatch(params: {
  schoolChatId: string;
  schoolId: string;
  period: string;
  successCount: number;
  failedCount: number;
  totalAmount: number;
}) {
  const html =
    `🏫 <b>Batch Rekonsiliasi SPP — ${escapeHtml(params.period)}</b>\n` +
    `Berhasil: ${params.successCount} | Gagal: ${params.failedCount}\n` +
    `Total tertagih: Rp${params.totalAmount.toLocaleString("id-ID")}`;
  return dispatch("school", params.schoolId, params.schoolChatId, html);
}

// ---- 8. Test message ----
export async function notifyTestMessage(params: {
  chatId: string;
  entityType: "parent" | "merchant" | "school";
  entityId: string;
}) {
  const html =
    `✅ <b>Koneksi Berhasil</b>\n` +
    `Akun EduConnect Anda kini terhubung dengan Telegram. Notifikasi akan dikirim ke chat ini.`;
  return dispatch(params.entityType, params.entityId, params.chatId, html);
}
