import "server-only";
import { tool } from "ai";
import { z } from "zod";
import type { AiScope } from "../context";
import { type Db, rupiah, persen, kosong, toolError, tanggalSchema } from "./_shared";

export function buildMerchantTools(db: Db, scope: AiScope): Record<string, any> {
  if (!scope.merchantId) return {};

  return {
    getTodaySalesMetrics: tool({
      description:
        "Metrik penjualan kantin untuk satu hari kerja: omzet kotor, jumlah transaksi, " +
        "rata-rata nilai transaksi, jam paling ramai, jumlah transaksi emergency, " +
        "jumlah transaksi ditolak, dan estimasi harga pokok bila data biaya tersedia. " +
        "Default hari ini.",
      parameters: z.object({
        tanggal: tanggalSchema.optional().describe("Opsional, YYYY-MM-DD. Default hari ini."),
      }),
      execute: async ({ tanggal }) => {
        try {
          const d = tanggal ?? scope.businessDate;
          const { data, error } = await db.rpc("rpc_merchant_daily_metrics", { p_business_date: d });
          if (error) throw error;

          const m = (data as any[])?.[0]; // eslint-disable-line @typescript-eslint/no-explicit-any
          if (!m || Number(m.transaction_count) === 0) {
            return kosong(`Belum ada transaksi tercatat pada ${d}.`);
          }

          const omzet = rupiah(m.gross_revenue);
          const hpp = rupiah(m.estimated_cogs);
          const cakupan = persen(m.cogs_coverage_pct);

          return {
            tanggal: d,
            omzetKotor: omzet,
            jumlahTransaksi: Number(m.transaction_count),
            rataRataTransaksi: rupiah(m.avg_ticket),
            jamPalingRamai: m.peak_hour != null ? `${String(m.peak_hour).padStart(2, "0")}:00` : null,
            transaksiJamRamai: Number(m.peak_hour_count ?? 0),
            transaksiEmergency: Number(m.emergency_count),
            transaksiDitolak: Number(m.rejected_count),
            estimasiHargaPokok: cakupan > 0 ? hpp : null,
            estimasiLabaKotor: cakupan > 0 ? omzet - hpp : null,
            cakupanDataBiayaPersen: cakupan,
            catatanAkurasi:
              cakupan >= 100
                ? null
                : `Hanya ${cakupan} persen item punya data harga pokok. Sebutkan bahwa angka laba adalah estimasi parsial.`,
          };
        } catch (e) {
          return toolError(e, "getTodaySalesMetrics");
        }
      },
    }),

    getTopSellingItems: tool({
      description:
        "Menu terlaris berdasarkan kuantitas terjual dalam N hari terakhir, beserta omzet " +
        "per menu dan sisa stok saat ini. Untuk rekomendasi restok bahan baku.",
      parameters: z.object({
        hariTerakhir: z.number().int().min(1).max(90).default(7),
        jumlahBaris: z.number().int().min(1).max(15).default(8),
      }),
      execute: async ({ hariTerakhir, jumlahBaris }) => {
        try {
          const { data, error } = await db.rpc("rpc_merchant_top_items", {
            p_days: hariTerakhir,
            p_limit: jumlahBaris,
          });
          if (error) throw error;
          if (!data?.length) return kosong(`Belum ada penjualan tercatat dalam ${hariTerakhir} hari terakhir.`);

          return {
            rentangHari: hariTerakhir,
            menu: (data as any[]).map((r) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
              nama: r.item_name,
              kategori: r.category,
              porsiTerjual: Number(r.qty_sold),
              omzet: rupiah(r.revenue),
              sisaStok: r.stock_left == null ? null : Number(r.stock_left),
            })),
          };
        } catch (e) {
          return toolError(e, "getTopSellingItems");
        }
      },
    }),

    getMenuStockStatus: tool({
      description:
        "Sisa stok seluruh menu aktif. Gunakan ambangStokMenipis untuk menyaring hanya " +
        "menu yang perlu segera direstok.",
      parameters: z.object({
        ambangStokMenipis: z.number().int().min(0).max(100).default(5),
        hanyaYangMenipis: z.boolean().default(true),
      }),
      execute: async ({ ambangStokMenipis, hanyaYangMenipis }) => {
        try {
          let q = db
            .from("menu_items")
            .select("name, category, stock_qty, unit_price")
            .eq("merchant_id", scope.merchantId!)
            .eq("is_active", true)
            .order("stock_qty", { ascending: true })
            .limit(40);

          if (hanyaYangMenipis) q = q.lte("stock_qty", ambangStokMenipis);

          const { data, error } = await q;
          if (error) throw error;
          if (!data?.length) {
            return hanyaYangMenipis
              ? { kosong: true as const, alasan: `Tidak ada menu dengan stok di bawah atau sama dengan ${ambangStokMenipis}. Stok aman.` }
              : kosong("Katalog menu masih kosong. Minta pengguna mengisi katalog di menu Pengaturan Kantin.");
          }

          return {
            ambang: ambangStokMenipis,
            menu: (data as any[]).map((r: any) => ({
              nama: r.name,
              kategori: r.category,
              sisaStok: r.stock_qty,
              harga: rupiah(r.unit_price),
            })),
          };
        } catch (e) {
          return toolError(e, "getMenuStockStatus");
        }
      },
    }),

    getSettlementStatus: tool({
      description:
        "Status settlement H+0 ke rekening merchant BNI untuk beberapa hari terakhir: " +
        "nilai kotor, potongan platform, nilai bersih, status pencairan, dan waktu cair. " +
        'Gunakan untuk pertanyaan "uang saya kapan cair" atau "berapa yang belum cair".',
      parameters: z.object({
        hariTerakhir: z.number().int().min(1).max(31).default(7),
      }),
      execute: async ({ hariTerakhir }) => {
        try {
          const { data, error } = await db
            .from("settlement_batches")
            .select("business_date, gross_amount, platform_fee, net_amount, transaction_count, status, disbursed_at, scheduled_disburse_at, failure_reason")
            .eq("merchant_id", scope.merchantId!)
            .order("business_date", { ascending: false })
            .limit(hariTerakhir);

          if (error) throw error;
          if (!data?.length) return kosong("Belum ada batch settlement tercatat.");

          const belumCair = (data as any[]).filter((r: any) => r.status !== "CONFIRMED");
          return {
            totalBelumCair: belumCair.reduce((a: number, r: any) => a + rupiah(r.net_amount), 0),
            jumlahBatchBelumCair: belumCair.length,
            batch: (data as any[]).map((r: any) => ({
              tanggalUsaha: r.business_date,
              nilaiKotor: rupiah(r.gross_amount),
              potonganPlatform: rupiah(r.platform_fee),
              nilaiBersih: rupiah(r.net_amount),
              jumlahTransaksi: r.transaction_count,
              status: r.status,
              jadwalCair: r.scheduled_disburse_at,
              waktuCair: r.disbursed_at,
              alasanGagal: r.failure_reason,
            })),
          };
        } catch (e) {
          return toolError(e, "getSettlementStatus");
        }
      },
    }),

    getRecentTapAnomalies: tool({
      description:
        "Diagnosis masalah tap dalam N jam terakhir: jumlah transaksi ditolak karena pagu " +
        "habis, ditolak karena kartu diblokir, masih tertahan di antrean offline, dan " +
        "ditolak saat rekonsiliasi. Data bersifat AGREGAT dan ANONIM, tidak memuat identitas siswa.",
      parameters: z.object({
        jamTerakhir: z.number().int().min(1).max(72).default(8),
      }),
      execute: async ({ jamTerakhir }) => {
        try {
          const sejak = new Date(Date.now() - jamTerakhir * 3_600_000).toISOString();

          const [tx, antrean] = await Promise.all([
            db
              .from("canteen_transactions")
              .select("status, is_emergency")
              .eq("merchant_id", scope.merchantId!)
              .gte("created_at", sejak)
              .limit(2000),
            db
              .from("offline_sync_queue")
              .select("sync_status")
              .eq("merchant_id", scope.merchantId!)
              .gte("created_at", sejak)
              .limit(2000),
          ]);

          if (tx.error) throw tx.error;
          if (antrean.error) throw antrean.error;

          const rows = (tx.data ?? []) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
          const hitung = (s: string) => rows.filter((r) => r.status === s).length;
          const q = (antrean.data ?? []) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any

          const total = rows.length;
          const ditolakPagu = hitung("REJECTED_OVERLIMIT");
          const ditolakPascaSync = hitung("REJECTED_POST_HOC");
          const tertahan = hitung("OFFLINE_QUEUED") + hitung("PENDING_SYNC");

          if (total === 0 && q.length === 0) {
            return kosong(`Tidak ada aktivitas tap dalam ${jamTerakhir} jam terakhir.`);
          }

          return {
            jendelaJam: jamTerakhir,
            totalTap: total,
            berhasil: hitung("SETTLED") + hitung("SETTLED_OVERDRAFT") + hitung("COMPLETED"),
            ditolakPaguHabis: ditolakPagu,
            ditolakSaatRekonsiliasi: ditolakPascaSync,
            tertahanDiAntreanOffline: tertahan,
            antreanSyncPending: q.filter((r) => r.sync_status === "PENDING").length,
            antreanSyncKonflik: q.filter((r) => r.sync_status === "CONFLICT").length,
            rasioDitolakPersen: total > 0 ? persen(((ditolakPagu + ditolakPascaSync) / total) * 100) : 0,
            indikasiJaringanBermasalah: total > 0 && tertahan / total > 0.15,
          };
        } catch (e) {
          return toolError(e, "getRecentTapAnomalies");
        }
      },
    }),
  };
}
