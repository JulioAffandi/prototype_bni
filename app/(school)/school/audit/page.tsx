import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ShieldCheck, Flag, AlertTriangle, CheckCircle2 } from "lucide-react";

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

  // Fetch recent audit logs for this school using school_id column (Schema v3)
  const { data: auditLogs } = await service
    .from("audit_log")
    .select("id, action, entity_type, entity_id, flag, metadata, created_at, actor_user_id, actor_role_snapshot")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(50);

  // Frequent overdraft students via student_daily_counters (Schema v3)
  const { data: overdraftCounters } = await service
    .from("student_daily_counters")
    .select("student_id, overdraft_count, students ( full_name )")
    .eq("school_id", schoolId)
    .gt("overdraft_count", 0)
    .order("created_at", { ascending: false });

  const logs = auditLogs ?? [];
  const flaggedCount = logs.filter((l) => l.flag).length;
  const overdraftCount = (overdraftCounters ?? []).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Audit &amp; Kepatuhan</h1>
          <p className="text-sm text-muted-foreground">Log aktivitas dan deteksi anomali otomatis (Schema v3)</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Log", value: logs.length, icon: CheckCircle2, color: "text-primary", bg: "bg-primary/15" },
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

      {/* Audit log table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-sm">Log Aktivitas Terbaru</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-xs text-muted-foreground font-medium">Waktu</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium">Aksi</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium">Entitas</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium">Flag</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className={`border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors ${log.flag ? "bg-destructive/5" : ""}`}>
                  <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("id-ID")}
                  </td>
                  <td className="p-3">
                    <span className="font-mono text-xs">{log.action}</span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {log.entity_type}{log.entity_id ? ` · ${log.entity_id.slice(-8)}` : ""}
                  </td>
                  <td className="p-3">
                    {log.flag ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/15 text-destructive text-xs">
                        <Flag className="w-3 h-3" />
                        {log.flag}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">
                    Belum ada log aktivitas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
