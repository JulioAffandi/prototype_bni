import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import CardUsageHistoryClient, { CardTapItem } from "@/components/parent/CardUsageHistoryClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Riwayat Pemakaian Kartu NFC",
  description: "Laporan Rinci Jam dan Struk Transaksi Tap Kantin Siswa",
};

export default async function CardUsageHistoryPage() {
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
    .select("student_id, students(id, full_name, student_number)")
    .in("parent_id", possibleParentIds);

  let studentIds = (mappings || []).map((m: any) => m.student_id).filter(Boolean);

  if (studentIds.length === 0) {
    const { data: fallbackStudents } = await service
      .from("students")
      .select("id, full_name, student_number")
      .limit(3);
    studentIds = (fallbackStudents || []).map((s: any) => s.id);
  }

  const studentNameMap = new Map<string, string>();
  const studentsList: Array<{ id: string; fullName: string; studentNumber: string }> = [];

  (mappings || []).forEach((m: any) => {
    if (m.student_id && m.students) {
      studentNameMap.set(m.student_id, m.students.full_name || "Siswa");
      studentsList.push({
        id: m.students.id || m.student_id,
        fullName: m.students.full_name || "Siswa",
        studentNumber: m.students.student_number || "20261001",
      });
    }
  });

  // 3. Fetch detailed Canteen transactions
  const { data: rawTaps } = studentIds.length > 0
    ? await service
        .from("canteen_transactions")
        .select("id, student_id, amount, status, created_at, items, merchants(name)")
        .in("student_id", studentIds)
        .order("created_at", { ascending: false })
        .limit(40)
    : { data: [] };

  const formattedTaps: CardTapItem[] = (rawTaps || []).map((t: any) => ({
    id: t.id,
    studentId: t.student_id,
    studentName: studentNameMap.get(t.student_id) || "Kenzou Tanaka",
    merchantName: t.merchants?.name || "Kantin Sekolah (Tap POS)",
    amount: Number(t.amount) || 0,
    status: (t.status || "SETTLED").toUpperCase(),
    createdAt: t.created_at || new Date().toISOString(),
    items: Array.isArray(t.items) ? t.items : null,
  }));

  // Fallback demo seed if empty
  if (formattedTaps.length === 0) {
    formattedTaps.push(
      {
        id: "tap-mock-1",
        studentId: studentIds[0] || "STU-001",
        studentName: "Kenzou Tanaka",
        merchantName: "Kantin Sehat - Bu Dewi",
        amount: 18000,
        status: "SETTLED",
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        items: [
          { name: "Nasi Ayam Teriyaki", qty: 1, price: 15000 },
          { name: "Teh Kotak Sosro", qty: 1, price: 3000 },
        ],
      },
      {
        id: "tap-mock-2",
        studentId: studentIds[0] || "STU-001",
        studentName: "Kenzou Tanaka",
        merchantName: "Koperasi Siswa Mandiri",
        amount: 8000,
        status: "SETTLED",
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        items: [{ name: "Buku Tulis Sidu 38 Lembar", qty: 2, price: 8000 }],
      },
      {
        id: "tap-mock-3",
        studentId: studentIds[0] || "STU-001",
        studentName: "Kenzou Tanaka",
        merchantName: "Kantin Bu Dewi",
        amount: 12000,
        status: "SETTLED",
        createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
        items: [{ name: "Roti Bakar Coklat Keju", qty: 1, price: 12000 }],
      }
    );
  }

  return (
    <div className="space-y-4">
      <div className="pt-1 pb-1">
        <h1 className="text-xl font-extrabold text-portal-text tracking-tight">Riwayat Kartu NFC</h1>
        <p className="text-xs text-portal-muted mt-0.5">
          Pantau frekuensi tap fisik, jam belanja &amp; rincian menu makanan anak di kantin
        </p>
      </div>

      <CardUsageHistoryClient
        initialTaps={formattedTaps}
        students={
          studentsList.length > 0
            ? studentsList
            : [{ id: "STU-001", fullName: "Kenzou Tanaka", studentNumber: "20261001" }]
        }
      />
    </div>
  );
}
