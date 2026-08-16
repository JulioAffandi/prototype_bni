// =============================================================
// VALO AI — Parent Family Advisor (Persona C)
// Reference: PRODUCT_SPECIFICATION_v2.md §10.3
// =============================================================

import { tool } from "ai";
import { z } from "zod";

export const PARENT_SYSTEM_PROMPT = `Kamu adalah "VALO Family Advisor", asisten AI ramah untuk orang tua murid.
Tugasmu: merekap pengeluaran jajan anak, memberi gambaran pola nutrisi
(berdasarkan kategori menu yang dibeli, BUKAN diagnosis medis), dan menyarankan
alokasi Tabungan Vault ke produk BNI Reksa Dana/wondr Growth secara opsional.
Batasan penting:
- JANGAN membuat klaim kesehatan/medis. Jika pola makan tampak tidak seimbang,
  sarankan orang tua berdiskusi dengan anak atau, bila perlu, tenaga profesional
  gizi — jangan mendiagnosis.
- Untuk rekomendasi produk investasi, selalu cantumkan bahwa ini bukan nasihat
  keuangan resmi dan hasil investasi tidak dijamin.
- Jaga nada suportif, tidak menghakimi pola belanja anak.`;

/**
 * Tool: get_child_spending_breakdown
 * Returns spending breakdown by food category over a date range.
 */
export const getChildSpendingBreakdownTool = tool({
  description:
    "Mengambil rekap pengeluaran jajan anak per kategori menu dalam rentang waktu tertentu.",
  inputSchema: z.object({
    student_id: z.string().uuid().describe("UUID siswa"),
    date_from: z.string().describe("Tanggal mulai (YYYY-MM-DD)"),
    date_to: z.string().describe("Tanggal selesai (YYYY-MM-DD)"),
  }),
  execute: async ({ student_id, date_from, date_to }) => {
    const res = await fetch(
      `/api/v1/ai/tools/parent/spending?student_id=${student_id}&date_from=${date_from}&date_to=${date_to}`,
      { cache: "no-store" },
    );
    if (!res.ok) return { error: "Gagal mengambil data pengeluaran anak." };
    return res.json() as Promise<unknown>;
  },
});

/**
 * Tool: get_vault_savings_status
 * Returns Student Vault balance + progress toward savings goal.
 */
export const getVaultSavingsStatusTool = tool({
  description:
    "Mengambil saldo Student Vault dan progres terhadap goal tabungan.",
  inputSchema: z.object({
    student_id: z.string().uuid().describe("UUID siswa"),
  }),
  execute: async ({ student_id }) => {
    const res = await fetch(
      `/api/v1/ai/tools/parent/vault-status?student_id=${student_id}`,
      { cache: "no-store" },
    );
    if (!res.ok) return { error: "Gagal mengambil status Vault." };
    return res.json() as Promise<unknown>;
  },
});

/**
 * Tool: simulate_reksadana_allocation
 * Simulates projected value if part of vault is allocated to BNI Reksa Dana / wondr Growth.
 */
export const simulateReksadanaAllocationTool = tool({
  description:
    "Simulasi proyeksi nilai jika saldo vault dialokasikan sebagian ke produk BNI Reksa Dana/wondr Growth.",
  inputSchema: z.object({
    student_id: z.string().uuid().describe("UUID siswa"),
    allocation_amount: z.number().positive().describe("Jumlah yang ingin dialokasikan (Rupiah)"),
  }),
  execute: async ({ student_id, allocation_amount }) => {
    const res = await fetch(
      `/api/v1/ai/tools/parent/reksadana-sim?student_id=${student_id}&amount=${allocation_amount}`,
      { cache: "no-store" },
    );
    if (!res.ok) return { error: "Gagal menjalankan simulasi reksa dana." };
    return res.json() as Promise<unknown>;
  },
});

export const parentAdvisorTools: Record<string, any> = {
  get_child_spending_breakdown: getChildSpendingBreakdownTool,
  get_vault_savings_status: getVaultSavingsStatusTool,
  simulate_reksadana_allocation: simulateReksadanaAllocationTool,
} as const;
