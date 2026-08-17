import "server-only";
import { tool } from "ai";
import { z } from "zod";
import type { AiScope } from "../context";
import { type Db, rupiah, persen, kosong, toolError, tanggalSchema } from "./_shared";

export function buildParentTools(db: Db, scope: AiScope): Record<string, any> {
  const ids = scope.children.map((c) => c.id);
  if (ids.length === 0) return {};

  const namaById = new Map(scope.children.map((c) => [c.id, c.name]));
  const childId = z
    .enum(ids as [string, ...string[]])
    .describe("Identitas anak. Wajib salah satu nilai enum yang tersedia. Cocokkan dengan urutan nama pada KONTEKS SESI.");

  return {
    getPaguStatusToday: tool({
      description:
        "Status pagu jajan HARI INI untuk satu anak: limit harian, sudah terpakai, sisa, " +
        "status toggle emergency, dan apakah jatah overdraft harian sudah dipakai. " +
        'Gunakan untuk pertanyaan "berapa sisa pagu <nama> hari ini".',
      parameters: z.object({ childId }),
      execute: async ({ childId: sid }) => {
        try {
          const { data, error } = await db
            .from("students")
            .select("daily_limit, daily_limit_used, daily_limit_reset_at, emergency_approve, emergency_limit, emergency_used_today, status")
            .eq("id", sid)
            .maybeSingle();

          if (error) throw error;
          if (!data) return kosong("Data siswa tidak dapat diakses dari akun ini.");

          const basi = data.daily_limit_reset_at ? data.daily_limit_reset_at < scope.businessDate : false;

          return {
            nama: namaById.get(sid),
            limitHarian: rupiah(data.daily_limit),
            sudahTerpakai: basi ? 0 : rupiah(data.daily_limit_used),
            sisaPagu: basi
              ? rupiah(data.daily_limit)
              : Math.max(0, rupiah(data.daily_limit) - rupiah(data.daily_limit_used)),
            emergencyAktif: data.emergency_approve,
            emergencyLimit: rupiah(data.emergency_limit),
            emergencyTerpakaiHariIni: data.emergency_used_today,
            statusKartu: data.status,
            dataMungkinBasi: basi,
          };
        } catch (e) {
          return toolError(e, "getPaguStatusToday");
        }
      },
    }),

    getChildSpendingSummary: tool({
      description:
        "Rekap belanja kantin satu anak pada rentang tanggal, dipecah per kategori menu " +
        "(gorengan, minuman manis, makanan berat, dan seterusnya) beserta persentasenya. " +
        "Rentang maksimum 92 hari.",
      parameters: z.object({
        childId,
        dariTanggal: tanggalSchema.describe("Tanggal awal inklusif, YYYY-MM-DD."),
        sampaiTanggal: tanggalSchema.describe("Tanggal akhir inklusif, YYYY-MM-DD."),
      }),
      execute: async ({ childId: sid, dariTanggal, sampaiTanggal }) => {
        try {
          const rentang =
            (Date.parse(sampaiTanggal) - Date.parse(dariTanggal)) / 86_400_000;
          if (rentang < 0) return kosong("Tanggal awal melewati tanggal akhir.");
          if (rentang > 92) return kosong("Rentang melebihi 92 hari. Minta pengguna mempersempit rentang.");

          const { data, error } = await db.rpc("rpc_child_spending_by_category", {
            p_student_id: sid,
            p_from: dariTanggal,
            p_to: sampaiTanggal,
          });
          if (error) throw error;
          if (!data?.length) return kosong("Belum ada transaksi kantin pada rentang tanggal tersebut.");

          const rows = data as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
          return {
            nama: namaById.get(sid),
            periode: `${dariTanggal} sampai ${sampaiTanggal}`,
            totalBelanja: rows.reduce((a, r) => a + rupiah(r.total_amount), 0),
            perKategori: rows.map((r) => ({
              kategori: r.category,
              total: rupiah(r.total_amount),
              jumlahItem: Number(r.item_count),
              persen: persen(r.pct_of_total),
            })),
          };
        } catch (e) {
          return toolError(e, "getChildSpendingSummary");
        }
      },
    }),

    getVaultProgress: tool({
      description:
        "Saldo Student Goal Vault satu anak, nama target tabungan, nilai target, " +
        "persentase progres, dan kekurangan menuju target.",
      parameters: z.object({ childId }),
      execute: async ({ childId: sid }) => {
        try {
          const { data, error } = await db
            .from("student_vault")
            .select("vault_balance, savings_goal_name, savings_goal_target, updated_at")
            .eq("student_id", sid)
            .maybeSingle();

          if (error) throw error;
          if (!data) return kosong("Vault untuk anak ini belum diinisialisasi.");

          const saldo = rupiah(data.vault_balance);
          const target = rupiah(data.savings_goal_target);
          return {
            nama: namaById.get(sid),
            saldoVault: saldo,
            namaTarget: data.savings_goal_name,
            nilaiTarget: target,
            progresPersen: target > 0 ? persen((saldo / target) * 100) : null,
            kekurangan: target > 0 ? Math.max(0, target - saldo) : null,
            terakhirDiperbarui: String(data.updated_at).slice(0, 10),
          };
        } catch (e) {
          return toolError(e, "getVaultProgress");
        }
      },
    }),

    getPendingSPP: tool({
      description:
        "Daftar tagihan SPP yang BELUM lunas untuk anak-anak pengguna, mencakup status " +
        "UNPAID, FAILED, dan OVERDUE, beserta jumlah percobaan auto-debit dan jatuh tempo. " +
        "Kosongkan childId untuk melihat seluruh anak.",
      parameters: z.object({
        childId: childId.optional().describe("Opsional. Kosongkan untuk seluruh anak."),
      }),
      execute: async ({ childId: sid }) => {
        try {
          let q = db
            .from("spp_invoices")
            .select("student_id, period, amount, status, retry_count, due_date")
            .in("status", ["UNPAID", "FAILED", "OVERDUE"])
            .order("due_date", { ascending: true })
            .limit(24);

          if (sid) q = q.eq("student_id", sid);
          else q = q.in("student_id", ids);

          const { data, error } = await q;
          if (error) throw error;
          if (!data?.length)
            return { kosong: true as const, alasan: "Tidak ada tagihan SPP tertunggak. Seluruh tagihan sudah lunas." };

          return {
            jumlahTagihan: data.length,
            totalTertunggak: (data as any[]).reduce((a: number, r: any) => a + rupiah(r.amount), 0),
            tagihan: (data as any[]).map((r: any) => ({
              nama: namaById.get(r.student_id),
              periode: r.period,
              nominal: rupiah(r.amount),
              status: r.status,
              percobaanDebit: r.retry_count,
              jatuhTempo: r.due_date,
            })),
          };
        } catch (e) {
          return toolError(e, "getPendingSPP");
        }
      },
    }),
  };
}
