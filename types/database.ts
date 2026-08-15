// =============================================================
// VALO EDUCATION ECOSYSTEM — Schema v3.0 Database Type Definitions
// Source: docs/schema_v3.sql & schema_v3.sql specification
// TypeScript strict mode — 100% type safety
// Compatible with Supabase JS client type inference
// =============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ─── Native Enum Types (schema_v3.sql §1) ───────────────────────
export type user_role_t =
  | "parent"
  | "school_admin"
  | "school_treasurer"
  | "merchant_owner"
  | "merchant_staff"
  | "platform_admin"
  | "platform_support";

export type school_status_t = "active" | "suspended" | "offboarded";
export type merchant_status_t = "pending" | "active" | "suspended" | "terminated";
export type student_status_t = "active" | "suspended" | "graduated" | "transferred_out" | "archived";
export type card_status_t = "pending_activation" | "active" | "lost_reported" | "blocked" | "replaced" | "retired";
export type guardian_relationship_t = "ayah" | "ibu" | "wali" | "kakek_nenek" | "saudara" | "institusi" | "lainnya";
export type guardian_link_status_t = "pending" | "pending_activation" | "active" | "revoked";
export type txn_status_t = "PENDING" | "SETTLED" | "REJECTED_OVERLIMIT" | "REJECTED_CARD_BLOCKED" | "REJECTED_POST_HOC" | "REVERSED";
export type settlement_status_t = "UNSETTLED" | "BATCHED" | "DISBURSED" | "FAILED";
export type txn_channel_t = "ONLINE_TAP" | "OFFLINE_SYNC" | "MANUAL_ADJUSTMENT";
export type invoice_status_t = "DRAFT" | "UNPAID" | "PROCESSING" | "PAID" | "FAILED" | "OVERDUE" | "WAIVED" | "CANCELLED";

export type ledger_account_t =
  | "parent_funding"
  | "student_pagu"
  | "student_vault"
  | "student_advance"
  | "merchant_payable"
  | "school_escrow"
  | "platform_clearing"
  | "platform_revenue";

export type ledger_normal_balance_t = "DEBIT" | "CREDIT";

export type ledger_source_t =
  | "CANTEEN_TAP"
  | "CANTEEN_REVERSAL"
  | "SPP_DEBIT"
  | "VAULT_ROLLOVER"
  | "VAULT_WITHDRAWAL"
  | "ADVANCE_REPAYMENT"
  | "MERCHANT_DISBURSEMENT"
  | "TOPUP"
  | "MANUAL_ADJUSTMENT"
  | "OFFBOARDING_PAYOUT";

export type card_event_t =
  | "issued"
  | "activated"
  | "lost_reported"
  | "blocked"
  | "unblocked"
  | "reissued"
  | "retired"
  | "offboarded"
  | "ISSUANCE"
  | "LOST_REPORTED"
  | "BLOCKED"
  | "REISSUED"
  | "DEACTIVATED"
  | "OFFBOARDED";
export type consent_type_t = "DATA_PROCESSING_MINOR" | "MARKETING" | "AI_ANALYTICS" | "BIOMETRIC_NONE";
export type sync_status_t = "PENDING" | "SYNCED" | "CONFLICT" | "DISCARDED";
export type idempotency_status_t = "PROCESSING" | "COMPLETED" | "FAILED";
export type ai_persona_t = "merchant_ai" | "school_treasury_ai" | "parent_ai";

// Legacy type alias mappings for backward compatibility
export type UserRole = user_role_t;
export type SchoolStatus = school_status_t;
export type MerchantStatus = merchant_status_t;
export type StudentStatus = student_status_t;
export type CardStatus = card_status_t;
export type TransactionStatus = txn_status_t;
export type SPPStatus = invoice_status_t;
export type AccountType = ledger_account_t;
export type EntryType = ledger_normal_balance_t;
export type IdempotencyStatus = idempotency_status_t;
export type SyncStatus = sync_status_t;
export type CardEventType = card_event_t;
export type PersonaType = ai_persona_t;

