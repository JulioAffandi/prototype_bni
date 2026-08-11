// =============================================================
// VALO AI — School B2B Treasury Advisor (Persona B)
// Reference: PRODUCT_SPECIFICATION_v2.md §10.2
// =============================================================

import type { CoreTool } from "ai";
import { z } from "zod";

export const SCHOOL_SYSTEM_PROMPT = `Kamu adalah "VALO Treasury Advisor", asisten AI untuk bendahara sekolah.
Fokusmu: analisis cashflow, tingkat tunggakan SPP, dan rekomendasi optimalisasi
dana mengendap di rekening Giro BNI sekolah (mis. ke produk Deposito BNI).
Selalu sebutkan sumber angka (jumlah invoice, tanggal cut-off) agar bendahara
bisa memverifikasi. JANGAN memberi saran investasi di luar produk BNI resmi.
Untuk rekomendasi penempatan dana, batasi maksimal 40% dari saldo mengendap
sebagai margin keamanan likuiditas operasional.`;

/**
 * Tool: get_spp_collection_rate
 * Returns percentage of paid vs overdue SPP for a given period.
 */
export const getSPPCollectionRateTool: CoreTool = {
  description:
    "Menghitung persentase SPP lunas vs tertunggak untuk periode tertentu.",
  parameters: z.object({
    school_id: z.string().uuid().describe("UUID sekolah"),
    period: z.string().describe("Format YYYY-MM, contoh: 2026-08"),
  }),
  execute: async ({ school_id, period }) => {
    const res = await fetch(
      `/api/v1/ai/tools/school/spp-rate?school_id=${school_id}&period=${period}`,
      { cache: "no-store" },
    );
    if (!res.ok) return { error: "Gagal mengambil data tingkat pembayaran SPP." };
    return res.json() as Promise<unknown>;
  },
};

/**
 * Tool: get_giro_balance_trend
 * Returns 30-day balance trend for the school's BNI Giro account.
 */
export const getGiroBalanceTrendTool: CoreTool = {
  description:
    "Mengambil tren saldo mengendap di rekening Giro BNI sekolah 30 hari terakhir.",
  parameters: z.object({
    school_id: z.string().uuid().describe("UUID sekolah"),
  }),
  execute: async ({ school_id }) => {
    const res = await fetch(
      `/api/v1/ai/tools/school/giro-trend?school_id=${school_id}`,
      { cache: "no-store" },
    );
    if (!res.ok) return { error: "Gagal mengambil tren saldo Giro." };
    return res.json() as Promise<unknown>;
  },
};

/**
 * Tool: simulate_deposito_allocation
 * Simulates yield if a portion of idle funds is placed in BNI Deposito.
 */
export const simulateDepositoAllocationTool: CoreTool = {
  description:
    "Simulasi hasil yield jika sejumlah dana dialokasikan ke BNI Deposito jangka pendek.",
  parameters: z.object({
    school_id: z.string().uuid().describe("UUID sekolah"),
    amount: z.number().positive().describe("Jumlah dana yang ingin dialokasikan (Rupiah)"),
    tenor_months: z
      .number()
      .int()
      .refine((v) => [1, 3, 6, 12].includes(v), {
        message: "Tenor harus 1, 3, 6, atau 12 bulan",
      })
      .describe("Jangka waktu deposito dalam bulan: 1, 3, 6, atau 12"),
  }),
  execute: async ({ school_id, amount, tenor_months }) => {
    const res = await fetch(
      `/api/v1/ai/tools/school/deposito-sim?school_id=${school_id}&amount=${amount}&tenor=${tenor_months}`,
      { cache: "no-store" },
    );
    if (!res.ok) return { error: "Gagal menjalankan simulasi deposito." };
    return res.json() as Promise<unknown>;
  },
};

export const schoolTreasuryTools = {
  get_spp_collection_rate: getSPPCollectionRateTool,
  get_giro_balance_trend: getGiroBalanceTrendTool,
  simulate_deposito_allocation: simulateDepositoAllocationTool,
} as const;
