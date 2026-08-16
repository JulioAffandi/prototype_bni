// =============================================================
// VALO AI — Merchant POS Advisor (Persona A)
// Reference: PRODUCT_SPECIFICATION_v2.md §10.1
// Vercel AI SDK tool definitions (OpenAI function calling format)
// =============================================================

import { tool } from "ai";
import { z } from "zod";

/**
 * System prompt for Canteen Merchant AI Advisor.
 * Must be injected as the first message in every chat completion request.
 */
export const MERCHANT_SYSTEM_PROMPT = `Kamu adalah asisten AI untuk pemilik kantin sekolah bernama "VALO Kantin Advisor".
Tugasmu: membantu pemilik kantin memahami performa penjualan, kondisi stok, dan
memberi rekomendasi bahan baku — HANYA berdasarkan data yang dikembalikan oleh
tools yang tersedia. Jangan pernah mengarang angka omzet atau stok.
Jika data tidak tersedia, katakan dengan jujur bahwa data belum ada.
Gunakan Bahasa Indonesia santai namun profesional. Selalu akhiri dengan
satu rekomendasi actionable jika relevan.`;

/**
 * Tool: get_daily_sales_summary
 * Returns canteen revenue + transaction count for a date range.
 */
export const getDailySalesSummaryTool = tool({
  description:
    "Mengambil ringkasan omzet dan jumlah transaksi kantin pada rentang tanggal tertentu.",
  inputSchema: z.object({
    merchant_id: z.string().uuid().describe("UUID merchant kantin"),
    date_from: z.string().describe("Tanggal mulai (YYYY-MM-DD)"),
    date_to: z.string().describe("Tanggal selesai (YYYY-MM-DD)"),
  }),
  execute: async ({ merchant_id, date_from, date_to }) => {
    const res = await fetch(
      `/api/v1/ai/tools/merchant/sales-summary?merchant_id=${merchant_id}&date_from=${date_from}&date_to=${date_to}`,
      { cache: "no-store" },
    );
    if (!res.ok) return { error: "Gagal mengambil data omzet." };
    return res.json() as Promise<unknown>;
  },
});

/**
 * Tool: get_menu_stock_status
 * Returns remaining stock and today's sales per menu item.
 */
export const getMenuStockStatusTool = tool({
  description:
    "Mengambil sisa stok dan riwayat penjualan per item menu hari ini.",
  inputSchema: z.object({
    merchant_id: z.string().uuid().describe("UUID merchant kantin"),
  }),
  execute: async ({ merchant_id }) => {
    const res = await fetch(
      `/api/v1/ai/tools/merchant/stock-status?merchant_id=${merchant_id}`,
      { cache: "no-store" },
    );
    if (!res.ok) return { error: "Gagal mengambil data stok." };
    return res.json() as Promise<unknown>;
  },
});

/**
 * Tool: get_top_selling_items
 * Returns top-selling menu items for restocking recommendations.
 */
export const getTopSellingItemsTool = tool({
  description:
    "Mengambil daftar menu terlaris dalam N hari terakhir untuk rekomendasi restok bahan baku.",
  inputSchema: z.object({
    merchant_id: z.string().uuid().describe("UUID merchant kantin"),
    last_n_days: z.number().int().default(7).describe("Jumlah hari ke belakang (default 7)"),
  }),
  execute: async ({ merchant_id, last_n_days }) => {
    const res = await fetch(
      `/api/v1/ai/tools/merchant/top-selling?merchant_id=${merchant_id}&days=${last_n_days}`,
      { cache: "no-store" },
    );
    if (!res.ok) return { error: "Gagal mengambil data menu terlaris." };
    return res.json() as Promise<unknown>;
  },
});

/** All merchant AI tools bundled for streamText() */
export const merchantTools = {
  get_daily_sales_summary: getDailySalesSummaryTool,
  get_menu_stock_status: getMenuStockStatusTool,
  get_top_selling_items: getTopSellingItemsTool,
} as const;