export interface TransactionItem {
  menu: string;
  qty: number;
  price: number;
  category?: string;
  menu_item_id?: string;
  unit_cost?: number;
}

// ─── RPC Return Type ──────────────────────────────────────────
export interface CanteenTapRpcResult {
  transaction_id?: string;
  status?: string;
  is_emergency?: boolean;
  emergency_amount?: number;
  sisa_pagu?: number;
  business_date?: string;
  settled_at?: string;
  http_status?: number;
  error?: string;
  replayed?: boolean;
  [key: string]: unknown;
}

export type TelegramTargetsResult = {
  parent_chat_ids: string[] | null;
  merchant_chat_id: string | null;
  student_full_name: string;
  merchant_name: string;
};


// ─── Supabase Database Interface ───────────────────────────────
export interface Database {
  public: {
    Tables: {
      schools: {
        Row: {
          id: string;
          name: string;
          npsn: string | null;
          bni_giro_account: string;
          address: string | null;
          timezone: string;
          default_daily_limit: number;
          default_emergency_limit: number;
          status: school_status_t;
          telegram_chat_id: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["schools"]["Row"]> & {
          name: string;
          bni_giro_account: string;
        };
        Update: Partial<Database["public"]["Tables"]["schools"]["Row"]>;
        Relationships: [];
      };
      merchants: {
        Row: {
          id: string;
          school_id: string;
          name: string;
          pic_name: string | null;
          bni_merchant_account: string;
          status: merchant_status_t;
          telegram_chat_id: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["merchants"]["Row"]> & {
          school_id: string;
          name: string;
          bni_merchant_account: string;
        };
        Update: Partial<Database["public"]["Tables"]["merchants"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "merchants_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      parents: {
        Row: {
          id: string;
          full_name: string;
          phone_number: string;
          phone_verified_at: string | null;
          email: string | null;
          bni_account_number: string | null;
          bni_link_status: string;
          account_status?: string;
          invited_by_school_id?: string | null;
          telegram_chat_id: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["parents"]["Row"]> & {
          full_name: string;
          phone_number: string;
        };
        Update: Partial<Database["public"]["Tables"]["parents"]["Row"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string;
          role: user_role_t | null;
          school_id: string | null;
          parent_id: string | null;
          merchant_id: string | null;
          locale: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
          display_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "profiles_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "parents";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: user_role_t;
          school_id: string | null;
          merchant_id: string | null;
          granted_by: string | null;
          granted_at: string;
          revoked_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["user_roles"]["Row"]> & {
          user_id: string;
          role: user_role_t;
        };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_roles_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_roles_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };
      students: {
        Row: {
          id: string;
          school_id: string;
          full_name: string;
          student_number: string | null;
          class_label: string | null;
          grade_level: number | string | null;
          class_name: string | null;
          class_group?: string | null;
          date_of_birth: string | null;
          status: student_status_t;
          daily_limit: number;
          daily_limit_used: number;
          daily_limit_reset_at: string | null;
          emergency_approve: boolean;
          emergency_limit: number;
          emergency_used_today: boolean;
          created_at: string;
          updated_at: string;
          offboarded_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["students"]["Row"]> & {
          school_id: string;
          full_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["students"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "students_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      student_cards: {
        Row: {
          id: string;
          student_id: string;
          school_id: string;
          uid_hash: string;
          card_uid_hash?: string | null;
          uid_last4: string | null;
          status: card_status_t;
          issued_at: string;
          activated_at: string | null;
          retired_at: string | null;
          deactivated_at?: string | null;
          issued_by_profile_id?: string | null;
          replaced_by_card_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["student_cards"]["Row"]> & {
          student_id: string;
          school_id: string;
          uid_hash: string;
        };
        Update: Partial<Database["public"]["Tables"]["student_cards"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "student_cards_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_cards_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      guardian_student_map: {
        Row: {
          id: string;
          parent_id: string;
          student_id: string;
          school_id: string;
          relationship: guardian_relationship_t;
          is_primary_guardian: boolean;
          status: guardian_link_status_t;
          linked_via?: string;
          linked_at?: string;
          can_view_activity: boolean;
          can_manage_pagu: boolean;
          can_fund: boolean;
          can_approve_vault: boolean;
          can_report_card_lost: boolean;
          valid_from: string;
          valid_until: string | null;
          revoked_at: string | null;
          revoked_reason: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["guardian_student_map"]["Row"]> & {
          parent_id: string;
          student_id: string;
          school_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["guardian_student_map"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "guardian_student_map_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "parents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guardian_student_map_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guardian_student_map_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      guardian_claim_attempts: {
        Row: {
          id: string;
          parent_id: string | null;
          ip_address: string | null;
          attempted_npsn: string | null;
          attempted_nisn: string | null;
          success: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["guardian_claim_attempts"]["Row"]> & {
          success: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["guardian_claim_attempts"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "guardian_claim_attempts_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "parents";
            referencedColumns: ["id"];
          },
        ];
      };
      student_daily_counters: {
        Row: {
          student_id: string;
          business_date: string;
          school_id: string;
          limit_snapshot: number;
          spent_amount: number;
          overdraft_amount: number;
          overdraft_count: number;
          txn_count: number;
          rolled_over_at: string | null;
          rolled_over_amount: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["student_daily_counters"]["Row"]> & {
          student_id: string;
          business_date: string;
          school_id: string;
          limit_snapshot: number;
        };
        Update: Partial<Database["public"]["Tables"]["student_daily_counters"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "student_daily_counters_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      ledger_accounts: {
        Row: {
          id: string;
          account_type: ledger_account_t;
          normal_balance: ledger_normal_balance_t;
          currency_code: string;
          owner_school_id: string | null;
          owner_parent_id: string | null;
          owner_student_id: string | null;
          owner_merchant_id: string | null;
          balance: number;
          last_entry_seq: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ledger_accounts"]["Row"]> & {
          account_type: ledger_account_t;
          normal_balance: ledger_normal_balance_t;
        };
        Update: Partial<Database["public"]["Tables"]["ledger_accounts"]["Row"]>;
        Relationships: [];
      };
      ledger_transactions: {
        Row: {
          id: string;
          source: ledger_source_t;
          source_table: string;
          source_id: string;
          school_id: string | null;
          business_date: string;
          currency_code: string;
          description: string | null;
          reverses_id: string | null;
          posted_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ledger_transactions"]["Row"]> & {
          source: ledger_source_t;
          source_table: string;
          source_id: string;
          business_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["ledger_transactions"]["Row"]>;
        Relationships: [];
      };
      ledger_entries: {
        Row: {
          id: string;
          transaction_id: string;
          account_id: string;
          signed_amount: number;
          entry_seq: number;
          balance_after: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ledger_entries"]["Row"]> & {
          transaction_id: string;
          account_id: string;
          signed_amount: number;
          entry_seq: number;
          balance_after: number;
        };
        Update: Partial<Database["public"]["Tables"]["ledger_entries"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "ledger_entries_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "ledger_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "ledger_transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      canteen_transactions: {
        Row: {
          id: string;
          school_id: string;
          student_id: string;
          merchant_id: string;
          card_id: string | null;
          amount: number;
          status: txn_status_t;
          settlement_status: settlement_status_t;
          channel: txn_channel_t;
          is_emergency: boolean;
          emergency_amount: number;
          idempotency_key: string;
          client_local_tx_uuid: string | null;
          settlement_batch_id: string | null;
          ledger_transaction_id: string | null;
          reversal_of_id: string | null;
          items: Json;
          rejection_reason: string | null;
          created_at: string;
          business_date: string;
        };
        Insert: Partial<Database["public"]["Tables"]["canteen_transactions"]["Row"]> & {
          school_id: string;
          student_id: string;
          merchant_id: string;
          amount: number;
          idempotency_key: string;
        };
        Update: Partial<Database["public"]["Tables"]["canteen_transactions"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "canteen_transactions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "canteen_transactions_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "canteen_transactions_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      spp_invoices: {
        Row: {
          id: string;
          school_id: string;
          student_id: string;
          billed_parent_id: string | null;
          period: string;
          period_start: string;
          amount: number;
          amount_paid: number;
          status: invoice_status_t;
          retry_count: number;
          next_retry_at: string | null;
          due_date: string;
          paid_at: string | null;
          bni_h2h_reference: string | null;
          ledger_transaction_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["spp_invoices"]["Row"]> & {
          school_id: string;
          student_id: string;
          period: string;
          amount: number;
          due_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["spp_invoices"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "spp_invoices_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "spp_invoices_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "spp_invoices_billed_parent_id_fkey";
            columns: ["billed_parent_id"];
            isOneToOne: false;
            referencedRelation: "parents";
            referencedColumns: ["id"];
          },
        ];
      };
      student_vault: {
        Row: {
          student_id: string;
          school_id: string;
          ledger_account_id: string;
          vault_balance: number;
          savings_goal_name: string | null;
          savings_goal_target: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["student_vault"]["Row"]> & {
          student_id: string;
          school_id: string;
          ledger_account_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["student_vault"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "student_vault_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_vault_ledger_account_id_fkey";
            columns: ["ledger_account_id"];
            isOneToOne: false;
            referencedRelation: "ledger_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      vault_withdrawal_requests: {
        Row: {
          id: string;
          student_id: string;
          requested_by: string;
          approved_by: string | null;
          amount: number;
          status: string;
          destination_account: string | null;
          ledger_transaction_id: string | null;
          requested_at: string;
          resolved_at: string | null;
          expires_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["vault_withdrawal_requests"]["Row"]> & {
          student_id: string;
          requested_by: string;
          amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["vault_withdrawal_requests"]["Row"]>;
        Relationships: [];
      };
      student_advances: {
        Row: {
          id: string;
          student_id: string;
          school_id: string;
          origin_txn_id: string;
          principal_amount: number;
          outstanding_amount: number;
          status: string;
          incurred_on: string;
          repaid_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["student_advances"]["Row"]> & {
          student_id: string;
          school_id: string;
          origin_txn_id: string;
          principal_amount: number;
          outstanding_amount: number;
          incurred_on: string;
        };
        Update: Partial<Database["public"]["Tables"]["student_advances"]["Row"]>;
        Relationships: [];
      };
      idempotency_keys: {
        Row: {
          key: string;
          endpoint: string;
          actor_user_id: string | null;
          request_fingerprint: string;
          response_snapshot: Json | null;
          response_status: number | null;
          status: idempotency_status_t;
          created_at: string;
          completed_at: string | null;
          expires_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["idempotency_keys"]["Row"]> & {
          key: string;
          endpoint: string;
          request_fingerprint: string;
        };
        Update: Partial<Database["public"]["Tables"]["idempotency_keys"]["Row"]>;
        Relationships: [];
      };
      offline_sync_queue: {
        Row: {
          id: string;
          merchant_id: string;
          school_id: string;
          local_tx_uuid: string;
          payload: Json;
          sync_status: sync_status_t;
          conflict_reason: string | null;
          resulting_txn_id: string | null;
          device_captured_at: string;
          received_at: string;
          synced_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["offline_sync_queue"]["Row"]> & {
          merchant_id: string;
          school_id: string;
          local_tx_uuid: string;
          payload: Json;
          device_captured_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["offline_sync_queue"]["Row"]>;
        Relationships: [];
      };
      card_lifecycle_events: {
        Row: {
          id: string;
          student_id: string;
          card_id: string | null;
          school_id: string;
          event_type: card_event_t;
          notes: string | null;
          actor_user_id: string | null;
          actor_role_snapshot: user_role_t | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["card_lifecycle_events"]["Row"]> & {
          student_id: string;
          school_id: string;
          event_type: card_event_t;
        };
        Update: Partial<Database["public"]["Tables"]["card_lifecycle_events"]["Row"]>;
        Relationships: [];
      };
      parental_consent: {
        Row: {
          id: string;
          parent_id: string;
          student_id: string;
          school_id: string;
          consent_type: consent_type_t;
          consent_version: string;
          consent_token: string;
          granted_at: string | null;
          revoked_at: string | null;
          evidence_ip: string | null;
          evidence_user_agent: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["parental_consent"]["Row"]> & {
          parent_id: string;
          student_id: string;
          school_id: string;
          consent_token: string;
        };
        Update: Partial<Database["public"]["Tables"]["parental_consent"]["Row"]>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          school_id: string | null;
          actor_user_id: string | null;
          actor_role_snapshot: user_role_t | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json;
          flag: string | null;
          ip_address: string | null;
          request_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["audit_log"]["Row"]> & {
          action: string;
          entity_type: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Row"]>;
        Relationships: [];
      };
      ai_chat_logs: {
        Row: {
          id: string;
          session_id: string | null;
          persona_type: ai_persona_t;
          actor_user_id: string | null;
          actor_profile_id: string | null;
          school_id: string | null;
          prompt: string;
          response: string | null;
          function_calls: Json | null;
          model: string | null;
          model_id: string | null;
          input_tokens: number | null;
          output_tokens: number | null;
          total_tokens: number | null;
          tools_invoked: string[];
          step_count: number | null;
          finish_reason: string | null;
          latency_ms: number | null;
          error_code: string | null;
          scope_snapshot: Json | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ai_chat_logs"]["Row"]> & {
          persona_type: ai_persona_t;
          prompt: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_chat_logs"]["Row"]>;
        Relationships: [];
      };
      telegram_link_failures: {
        Row: {
          id: string;
          entity_type: "parent" | "merchant" | "school";
          entity_id: string;
          chat_id: string;
          consecutive_failures: number;
          last_error_code: number | null;
          last_attempt_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["telegram_link_failures"]["Row"]> & {
          entity_type: "parent" | "merchant" | "school";
          entity_id: string;
          chat_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["telegram_link_failures"]["Row"]>;
        Relationships: [];
      };
      menu_items: {
        Row: {
          id: string;
          merchant_id: string;
          name: string;
          category: string;
          unit_price: number;
          unit_cost: number | null;
          stock_qty: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["menu_items"]["Row"]> & {
          merchant_id: string;
          name: string;
          category: string;
          unit_price: number;
        };
        Update: Partial<Database["public"]["Tables"]["menu_items"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "menu_items_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };
      canteen_transaction_items: {
        Row: {
          id: string;
          transaction_id: string;
          menu_item_id: string | null;
          item_name_snapshot: string;
          category_snapshot: string;
          qty: number;
          unit_price_snapshot: number;
          unit_cost_snapshot: number | null;
          line_total: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["canteen_transaction_items"]["Row"]> & {
          transaction_id: string;
          item_name_snapshot: string;
          category_snapshot: string;
          qty: number;
          unit_price_snapshot: number;
          line_total: number;
        };
        Update: Partial<Database["public"]["Tables"]["canteen_transaction_items"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "canteen_transaction_items_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "canteen_transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "canteen_transaction_items_menu_item_id_fkey";
            columns: ["menu_item_id"];
            isOneToOne: false;
            referencedRelation: "menu_items";
            referencedColumns: ["id"];
          },
        ];
      };
      settlement_batches: {
        Row: {
          id: string;
          merchant_id: string;
          business_date: string;
          gross_amount: number;
          platform_fee: number;
          net_amount: number;
          transaction_count: number;
          status: "PENDING" | "SUBMITTED" | "CONFIRMED" | "FAILED";
          bni_reference: string | null;
          failure_reason: string | null;
          scheduled_disburse_at: string | null;
          disbursed_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["settlement_batches"]["Row"]> & {
          merchant_id: string;
          business_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["settlement_batches"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "settlement_batches_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
        ];
      };
      school_giro_snapshots: {
        Row: {
          id: string;
          school_id: string;
          snapshot_date: string;
          giro_balance: number;
          source: "BNI_H2H" | "MANUAL_ENTRY";
          fetched_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["school_giro_snapshots"]["Row"]> & {
          school_id: string;
          snapshot_date: string;
          giro_balance: number;
        };
        Update: Partial<Database["public"]["Tables"]["school_giro_snapshots"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "school_giro_snapshots_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_rate_limit_counters: {
        Row: {
          actor_profile_id: string;
          window_start: string;
          request_count: number;
          token_count: number;
        };
        Insert: Partial<Database["public"]["Tables"]["ai_rate_limit_counters"]["Row"]> & {
          actor_profile_id: string;
          window_start: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_rate_limit_counters"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      fn_process_canteen_tap: {
        Args: {
          p_idempotency_key: string;
          p_card_uid_hash: string;
          p_merchant_id: string;
          p_amount: number;
          p_items?: Json;
          p_client_local_tx_uuid?: string | null;
          p_channel?: txn_channel_t;
          p_occurred_at?: string;
        };
        Returns: CanteenTapRpcResult;
      };
      fn_get_telegram_targets: {
        Args: {
          p_student_id: string;
          p_merchant_id: string;
        };
        Returns: TelegramTargetsResult[];
      };
      rpc_school_escrow_summary: {
        Args: Record<string, never>;
        Returns: Array<{
          net_balance: number;
          total_credit: number;
          total_debit: number;
          entry_count: number;
          last_entry_at: string | null;
        }>;
      };
      rpc_merchant_daily_metrics: {
        Args: {
          p_business_date: string;
        };
        Returns: Array<{
          gross_revenue: number;
          transaction_count: number;
          avg_ticket: number;
          emergency_count: number;
          rejected_count: number;
          estimated_cogs: number;
          cogs_coverage_pct: number;
          peak_hour: number | null;
          peak_hour_count: number;
        }>;
      };
      rpc_merchant_top_items: {
        Args: {
          p_days: number;
          p_limit: number;
        };
        Returns: Array<{
          item_name: string;
          category: string;
          qty_sold: number;
          revenue: number;
          stock_left: number | null;
        }>;
      };
      rpc_child_spending_by_category: {
        Args: {
          p_student_id: string;
          p_from: string;
          p_to: string;
        };
        Returns: Array<{
          category: string;
          total_amount: number;
          item_count: number;
          pct_of_total: number;
        }>;
      };
      rpc_spp_collection_rate: {
        Args: {
          p_period: string;
        };
        Returns: Array<{
          total_invoice: number;
          paid_count: number;
          unpaid_count: number;
          failed_count: number;
          overdue_count: number;
          billed_amount: number;
          collected_amount: number;
          collection_pct: number;
        }>;
      };
      rpc_school_card_stats: {
        Args: Record<string, never>;
        Returns: Array<{
          total_students: number;
          active_cards: number;
          lost_reported: number;
          blocked: number;
          graduated: number;
          transferred_out: number;
          consent_pending: number;
          issued_last_30d: number;
        }>;
      };
      valo_current_role: {
        Args: Record<string, never>;
        Returns: string;
      };
      rpc_ai_consume_rate_limit: {
        Args: {
          p_profile: string;
          p_max_req: number;
          p_window_minutes: number;
        };
        Returns: Array<{
          diizinkan: boolean;
          sisa_request: number;
        }>;
      };
    };
    Enums: {
      user_role_t: user_role_t;
      school_status_t: school_status_t;
      merchant_status_t: merchant_status_t;
      student_status_t: student_status_t;
      card_status_t: card_status_t;
      guardian_relationship_t: guardian_relationship_t;
      guardian_link_status_t: guardian_link_status_t;
      txn_status_t: txn_status_t;
      settlement_status_t: settlement_status_t;
      txn_channel_t: txn_channel_t;
      invoice_status_t: invoice_status_t;
      ledger_account_t: ledger_account_t;
      ledger_normal_balance_t: ledger_normal_balance_t;
      ledger_source_t: ledger_source_t;
      card_event_t: card_event_t;
      consent_type_t: consent_type_t;
      sync_status_t: sync_status_t;
      idempotency_status_t: idempotency_status_t;
      ai_persona_t: ai_persona_t;
    };
    CompositeTypes: Record<string, never>;
  };
}

// ─── Convenience Row types (exported for component use) ───────
export type SchoolRow = Database["public"]["Tables"]["schools"]["Row"];
export type ParentRow = Database["public"]["Tables"]["parents"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type UserRoleRow = Database["public"]["Tables"]["user_roles"]["Row"];
export type MerchantRow = Database["public"]["Tables"]["merchants"]["Row"];
export type StudentRow = Database["public"]["Tables"]["students"]["Row"];
export type StudentCardRow = Database["public"]["Tables"]["student_cards"]["Row"];
export type GuardianStudentMapRow = Database["public"]["Tables"]["guardian_student_map"]["Row"];
export type StudentDailyCounterRow = Database["public"]["Tables"]["student_daily_counters"]["Row"];
export type LedgerAccountRow = Database["public"]["Tables"]["ledger_accounts"]["Row"];
export type LedgerTransactionRow = Database["public"]["Tables"]["ledger_transactions"]["Row"];
export type LedgerEntryRow = Database["public"]["Tables"]["ledger_entries"]["Row"];
export type StudentVaultRow = Database["public"]["Tables"]["student_vault"]["Row"];
export type CanteenTransactionRow = Database["public"]["Tables"]["canteen_transactions"]["Row"];
export type SPPInvoiceRow = Database["public"]["Tables"]["spp_invoices"]["Row"];
export type IdempotencyKeyRow = Database["public"]["Tables"]["idempotency_keys"]["Row"];
export type OfflineSyncQueueRow = Database["public"]["Tables"]["offline_sync_queue"]["Row"];
export type CardLifecycleEventRow = Database["public"]["Tables"]["card_lifecycle_events"]["Row"];
export type ParentalConsentRow = Database["public"]["Tables"]["parental_consent"]["Row"];
export type AuditLogRow = Database["public"]["Tables"]["audit_log"]["Row"];
export type AIChatLogRow = Database["public"]["Tables"]["ai_chat_logs"]["Row"];
export type TelegramLinkFailureRow = Database["public"]["Tables"]["telegram_link_failures"]["Row"];
export type MenuItemRow = Database["public"]["Tables"]["menu_items"]["Row"];
export type CanteenTransactionItemRow = Database["public"]["Tables"]["canteen_transaction_items"]["Row"];
export type SettlementBatchRow = Database["public"]["Tables"]["settlement_batches"]["Row"];
export type SchoolGiroSnapshotRow = Database["public"]["Tables"]["school_giro_snapshots"]["Row"];
export type AIRateLimitCounterRow = Database["public"]["Tables"]["ai_rate_limit_counters"]["Row"];

// ─── API Types ───────────────────────────────────────────────
export interface CanteenTransactionRequest {
  nfc_uid_hash: string;
  merchant_id: string;
  amount: number;
  items: TransactionItem[];
}

export interface CanteenTransactionResponse {
  transaction_id: string;
  status: txn_status_t;
  is_emergency: boolean;
  sisa_pagu: number;
  settled_at: string;
}

export interface OfflineQueuePayload {
  local_tx_uuid: string;
  nfc_uid_hash: string;
  merchant_id: string;
  amount: number;
  items: TransactionItem[];
  created_at_local: number;
  pagu_snapshot: number;
}

export interface OfflineQueueSyncResult {
  local_tx_uuid: string;
  status: txn_status_t | "CONFLICT" | "DISCARDED";
  transaction_id?: string;
}
