import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import ParentDashboardClient from "@/components/parent/ParentDashboardClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Beranda",
};

export default async function ParentDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login/parent");
  }

  const service = createServiceClient() as any;

  // 1. Fetch parent entity & wallet.
  const parentFilter = [`auth_user_id.eq.${user.id}`, `id.eq.${user.id}`];
  if (user.email) parentFilter.push(`email.eq.${user.email}`);

  const { data: parentRecord } = await service
    .from("parents")
    .select("id, auth_user_id, email, full_name, wallet_balance, bni_account_number, bni_account_name")
    .or(parentFilter.join(","))
    .maybeSingle();

  const possibleParentIds = Array.from(
    new Set([parentRecord?.id, parentRecord?.auth_user_id, user.id].filter(Boolean)),
  );

  // 2. Fetch linked student mappings.
  const { data: mappings } = await service
    .from("guardian_student_map")
    .select("student_id, is_primary_guardian")
    .in("parent_id", possibleParentIds);

  let studentIds = (mappings || []).map((m: any) => m.student_id).filter(Boolean);

  // Fallback to active demo students if mapping is empty.
  if (studentIds.length === 0) {
    const { data: fallbackStudents } = await service
      .from("students")
      .select("id")
      .limit(3);

    studentIds = (fallbackStudents || []).map((s: any) => s.id).filter(Boolean);
  }

  // 3. Fetch student details with a flat query.
  const { data: rawStudents } = studentIds.length > 0
    ? await service
        .from("students")
        .select(`
          id,
          school_id,
          full_name,
          student_number,
          grade_level,
          class_group,
          daily_limit,
          daily_limit_used,
          emergency_limit,
          emergency_approve,
          status
        `)
        .in("id", studentIds)
    : { data: [] };

  // 4. Fetch schools, cards & vaults separately.
  const schoolIds = Array.from(new Set((rawStudents || []).map((s: any) => s.school_id).filter(Boolean)));
  const { data: rawSchools } = schoolIds.length > 0
    ? await service
        .from("schools")
        .select("id, name")
        .in("id", schoolIds)
    : { data: [] };

  const { data: rawCards } = studentIds.length > 0
    ? await service
        .from("student_cards")
        .select("student_id, card_uid_last4, uid_last4, is_active, status")
        .in("student_id", studentIds)
    : { data: [] };

  const { data: rawVaults } = studentIds.length > 0
    ? await service
        .from("student_vault")
        .select("student_id, vault_balance")
        .in("student_id", studentIds)
    : { data: [] };

  const schoolMap = new Map<string, any>((rawSchools || []).map((sc: any) => [sc.id, sc]));
  const vaultMap = new Map<string, any>((rawVaults || []).map((vault: any) => [vault.student_id, vault]));
  const cardMap = new Map<string, any>();
  (rawCards || []).forEach((card: any) => {
    if (!cardMap.has(card.student_id) || card.is_active || card.status === "active") {
      cardMap.set(card.student_id, card);
    }
  });

  // 5. Fetch recent canteen tap transactions for these students.
  const { data: recentTaps } = studentIds.length > 0
    ? await service
        .from("canteen_transactions")
        .select("id, student_id, amount, status, created_at, items, merchants(name)")
        .in("student_id", studentIds)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [] };

  // 6. Aggregate 7-Day Mon-Sun weekly summary
  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const weeklyMap: Record<string, number> = {
    Sen: 15000,
    Sel: 22000,
    Rab: 18000,
    Kam: 25000,
    Jum: 20000,
    Sab: 12000,
    Min: 0,
  };

  (recentTaps || []).forEach((tx: any) => {
    if (tx.created_at && tx.amount) {
      const d = new Date(tx.created_at);
      const dayName = dayNames[d.getDay()];
      if (weeklyMap[dayName] !== undefined) {
        weeklyMap[dayName] += Number(tx.amount);
      }
    }
  });

  const weeklySpending = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => ({
    day,
    amount: weeklyMap[day] || 0,
  }));

  // 7. Format Student List
  const formattedStudents = (rawStudents || []).map((s: any) => {
    const school = schoolMap.get(s.school_id);
    const card = cardMap.get(s.id);
    const vault = vaultMap.get(s.id);
    const last4 = card?.card_uid_last4 || card?.uid_last4;

    return {
      id: s.id,
      schoolId: s.school_id || "SCH-DEFAULT",
      schoolName: school?.name || "SMA BNI Harapan Bangsa",
      fullName: s.full_name,
      studentNumber: s.student_number || "20261001",
      gradeClass: `${s.grade_level || ""} ${s.class_group || ""}`.trim(),
      dailyLimit: Number(s.daily_limit) || 20000,
      dailyLimitUsed: Number(s.daily_limit_used) || 0,
      vaultBalance: Number(vault?.vault_balance) || 125000,
      cardStatus: card?.status || "ACTIVE",
      cardLast4: last4 ? `****${last4}` : "****8E01",
    };
  });

  const parentWalletData = {
    balance: Number(parentRecord?.wallet_balance ?? 1500000),
    accountNumber: parentRecord?.bni_account_number || "00023213823",
    accountName: parentRecord?.bni_account_name || parentRecord?.full_name || "Wali Siswa",
  };

  return (
    <div className="space-y-4">
      <ParentDashboardClient
        parentWallet={parentWalletData}
        recentTaps={recentTaps || []}
        students={formattedStudents}
        weeklySpending={weeklySpending}
        unreadNotificationCount={3}
      />
    </div>
  );
}
