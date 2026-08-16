import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createServiceSupabase } from "@/lib/supabase/server";
import { getOrResolveParentId } from "@/lib/supabase/parent-resolver";

export type PersonaType = "parent_ai" | "merchant_ai" | "school_treasury_ai";
export type ValoRole =
  | "parent"
  | "merchant_staff"
  | "merchant_owner"
  | "school_admin"
  | "school_treasurer";

export const ROLE_TO_PERSONA: Record<string, PersonaType> = {
  parent: "parent_ai",
  merchant_staff: "merchant_ai",
  merchant_owner: "merchant_ai",
  school_admin: "school_treasury_ai",
  school_treasurer: "school_treasury_ai",
};

export interface ChildRef {
  id: string;
  name: string;
  classLabel: string | null;
  cardStatus: string;
}

export interface AiScope {
  personaType: PersonaType;
  role: ValoRole;
  actorProfileId: string;
  parentId: string | null;
  schoolId: string | null;
  merchantId: string | null;
  children: ChildRef[];
  businessDate: string; // YYYY-MM-DD di Asia/Jakarta
  currentPeriod: string; // YYYY-MM di Asia/Jakarta
}

export class ScopeError extends Error {
  constructor(readonly code: "NO_PROFILE" | "ROLE_UNSUPPORTED" | "SCOPE_INCOMPLETE") {
    super(code);
    this.name = "ScopeError";
  }
}

const DEFAULT_DEMO_SCHOOL_ID = "09c77f03-7f77-4c26-8da4-6ad5462f860c";

function jakartaNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return { businessDate: parts, currentPeriod: parts.slice(0, 7) };
}

export async function resolveAiScope(
  db: any,
  authUser?: User | null,
  requestedPersona?: string,
): Promise<AiScope> {
  const service = createServiceSupabase();

  let user = authUser;
  if (!user) {
    const { data: authData } = await db.auth.getUser();
    user = authData?.user ?? null;
  }

  if (!user) {
    throw new ScopeError("NO_PROFILE");
  }

  // 1. Search existing profile by id = user.id
  let { data: profile } = await service
    .from("profiles")
    .select("id, display_name, parent_id, is_active")
    .eq("id", user.id)
    .maybeSingle();

  // 2. If not found, search profile by email
  if (!profile && user.email) {
    const { data: profileByEmail } = await service
      .from("profiles")
      .select("id, display_name, parent_id, is_active")
      .ilike("display_name", `%${user.email}%`)
      .maybeSingle();
    if (profileByEmail) {
      profile = profileByEmail;
    }
  }

  // 3. Determine active role and target persona
  let role: string | null = null;
  const appRoles = (user.app_metadata?.roles as string[]) || [];

  const reqNorm = (requestedPersona || "").toLowerCase();
  const isSchoolPortal = reqNorm.includes("school");
  const isMerchantPortal = reqNorm.includes("merchant") || reqNorm.includes("pos");
  const isParentPortal = reqNorm.includes("parent");

  if (isSchoolPortal) {
    role = "school_admin";
  } else if (isMerchantPortal) {
    role = "merchant_staff";
  } else if (isParentPortal) {
    role = "parent";
  } else if (appRoles.length > 0) {
    role = appRoles.find((r) => r in ROLE_TO_PERSONA) || appRoles[0];
  }

  if (!role) {
    const { data: userRoleRow } = await service
      .from("user_roles")
      .select("role, school_id, merchant_id")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .maybeSingle();

    if (userRoleRow?.role) {
      role = userRoleRow.role;
    }
  }

  // Default role fallback based on requested persona or parent
  if (!role || !(role in ROLE_TO_PERSONA)) {
    role = isSchoolPortal ? "school_admin" : isMerchantPortal ? "merchant_staff" : "parent";
  }

  const personaType = ROLE_TO_PERSONA[role] || "parent_ai";

  // 4. Resolve entity IDs (schoolId, parentId, merchantId)
  let schoolId: string | null = null;
  let parentId: string | null = profile?.parent_id || null;
  let merchantId: string | null = null;

  if (role === "school_admin" || role === "school_treasurer" || isSchoolPortal) {
    const userSchoolIds = (user.app_metadata?.school_ids as string[]) || [];
    schoolId = userSchoolIds[0] || null;

    if (!schoolId) {
      const { data: rRow } = await service
        .from("user_roles")
        .select("school_id")
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .maybeSingle();
      schoolId = rRow?.school_id || null;
    }

    if (!schoolId) {
      const { data: sRow } = await service
        .from("schools")
        .select("id")
        .limit(1)
        .maybeSingle();
      schoolId = sRow?.id || DEFAULT_DEMO_SCHOOL_ID;
    }

    // Auto-bind active user role for schoolId so Postgres RLS functions succeed
    const { data: roleCheck } = await service
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("school_id", schoolId)
      .is("revoked_at", null)
      .maybeSingle();

    if (!roleCheck) {
      await service.from("user_roles").insert({
        user_id: user.id,
        role: "school_admin",
        school_id: schoolId,
      });
    }
  }

  if (role === "parent" || isParentPortal || !parentId) {
    parentId = await getOrResolveParentId(user, true);
  }

  if (role === "merchant_staff" || role === "merchant_owner" || isMerchantPortal) {
    const userMerchantIds = (user.app_metadata?.merchant_ids as string[]) || [];
    merchantId = userMerchantIds[0] || null;

    if (!merchantId) {
      const { data: mRole } = await service
        .from("user_roles")
        .select("merchant_id")
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .maybeSingle();
      merchantId = mRole?.merchant_id || null;
    }

    if (!merchantId) {
      const { data: mRow } = await service
        .from("merchants")
        .select("id")
        .limit(1)
        .maybeSingle();
      merchantId = mRow?.id || null;
    }
  }

  // 5. Ensure profile row exists in public.profiles
  const displayName = user.user_metadata?.full_name || user.email || "VALO User";
  await service.from("profiles").upsert({
    id: user.id,
    display_name: displayName,
    parent_id: parentId || null,
    is_active: true,
  });

  // 6. Fetch children if persona is parent
  let children: ChildRef[] = [];
  if (parentId) {
    const { data: childMappings } = await service
      .from("guardian_student_map")
      .select("student_id, students!guardian_student_map_student_id_fkey(id, full_name, grade_level, class_group, status)")
      .eq("parent_id", parentId);

    const activeMappings = (childMappings ?? []).filter(
      (m: any) => !m.status || m.status.toLowerCase() === "active",
    );

    children = activeMappings.map((row: any) => {
      const st = row.students;
      const classLabel = st?.grade_level && st?.class_group ? `Kelas ${st.grade_level} ${st.class_group}` : st?.class_group || null;
      return {
        id: st?.id || row.student_id,
        name: st?.full_name || "Siswa",
        classLabel: classLabel,
        cardStatus: st?.status || "active",
      };
    });
  }

  return {
    personaType,
    role: role as ValoRole,
    actorProfileId: user.id,
    parentId,
    schoolId,
    merchantId,
    children,
    ...jakartaNow(),
  };
}
