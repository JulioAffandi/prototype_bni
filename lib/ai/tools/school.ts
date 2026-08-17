import "server-only";
import { tool } from "ai";
import { z } from "zod";
import type { AiScope } from "../context";
import { type Db, rupiah, persen, kosong, toolError, periodeSchema } from "./_shared";

export function buildSchoolTools(db: Db, scope: AiScope): Record<string, any> {
  if (!scope.schoolId) return {};

  return {
    getSPPCollectionRate: tool({
      description:
        "Tingkat penagihan SPP satu periode: jumlah invoice, jumlah lunas, tertunggak, " +
        "gagal debit, jatuh tempo, nilai tertagih, dan persentase collection. " +
        "Selalu panggil ini lebih dulu sebelum getUnpaidSPPList.",
      parameters: z.object({
        periode: periodeSchema.optional().describe("Default periode berjalan."),
      }),
      execute: async ({ periode }) => {
        try {
          const p = periode ?? scope.currentPeriod;
          const { data, error } = await db.rpc("rpc_spp_collection_rate", { p_period: p });
          if (error) {
            console.error("⚠️ [getSPPCollectionRate RPC Error]:", error);
            // Fallback querying spp_invoices table directly if RPC fails
            const { data: invoices } = await db
              .from("spp_invoices")
              .select("amount, status")
              .eq("school_id", scope.schoolId!)
              .eq("period", p);

            if (!invoices || invoices.length === 0) {
              return kosong(`Belum ada invoice SPP diterbitkan untuk periode ${p}.`);
            }

            const totalInvoice = invoices.length;
            const lunas = invoices.filter((i: any) => i.status === "PAID").length;
            const belumBayar = invoices.filter((i: any) => i.status === "UNPAID").length;
            const gagalDebit = invoices.filter((i: any) => i.status === "FAILED").length;
            const jatuhTempo = invoices.filter((i: any) => i.status === "OVERDUE").length;
            const nilaiDitagihkan = invoices.reduce((sum: number, i: any) => sum + Number(i.amount || 0), 0);
            const nilaiTertagih = invoices
              .filter((i: any) => i.status === "PAID")
              .reduce((sum: number, i: any) => sum + Number(i.amount || 0), 0);
            const collectionPct = totalInvoice > 0 ? (lunas / totalInvoice) * 100 : 0;

            return {
              periode: p,
              cutOff: `${scope.businessDate} 00:00 WIB`,
              totalInvoice,
              lunas,
              belumBayar,
              gagalDebit,
              jatuhTempo,
              nilaiDitagihkan: rupiah(nilaiDitagihkan),
              nilaiTertagih: rupiah(nilaiTertagih),
              nilaiTertunggak: rupiah(Math.max(0, nilaiDitagihkan - nilaiTertagih)),
              collectionPersen: persen(collectionPct),
            };
          }

          const m = (data as any[])?.[0]; // eslint-disable-line @typescript-eslint/no-explicit-any
          if (!m || Number(m.total_invoice || 0) === 0) {
            return kosong(`Belum ada invoice SPP diterbitkan untuk periode ${p}.`);
          }

          const totalInvoice = Number(m.total_invoice || 0);
          const lunas = Number(m.paid_count || 0);
          const belumBayar = Number(m.unpaid_count || 0);
          const gagalDebit = Number(m.failed_count || 0);
          const jatuhTempo = Number(m.overdue_count || 0);
          const nilaiDitagihkan = Number(m.billed_amount || 0);
          const nilaiTertagih = Number(m.collected_amount || 0);
          const collectionPct = Number(m.collection_pct || 0);

          return {
            periode: p,
            cutOff: `${scope.businessDate} 00:00 WIB`,
            totalInvoice,
            lunas,
            belumBayar,
            gagalDebit,
            jatuhTempo,
            nilaiDitagihkan: rupiah(nilaiDitagihkan),
            nilaiTertagih: rupiah(nilaiTertagih),
            nilaiTertunggak: rupiah(Math.max(0, nilaiDitagihkan - nilaiTertagih)),
            collectionPersen: persen(collectionPct),
          };
        } catch (e) {
          return toolError(e, "getSPPCollectionRate");
        }
      },
    }),

    getUnpaidSPPList: tool({
      description:
        "Daftar siswa dengan SPP tertunggak pada satu periode. Dapat disaring per tingkat " +
        "kelas dan per nama kelas. Untuk keperluan penagihan. Maksimum 40 baris.",
      parameters: z.object({
        periode: periodeSchema.optional(),
        tingkatKelas: z.number().int().min(1).max(13).optional().describe("Contoh 10 untuk kelas 10."),
        namaKelas: z.string().max(16).optional().describe('Contoh "IPA-2". Kosongkan untuk seluruh rombel pada tingkat itu.'),
        jumlahBaris: z.number().int().min(1).max(40).default(20),
      }),
      execute: async ({ periode, tingkatKelas, namaKelas, jumlahBaris }) => {
        try {
          const p = periode ?? scope.currentPeriod;
          let q = db
            .from("spp_invoices")
            .select("period, amount, status, retry_count, due_date, students!spp_invoices_student_id_fkey(full_name, grade_level, class_name)")
            .eq("school_id", scope.schoolId!)
            .eq("period", p)
            .in("status", ["UNPAID", "FAILED", "OVERDUE"])
            .order("due_date", { ascending: true })
            .limit(jumlahBaris);

          if (tingkatKelas != null) q = q.eq("students.grade_level", tingkatKelas);
          if (namaKelas) q = q.eq("students.class_name", namaKelas);

          const { data, error } = await q;
          if (error) throw error;

          const filterLabel = [
            tingkatKelas != null ? `kelas ${tingkatKelas}` : null,
            namaKelas ?? null,
          ].filter(Boolean).join(" ") || "seluruh kelas";

          if (!data?.length) {
            return { kosong: true as const, alasan: `Tidak ada tunggakan SPP periode ${p} untuk ${filterLabel}.` };
          }

          return {
            periode: p,
            filter: filterLabel,
            jumlahBarisDitampilkan: data.length,
            catatanBatas: data.length === jumlahBaris ? "Hasil dipotong pada batas maksimum. Mungkin ada baris lain." : null,
            siswa: (data as any[]).map((r) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
              nama: r.students?.full_name,
              kelas: r.students?.grade_level != null
                ? `${r.students.grade_level}${r.students.class_name ? "-" + r.students.class_name : ""}`
                : null,
              nominal: rupiah(r.amount),
              status: r.status,
              percobaanDebit: r.retry_count,
              jatuhTempo: r.due_date,
            })),
          };
        } catch (e) {
          return toolError(e, "getUnpaidSPPList");
        }
      },
    }),

    getAutoDebitFailureLog: tool({
      description:
        "Ringkasan kegagalan auto-debit SPP pada satu periode, dikelompokkan berdasarkan " +
        "jumlah percobaan retry. Untuk memutuskan eskalasi penagihan manual.",
      parameters: z.object({ periode: periodeSchema.optional() }),
      execute: async ({ periode }) => {
        try {
          const p = periode ?? scope.currentPeriod;
          const { data, error } = await db
            .from("spp_invoices")
            .select("status, retry_count, amount")
            .eq("school_id", scope.schoolId!)
            .eq("period", p)
            .in("status", ["FAILED", "OVERDUE"])
            .limit(1000);

          if (error) throw error;
          if (!data?.length) return { kosong: true as const, alasan: `Tidak ada kegagalan auto-debit pada periode ${p}.` };

          const bucket = new Map<number, { jumlah: number; nilai: number }>();
          for (const r of data) {
            const k = r.retry_count ?? 0;
            const b = bucket.get(k) ?? { jumlah: 0, nilai: 0 };
            b.jumlah += 1;
            b.nilai += rupiah(r.amount);
            bucket.set(k, b);
          }

          return {
            periode: p,
            totalGagal: data.length,
            nilaiTotalGagal: (data as any[]).reduce((a: number, r: any) => a + rupiah(r.amount), 0),
            sudahTigaKaliGagal: (data as any[]).filter((r: any) => (r.retry_count ?? 0) >= 3).length,
            perJumlahRetry: [...bucket.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([retry, v]) => ({ jumlahRetry: retry, jumlahInvoice: v.jumlah, nilai: v.nilai })),
          };
        } catch (e) {
          return toolError(e, "getAutoDebitFailureLog");
        }
      },
    }),

    getEscrowLedgerBalance: tool({
      description:
        "Saldo escrow sekolah pada ledger double-entry internal EduConnect, plus tren saldo Giro " +
        "BNI sekolah 30 hari terakhir. Tidak menerima parameter apa pun, scope terkunci " +
        "pada sekolah pengguna.",
      parameters: z.object({}),
      execute: async () => {
        try {
          const [escrow, giro] = await Promise.all([
            db.rpc("rpc_school_escrow_summary"),
            db
              .from("school_giro_snapshots")
              .select("snapshot_date, giro_balance")
              .eq("school_id", scope.schoolId!)
              .order("snapshot_date", { ascending: false })
              .limit(30),
          ]);

          if (escrow.error) throw escrow.error;
          const e0 = (escrow.data as any[])?.[0]; // eslint-disable-line @typescript-eslint/no-explicit-any
          const snaps = (giro.data ?? []) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any

          if (!e0 || Number(e0.entry_count || 0) === 0) {
            return kosong("Belum ada entri ledger escrow untuk sekolah ini.");
          }

          const saldoGiro = snaps.length ? rupiah(snaps[0].giro_balance) : null;
          const nilai = snaps.map((s) => rupiah(s.giro_balance));
          const saldoTerendah30h = nilai.length ? Math.min(...nilai) : null;

          return {
            cutOff: scope.businessDate,
            escrowSaldoBersih: rupiah(e0.net_balance),
            escrowTotalMasuk: rupiah(e0.total_credit),
            escrowTotalKeluar: rupiah(e0.total_debit),
            jumlahEntriLedger: Number(e0.entry_count),
            entriTerakhir: e0.last_entry_at ? String(e0.last_entry_at).slice(0, 10) : null,
            giroSaldoTerkini: saldoGiro,
            giroTanggalSnapshot: snaps.length ? snaps[0].snapshot_date : null,
            giroSaldoTerendah30Hari: saldoTerendah30h,
            batasAmanPenempatan: saldoTerendah30h != null ? Math.floor(saldoTerendah30h * 0.4) : null,
            catatanBatas:
              "batasAmanPenempatan dihitung dari 40 persen saldo Giro TERENDAH 30 hari, bukan saldo terkini, " +
              "agar rekomendasi tidak melampaui likuiditas operasional pada hari tersibuk.",
          };
        } catch (e) {
          return toolError(e, "getEscrowLedgerBalance");
        }
      },
    }),

    getStudentCardStats: tool({
      description:
        "Statistik enrollment dan provisioning kartu sekolah: total siswa, kartu aktif, " +
        "dilaporkan hilang, diblokir, lulus, pindah, siswa tanpa parental consent aktif, " +
        "dan jumlah kartu diterbitkan 30 hari terakhir.",
      parameters: z.object({}),
      execute: async () => {
        try {
          const { data, error } = await db.rpc("rpc_school_card_stats");
          if (error) throw error;

          const m = (data as any[])?.[0]; // eslint-disable-line @typescript-eslint/no-explicit-any
          if (!m || Number(m.total_students || 0) === 0) {
            return kosong("Belum ada siswa terdaftar pada sekolah ini.");
          }

          return {
            cutOff: scope.businessDate,
            totalSiswa: Number(m.total_students || 0),
            kartuAktif: Number(m.active_cards || 0),
            dilaporkanHilang: Number(m.lost_reported || 0),
            diblokir: Number(m.blocked || 0),
            lulus: Number(m.graduated || 0),
            pindahKeluar: Number(m.transferred_out || 0),
            tanpaConsentAktif: Number(m.consent_pending || 0),
            diterbitkan30Hari: Number(m.issued_last_30d || 0),
            catatanKepatuhan:
              Number(m.consent_pending || 0) > 0
                ? "Ada siswa tanpa parental consent aktif. Sesuai UU PDP, akun mereka seharusnya tidak aktif. Sarankan tindak lanjut ke admin."
                : null,
          };
        } catch (e) {
          return toolError(e, "getStudentCardStats");
        }
      },
    }),

    getMerchantPayoutStatus: tool({
      description:
        "Status payout seluruh kantin di bawah sekolah pada rentang tanggal usaha: " +
        "nilai bersih, status pencairan, dan batch yang gagal. Untuk audit vendor settlement.",
      parameters: z.object({
        hariTerakhir: z.number().int().min(1).max(31).default(7),
      }),
      execute: async ({ hariTerakhir }) => {
        try {
          const { data, error } = await db
            .from("settlement_batches")
            .select("business_date, net_amount, gross_amount, transaction_count, status, failure_reason, merchants!settlement_batches_merchant_id_fkey(name)")
            .eq("school_id", scope.schoolId!)
            .order("business_date", { ascending: false })
            .limit(hariTerakhir * 10);

          if (error) throw error;
          if (!data?.length) return kosong("Belum ada batch settlement kantin tercatat.");

          const rows = data as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
          const gagal = rows.filter((r) => r.status === "FAILED");

          return {
            rentangHari: hariTerakhir,
            jumlahBatch: rows.length,
            totalNilaiBersih: rows.reduce((a, r) => a + rupiah(r.net_amount), 0),
            totalBelumCair: rows.filter((r) => r.status !== "CONFIRMED").reduce((a, r) => a + rupiah(r.net_amount), 0),
            jumlahBatchGagal: gagal.length,
            batchGagal: gagal.slice(0, 10).map((r) => ({
              kantin: r.merchants?.name,
              tanggalUsaha: r.business_date,
              nilaiBersih: rupiah(r.net_amount),
              alasanGagal: r.failure_reason,
            })),
          };
        } catch (e) {
          return toolError(e, "getMerchantPayoutStatus");
        }
      },
    }),
  };
}
