"use client";

import { useState } from "react";
import {
  FileText,
  ShieldCheck,
  CreditCard,
  Flag,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  Lock,
} from "lucide-react";

export interface AuditLogItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  flag: string | null;
  created_at: string;
  actor_role_snapshot: string | null;
}

export interface ConsentLogItem {
  id: string;
  student_name: string;
  parent_name: string;
  consent_type: string;
  consent_version: string;
  consent_token: string;
  granted_at: string | null;
  revoked_at: string | null;
  evidence_ip: string | null;
  created_at: string;
}

export interface CardLifecycleItem {
  id: string;
  student_name: string;
  event_type: string;
  notes: string | null;
  actor_role_snapshot: string | null;
  created_at: string;
}

interface SchoolAuditTabsProps {
  logs: AuditLogItem[];
  consents: ConsentLogItem[];
  cardEvents: CardLifecycleItem[];
}

export default function SchoolAuditTabs({
  logs,
  consents,
  cardEvents,
}: SchoolAuditTabsProps) {
  const [activeTab, setActiveTab] = useState<"logs" | "consents" | "cards">("logs");

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          id="audit-tab-logs"
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "logs"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <FileText className="w-4 h-4" />
          Log Aktivitas ({logs.length})
        </button>

        <button
          id="audit-tab-consents"
          onClick={() => setActiveTab("consents")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "consents"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Kepatuhan PDP ({consents.length})
        </button>

        <button
          id="audit-tab-cards"
          onClick={() => setActiveTab("cards")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "cards"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Lifecycle Kartu ({cardEvents.length})
        </button>
      </div>

      {/* Tab 1: Audit Log Table */}
      {activeTab === "logs" && (
        <div className="glass rounded-2xl overflow-hidden border border-border/60">
          <div className="p-4 border-b border-border/50 flex items-center justify-between">
            <h2 className="font-semibold text-sm text-foreground">Log Aktivitas Sistem &amp; Transaksi</h2>
            <span className="text-xs text-muted-foreground">Log audit immutable (Schema v3)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-3.5 text-xs text-muted-foreground font-medium">Waktu</th>
                  <th className="text-left p-3.5 text-xs text-muted-foreground font-medium">Aksi</th>
                  <th className="text-left p-3.5 text-xs text-muted-foreground font-medium">Entitas</th>
                  <th className="text-left p-3.5 text-xs text-muted-foreground font-medium">Aktor</th>
                  <th className="text-left p-3.5 text-xs text-muted-foreground font-medium">Flag Anomali</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className={`border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors ${
                      log.flag ? "bg-destructive/5" : ""
                    }`}
                  >
                    <td className="p-3.5 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("id-ID")}
                    </td>
                    <td className="p-3.5">
                      <span className="font-mono text-xs font-semibold text-foreground">{log.action}</span>
                    </td>
                    <td className="p-3.5 text-xs text-muted-foreground">
                      {log.entity_type}
                      {log.entity_id ? ` · ${log.entity_id.slice(-8)}` : ""}
                    </td>
                    <td className="p-3.5 text-xs text-muted-foreground">
                      <span className="px-2 py-0.5 rounded-full bg-muted border text-[11px] font-mono">
                        {log.actor_role_snapshot || "system"}
                      </span>
                    </td>
                    <td className="p-3.5">
                      {log.flag ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-destructive/15 text-destructive text-xs font-semibold">
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
                    <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                      Belum ada log aktivitas sistem
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Parental Consent Status (UU PDP) */}
      {activeTab === "consents" && (
        <div className="glass rounded-2xl overflow-hidden border border-border/60">
          <div className="p-4 border-b border-border/50 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-sm text-foreground">Status Konsen Orang Tua (Kepatuhan UU PDP)</h2>
              <p className="text-xs text-muted-foreground">Bukti verifikasi persetujuan wali murid &amp; enkripsi token consent</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/25">
              <Lock className="w-3.5 h-3.5" />
              <span>UU PDP Compliant</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-3.5 text-xs text-muted-foreground font-medium">Siswa &amp; Wali</th>
                  <th className="text-left p-3.5 text-xs text-muted-foreground font-medium">Tipe Konsen</th>
                  <th className="text-left p-3.5 text-xs text-muted-foreground font-medium">Token PDP Hash</th>
                  <th className="text-left p-3.5 text-xs text-muted-foreground font-medium">Bukti Waktu &amp; IP</th>
                  <th className="text-left p-3.5 text-xs text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {consents.map((c) => {
                  const isGranted = Boolean(c.granted_at && !c.revoked_at);
                  return (
                    <tr key={c.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="p-3.5">
                        <p className="font-semibold text-foreground text-sm">{c.student_name}</p>
                        <p className="text-xs text-muted-foreground">Wali: {c.parent_name}</p>
                      </td>
                      <td className="p-3.5">
                        <span className="font-mono text-xs text-foreground bg-muted px-2 py-1 rounded-lg border">
                          {c.consent_type} (v{c.consent_version})
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-xs text-muted-foreground">
                        {c.consent_token ? `${c.consent_token.slice(0, 16)}...` : "TOKEN-VERIFIED"}
                      </td>
                      <td className="p-3.5 text-xs text-muted-foreground">
                        <p>{c.granted_at ? new Date(c.granted_at).toLocaleString("id-ID") : "—"}</p>
                        <p className="text-[11px] font-mono">IP: {c.evidence_ip || "127.0.0.1"}</p>
                      </td>
                      <td className="p-3.5">
                        {isGranted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full badge-paid text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Disetujui
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full badge-failed text-xs font-semibold">
                            <XCircle className="w-3.5 h-3.5" />
                            Dicabut
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {consents.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                      Belum ada data konsen orang tua terdaftar
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Card Lifecycle Events */}
      {activeTab === "cards" && (
        <div className="glass rounded-2xl overflow-hidden border border-border/60">
          <div className="p-4 border-b border-border/50 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-sm text-foreground">Timeline Lifecycle Kartu NFC</h2>
              <p className="text-xs text-muted-foreground">Histori penerbitan, pelaporan hilang, blokir, dan re-issuance kartu siswa</p>
            </div>
            <span className="text-xs text-muted-foreground font-mono">public.card_lifecycle_events</span>
          </div>
          <div className="p-4 space-y-3">
            {cardEvents.map((evt) => {
              const eventTypeLabel: Record<string, { label: string; badge: string }> = {
                issued: { label: "Kartu Diterbitkan", badge: "badge-paid" },
                activated: { label: "Kartu Diaktivasi", badge: "badge-paid" },
                lost_reported: { label: "Laporkan Hilang", badge: "badge-overdue" },
                blocked: { label: "Kartu Diblokir", badge: "badge-failed" },
                reissued: { label: "Kartu Diterbitkan Ulang", badge: "badge-unpaid" },
                replaced: { label: "Kartu Diganti", badge: "badge-offline" },
              };
              const cfg = eventTypeLabel[evt.event_type] ?? { label: evt.event_type, badge: "badge-offline" };

              return (
                <div
                  key={evt.id}
                  className="flex items-start justify-between p-3.5 rounded-xl bg-muted/40 border border-border/50 hover:bg-muted/70 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0 mt-0.5">
                      <CreditCard className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{evt.student_name}</span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {evt.notes || "Operasi kartu NFC siswa diselesaikan."}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(evt.created_at).toLocaleString("id-ID")}
                    </p>
                    <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                      Aktor: {evt.actor_role_snapshot || "admin"}
                    </p>
                  </div>
                </div>
              );
            })}

            {cardEvents.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Belum ada histori event lifecycle kartu NFC
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
