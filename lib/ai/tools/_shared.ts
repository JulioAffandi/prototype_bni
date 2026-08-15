import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const rupiah = (n: unknown) => Math.round(Number(n ?? 0));
export const persen = (n: unknown) => Math.round(Number(n ?? 0) * 10) / 10;

export const kosong = (alasan: string) => ({ kosong: true as const, alasan });

export const periodeSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format wajib YYYY-MM")
  .describe("Periode tagihan, format YYYY-MM. Contoh 2026-08.");

export const tanggalSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format wajib YYYY-MM-DD");

export function toolError(e: unknown, konteks: string) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(JSON.stringify({ level: "error", scope: "ai_tool", konteks, msg }));
  return { gagal: true as const, alasan: "Gagal mengambil data. Sampaikan bahwa sistem sedang bermasalah." };
}

export type Db = any;
