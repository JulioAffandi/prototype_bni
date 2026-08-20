import "server-only";

/**
 * Mendapatkan seluruh daftar API key Gemini yang dikonfigurasi pada environment variables.
 * Mendukung pemisahan koma (comma-separated keys) serta variabel tambahan (seperti GEMINI_API_KEY_1, GEMINI_API_KEY_2, dst).
 */
export function getGeminiApiKeys(): string[] {
  const keysSet = new Set<string>();

  // 1. Periksa variabel utama (mendukung pemisahan koma)
  const primaryVars = [
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    process.env.GEMINI_API_KEY
  ];
  for (const val of primaryVars) {
    if (val) {
      val.split(',').map(k => k.trim()).forEach(k => {
        const clean = k.replace(/^["']|["']$/g, "").trim();
        if (clean && !clean.includes("your-api-key")) {
          keysSet.add(clean);
        }
      });
    }
  }

  // 2. Periksa variabel bernomor/kustom (seperti GEMINI_API_KEY_1, GEMINI_API_KEY_2, dst)
  for (const key of Object.keys(process.env)) {
    if (
      key.startsWith("GEMINI_API_KEY_") || 
      key.startsWith("GOOGLE_GENERATIVE_AI_API_KEY_")
    ) {
      const val = process.env[key];
      if (val) {
        val.split(',').map(k => k.trim()).forEach(k => {
          const clean = k.replace(/^["']|["']$/g, "").trim();
          if (clean && !clean.includes("your-api-key")) {
            keysSet.add(clean);
          }
        });
      }
    }
  }

  return Array.from(keysSet);
}

/**
 * Memilih satu API key Gemini secara acak (random rotation) dari daftar key yang aktif
 * guna mendistribusikan beban limit kuota pada model gratis secara merata.
 */
export function getRotatedGeminiApiKey(): string {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) return "";
  const randomIndex = Math.floor(Math.random() * keys.length);
  return keys[randomIndex];
}

/**
 * Custom fetch wrapper yang melakukan failover otomatis ke API key lain jika
 * API key saat ini terkena rate limit (HTTP 429) atau error jaringan.
 */
export async function fetchWithFailover(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) {
    return fetch(input, init);
  }

  // Pilih satu index acak sebagai titik awal
  let currentKeyIndex = Math.floor(Math.random() * keys.length);
  let attempts = 0;
  const maxAttempts = keys.length;

  while (attempts < maxAttempts) {
    const activeKey = keys[currentKeyIndex];
    attempts++;

    // Dapatkan URL asal
    let targetUrl: string;
    if (typeof input === "string") {
      targetUrl = input;
    } else if (input instanceof URL) {
      targetUrl = input.toString();
    } else {
      targetUrl = input.url;
    }

    // Ubah URL jika memuat query parameter ?key=... atau &key=...
    if (targetUrl.includes("key=")) {
      targetUrl = targetUrl.replace(/([?&])key=[^&]*/, `$1key=${activeKey}`);
    }

    // Salin header untuk diperbarui
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set("x-goog-api-key", activeKey);

    // Siapkan options request baru
    let currentOptions: RequestInit;
    if (input instanceof Request) {
      currentOptions = {
        method: input.method,
        body: input.body,
        credentials: input.credentials,
        headers,
      };
    } else {
      currentOptions = {
        ...init,
        headers,
      };
    }

    try {
      console.log(`🌐 [AI Key Failover] Percobaan ${attempts}/${maxAttempts} menggunakan key index ke-${currentKeyIndex}`);
      const res = await fetch(targetUrl, currentOptions);

      // Jika terkena hit limit (status 429)
      if (res.status === 429) {
        console.warn(`⚠️ [AI Key Failover] API Key ke-${currentKeyIndex} terkena rate limit (429). Mencoba key berikutnya...`);
        currentKeyIndex = (currentKeyIndex + 1) % keys.length;
        continue;
      }

      // Jika sukses atau terjadi error selain rate-limit, kembalikan respons
      return res;
    } catch (err) {
      console.error(`❌ [AI Key Failover] Error jaringan pada key index ke-${currentKeyIndex}:`, err);
      if (attempts < maxAttempts) {
        currentKeyIndex = (currentKeyIndex + 1) % keys.length;
        continue;
      }
      throw err;
    }
  }

  throw new Error("Semua API key Gemini telah mencapai batas kuota pemakaian (Rate Limit 429).");
}

