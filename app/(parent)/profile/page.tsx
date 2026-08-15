import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrResolveParentId } from "@/lib/supabase/parent-resolver";
import { redirect } from "next/navigation";
import ParentProfileClient from "@/components/parent/ParentProfileClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profil Saya",
};

export default async function ParentProfilePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parentId = await getOrResolveParentId(user);
  const service = createServiceClient();

  let parentRecord = {
    id: parentId || "",
    full_name: user.user_metadata?.full_name || "Wali Siswa",
    phone_number: user.phone || "",
    email: user.email || null,
    bni_account_number: null as string | null,
    bni_link_status: "UNLINKED",
    telegram_chat_id: null as string | null,
  };

  if (parentId) {
    const { data: p } = await service
      .from("parents")
      .select("id, full_name, phone_number, email, bni_account_number, bni_link_status, telegram_chat_id")
      .eq("id", parentId)
      .maybeSingle();

    if (p) {
      parentRecord = {
        ...p,
        email: p.email || user.email || null,
      };
    }
  }

  // Fetch linked children
  let linkedStudents: Array<{
    id: string;
    full_name: string;
    student_number: string | null;
    school_name: string;
    card_status: string;
    relationship: string;
  }> = [];

  if (parentId) {
    const { data: mappings } = await service
      .from("guardian_student_map")
      .select(`
        relationship,
        students (
          id, full_name, student_number,
          schools ( name ),
          student_cards ( status )
        )
      `)
      .eq("parent_id", parentId)
      .eq("status", "active");

    linkedStudents = (mappings || []).map((m: any) => {
      const st = m.students;
      const cards = st?.student_cards || [];
      const activeCard = cards.find((c: any) => c.status === "active") || cards[0];
      return {
        id: st?.id || "",
        full_name: st?.full_name || "Siswa",
        student_number: st?.student_number || null,
        school_name: st?.schools?.name || "Sekolah",
        card_status: activeCard?.status || "pending_activation",
        relationship: m.relationship || "wali",
      };
    });
  }

  return (
    <ParentProfileClient
      user={{ id: user.id, email: user.email || "", phone: user.phone }}
      parent={parentRecord}
      linkedStudents={linkedStudents}
    />
  );
}
