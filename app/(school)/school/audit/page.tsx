import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ShieldCheck, Flag, AlertTriangle, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = { title: "Audit & Kepatuhan" };

export default async function SchoolAuditPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", user.id)
    .single();
  if (!profile?.school_id) redirect("/login");

  // Fetch recent audit logs for this school
  const { data: auditLogs } = await supabase
    .from("audit_log")
    .select("id, action, entity_type, entity_id, flag, metadata, created_at, actor_profile_id")
    .eq("metadata->>school_id", profile.school_id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Frequent overdraft students
  const { data: overdraftStudents } = await supabase
    .from("students")
    .select("id, full_name, emergency_overdraft_count_7d")
    .eq("school_id", profile.school_id)
    .gt("emergency_overdraft_count_7d", 2)
    .order("emergency_overdraft_count_7d", { ascending: false });

  const flaggedCount = (auditLogs ?? []).filter((l) => l.flag).length;
  const overdraftCount = (overdraftStudents ?? []).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Audit &amp; Kepatuhan</h1>
          <p className="text-sm text-muted-foreground">Log aktivitas dan deteksi anomali otomatis</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Log", value: (auditLogs ?? []).length, icon: CheckCircle2, color: "text-primary", bg: "bg-primary/15" },
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
      {overdraftStudents && overdraftStudents.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h2 className="font-semibold text-sm text-destructive">Siswa Overdraft Sering (7 Hari Terakhir)</h2>
          </div>
          <div className="space-y-2">
            {overdraftStudents.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-destructive/5 border border-destructive/20">
                <p className="text-sm font-medium">{s.full_name}</p>
                <span className="text-sm font-bold text-destructive">
                  {s.emergency_overdraft_count_7d}x overdraft
                </span>
              </div>
            ))}
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
              {(auditLogs ?? []).map((log) => (
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
              {(!auditLogs || auditLogs.length === 0) && (
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
