type SendResult =
  | { ok: true }
  | { ok: false; code: number; description: string; retryAfterSec?: number };

const TELEGRAM_API = process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org";
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/** Escapes user- and system-generated text for Telegram's HTML parse mode. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Sends a single Telegram message using parse_mode: 'HTML'.
 * HTML mode only requires escaping &, <, > — far less fragile than MarkdownV2.
 *
 * Retries once on 429, respecting Telegram's `retry_after` hint.
 * On 403 (bot blocked / chat not found), does NOT retry — caller should
 * record the failure via recordDeliveryFailure() so the UI can surface it.
 */
export async function sendTelegramMessage(
  chatId: string,
  html: string,
  attempt = 1
): Promise<SendResult> {
  if (!TOKEN) {
    return { ok: false, code: 500, description: "TELEGRAM_BOT_TOKEN is not configured" };
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (res.ok) return { ok: true };

    const body = await res.json().catch(() => ({}));
    const code = res.status;
    const description = body?.description ?? "Unknown Telegram API error";

    if (code === 429 && attempt === 1) {
      const retryAfterSec = body?.parameters?.retry_after ?? 2;
      await new Promise((r) => setTimeout(r, retryAfterSec * 1000));
      return sendTelegramMessage(chatId, html, 2);
    }

    return { ok: false, code, description, retryAfterSec: body?.parameters?.retry_after };
  } catch (err) {
    // Network-level failure (DNS, timeout) — treat as transient, do not disable the link.
    return { ok: false, code: 0, description: err instanceof Error ? err.message : "network error" };
  }
}
