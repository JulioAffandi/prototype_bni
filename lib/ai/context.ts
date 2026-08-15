import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

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

function jakartaNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return { businessDate: parts, currentPeriod: parts.slice(0, 7) };
}

export async function resolveAiScope(db: any): Promise<AiScope> {
  const { data: profile, error } = await db
    .from("profiles")
    .select("id, role, school_id, parent_id, merchant_id")
    .single();

  if (error || !profile) throw new ScopeError("NO_PROFILE");

  let role = profile.role as string;

  if (!role || !(role in ROLE_TO_PERSONA)) {
    const { data: userRole } = await db
      .from("user_roles")
      .select("role, school_id, merchant_id")
      .is("revoked_at", null)
      .maybeSingle();

    if (userRole?.role) {
      role = userRole.role;
    }
  }

  if (!(role in ROLE_TO_PERSONA)) throw new ScopeError("ROLE_UNSUPPORTED");

  const personaType = ROLE_TO_PERSONA[role];

  let schoolId = profile.school_id;
  let merchantId = profile.merchant_id;
  let parentId = profile.parent_id;

  if (!parentId && role === "parent") {
    const { data: parent } = await db
      .from("parents")
      .select("id")
      .maybeSingle();
    if (parent) parentId = parent.id;
  }

  if (!merchantId && (role === "merchant_staff" || role === "merchant_owner")) {
    const { data: merchant } = await db
      .from("merchants")
      .select("id")
      .maybeSingle();
    if (merchant) merchantId = merchant.id;
  }

  if (!schoolId && (role === "school_admin" || role === "school_treasurer")) {
    const { data: school } = await db
      .from("schools")
      .select("id")
      .maybeSingle();
    if (school) schoolId = school.id;
  }

  if (role === "parent" && !parentId) throw new ScopeError("SCOPE_INCOMPLETE");
  if ((role === "merchant_staff" || role === "merchant_owner") && !merchantId)
    throw new ScopeError("SCOPE_INCOMPLETE");
  if ((role === "school_admin" || role === "school_treasurer") && !schoolId)
    throw new ScopeError("SCOPE_INCOMPLETE");

  let children: ChildRef[] = [];
  if (role === "parent" && parentId) {
    const { data } = await db
      .from("guardian_student_map")
      .select("student_id, students!inner(id, full_name, grade_level, class_name, class_label, status)")
      .eq("parent_id", parentId);

    if (data) {
      children = data.map((row: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const st = row.students;
        const classLabel =
          st.grade_level != null
            ? `${st.grade_level}${st.class_name ? "-" + st.class_name : ""}`
            : st.class_label || null;
        return {
          id: st.id,
          name: st.full_name,
          classLabel,
          cardStatus: st.status || "active",
        };
      });
    }
  }

  return {
    personaType,
    role: role as ValoRole,
    actorProfileId: profile.id,
    parentId,
    schoolId,
    merchantId,
    children,
    ...jakartaNow(),
  };
}
