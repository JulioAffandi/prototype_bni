import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ShieldCheck, Flag, AlertTriangle, CheckCircle2 } from "lucide-react";
import SchoolAuditTabs from "@/components/school/SchoolAuditTabs";

export const metadata: Metadata = { title: "Audit & Kepatuhan" };

export default async function SchoolAuditPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const appMetadata = user.app_metadata || {};
  const userSchoolIds: string[] = Array.isArray(appMetadata.school_ids) ? appMetadata.school_ids : [];

  const service = createServiceClient();
  let schoolId: string | null = userSchoolIds[0] || null;

  if (!schoolId) {
    const { data: roles } = await service
      .from("user_roles")
      .select("school_id")
      .eq("user_id", user.id)
      .is("revoked_at", null);
    schoolId = roles?.[0]?.school_id || null;
  }

  if (!schoolId) redirect("/login");

  // 1. Fetch recent audit logs for this school using school_id column (Schema v3)
  const { data: auditLogs } = await service
    .from("audit_log")
    .select("id, action, entity_type, entity_id, flag, metadata, created_at, actor_user_id, actor_role_snapshot")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(50);

  // 2. Frequent overdraft students via student_daily_counters (Schema v3)
  const { data: overdraftCounters } = await service
    .from("student_daily_counters")
    .select("student_id, overdraft_count, students ( full_name )")
    .eq("school_id", schoolId)
    .gt("overdraft_count", 0)
    .order("created_at", { ascending: false });

  // 3. Parental Consent logs (UU PDP Compliance)
  const { data: parentalConsents } = await service
    .from("parental_consent")
    .select(`
      id, parent_id, student_id, consent_type, consent_version, consent_token, granted_at, revoked_at, evidence_ip, created_at,
      students ( full_name ),
      parents ( full_name )
    `)
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(50);

  // 4. Card Lifecycle Events
  const { data: cardEvents } = await service
    .from("card_lifecycle_events")
    .select(`
      id, student_id, card_id, event_type, notes, actor_role_snapshot, created_at,
      students ( full_name )
    `)
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(50);

  const logs = auditLogs ?? [];
  const flaggedCount = logs.filter((l) => l.flag).length;
  const overdraftCount = (overdraftCounters ?? []).length;

  const formattedConsents = (parentalConsents ?? []).map((c: any) => ({
    id: c.id,
    student_name: c.students?.full_name ?? "Siswa",
    parent_name: c.parents?.full_name ?? "Orang Tua",
    consent_type: c.consent_type,
    consent_version: c.consent_version,
    consent_token: c.consent_token,
    granted_at: c.granted_at,
    revoked_at: c.revoked_at,
    evidence_ip: c.evidence_ip,
    created_at: c.created_at,
  }));

  const formattedCardEvents = (cardEvents ?? []).map((e: any) => ({
    id: e.id,
    student_name: e.students?.full_name ?? "Siswa",
    event_type: e.event_type,
    notes: e.notes,
    actor_role_snapshot: e.actor_role_snapshot,
    created_at: e.created_at,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Audit &amp; Kepatuhan UU PDP</h1>
          <p className="text-sm text-muted-foreground">Log aktivitas, kepatuhan consent orang tua, dan lifecycle kartu (Schema v3)</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Log System", value: logs.length, icon: CheckCircle2, color: "text-primary", bg: "bg-primary/15" },
          { label: "Log Berbendera", value: flaggedCount, icon: Flag, color: "text-accent", bg: "bg-accent/15" },
          { label: "Overdraft Sering", value: overdraftCount, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/15" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="glass rounded-2xl p-4">
              <div className={`w-8 h-8 rounded-xl ${s.bg} flex items-center justify-center mb-2`}>
                <Icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Frequent overdraft alerts */}
      {overdraftCounters && overdraftCounters.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h2 className="font-semibold text-sm text-destructive">Siswa Overdraft Sering (Daily Counter)</h2>
          </div>
          <div className="space-y-2">
            {overdraftCounters.map((cnt, idx) => {
              const st = cnt.students as unknown as { full_name?: string } | null;
              return (
                <div key={cnt.student_id + idx} className="flex items-center justify-between p-3 rounded-xl bg-destructive/5 border border-destructive/20">
                  <p className="text-sm font-medium">{st?.full_name ?? "Siswa"}</p>
                  <span className="text-sm font-bold text-destructive">
                    {cnt.overdraft_count}x overdraft
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Audit tabs visualizer */}
      <SchoolAuditTabs
        logs={logs}
        consents={formattedConsents}
        cardEvents={formattedCardEvents}
      />
    </div>
  );
}

