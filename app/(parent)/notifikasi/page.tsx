import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import NotificationCenterClient, { NotificationRecord } from "@/components/parent/NotificationCenterClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Pusat Notifikasi",
  description: "Notifikasi Transaksi Kantin, Pagu Harian & Pembayaran SPP EduConnect",
};

export default async function NotificationCenterPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login/parent");
  }

  const service = createServiceClient() as any;

  // 1. Get Parent Record
  const { data: parentRecord } = await service
    .from("parents")
    .select("id, email, full_name")
    .or(`id.eq.${user.id},email.eq.${user.email}`)
    .maybeSingle();

  const possibleParentIds = Array.from(
    new Set([parentRecord?.id, user.id].filter((id): id is string => Boolean(id)))
  );

  // 2. Get Linked Student IDs
  const { data: mappings } = await service
    .from("guardian_student_map")
    .select("student_id, students(full_name)")
    .in("parent_id", possibleParentIds);

  let studentIds = (mappings || []).map((m: any) => m.student_id).filter(Boolean);

  if (studentIds.length === 0) {
    const { data: fallbackStudents } = await service
      .from("students")
      .select("id, full_name")
      .limit(3);
    studentIds = (fallbackStudents || []).map((s: any) => s.id);
  }

  const studentNameMap = new Map<string, string>();
  (mappings || []).forEach((m: any) => {
    if (m.student_id && m.students?.full_name) {
      studentNameMap.set(m.student_id, m.students.full_name);
    }
  });

  // 3. Fetch latest canteen taps
  const { data: recentTaps } = studentIds.length > 0
    ? await service
        .from("canteen_transactions")
        .select("id, student_id, amount, created_at, merchants(name)")
        .in("student_id", studentIds)
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: [] };

  // 4. Fetch pending SPP
  const { data: pendingSPP } = studentIds.length > 0
    ? await service
        .from("spp_invoices")
        .select("id, student_id, period, amount, due_date, institution_fee_categories(label)")
        .in("student_id", studentIds)
        .in("status", ["UNPAID", "OVERDUE", "FAILED"])
        .order("due_date", { ascending: true })
        .limit(3)
    : { data: [] };

  const notifications: NotificationRecord[] = [];

  // Generate Canteen Tap notifications
  (recentTaps || []).forEach((tap: any) => {
    const studentName = studentNameMap.get(tap.student_id) || "Kenzou Tanaka";
    const merchantName = tap.merchants?.name || "Kantin Sekolah";
    notifications.push({
      id: `notif-canteen-${tap.id}`,
      type: "CANTEEN_TAP",
      title: `Transaksi Kantin: ${studentName}`,
      message: `${studentName} baru saja belanja sebesar Rp ${Number(tap.amount).toLocaleString(
        "id-ID"
      )} di ${merchantName}.`,
      actionUrl: "/kartu/riwayat",
      isRead: false,
      createdAt: tap.created_at || new Date().toISOString(),
    });
  });

  // Generate SPP Reminder notifications
  (pendingSPP || []).forEach((spp: any) => {
    const studentName = studentNameMap.get(spp.student_id) || "Kenzou Tanaka";
    notifications.push({
      id: `notif-spp-${spp.id}`,
      type: "SPP_REMINDER",
      title: `Tagihan SPP: ${studentName}`,
      message: `Tagihan ${spp.institution_fee_categories?.label || "SPP Bulanan"} periode ${
        spp.period
      } sebesar Rp ${Number(spp.amount).toLocaleString("id-ID")} jatuh tempo ${spp.due_date}.`,
      actionUrl: "/spp",
      isRead: false,
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    });
  });

  // Demo Fallback items if sparse
  if (notifications.length === 0) {
    notifications.push(
      {
        id: "notif-mock-1",
        type: "TOPUP_SUCCESS",
        title: "Top Up Saldo BNI Berhasil",
        message: "Top up saldo sebesar Rp 200.000 via BNI Virtual Account telah berhasil masuk.",
        actionUrl: "/riwayat",
        isRead: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: "notif-mock-2",
        type: "CANTEEN_TAP",
        title: "Transaksi Kantin: Kenzou Tanaka",
        message: "Kenzou Tanaka baru saja belanja sebesar Rp 18.000 di Kantin Sehat Bu Dewi.",
        actionUrl: "/kartu/riwayat",
        isRead: true,
        createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
      },
      {
        id: "notif-mock-3",
        type: "LIMIT_ALERT",
        title: "Peringatan Pagu Harian",
        message: "Pagu jajan Kenzou Tanaka hari ini tersisa Rp 2.000 (85% terpakai).",
        actionUrl: "/pagu",
        isRead: true,
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      }
    );
  }

  // Sort descending by date
  notifications.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="space-y-4">
      <div className="pt-1 pb-1">
        <h1 className="text-xl font-extrabold text-portal-text tracking-tight">Notifikasi</h1>
        <p className="text-xs text-portal-muted mt-0.5">
          Pemberitahuan real-time transaksi kantin, pagu harian &amp; tagihan SPP
        </p>
      </div>

      <NotificationCenterClient initialNotifications={notifications} />
    </div>
  );
}
