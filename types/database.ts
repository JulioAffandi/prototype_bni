// =============================================================
// VALO EDUCATION ECOSYSTEM — Full Database Type Definitions
// Source: PRODUCT_SPECIFICATION_v2.md §6.2 (all 16 tables)
// TypeScript strict mode — zero any types
// Compatible with Supabase JS client type inference
// =============================================================

export type SchoolStatus = "active" | "suspended" | "offboarded";
export type UserRole = "parent" | "school_admin" | "merchant_staff" | "platform_admin";
export type MerchantStatus = "active" | "suspended";
export type CardStatus = "active" | "lost_reported" | "blocked" | "graduated" | "transferred_out";
export type TransactionStatus =
  | "INITIATED"
  | "SETTLED"
  | "SETTLED_OVERDRAFT"
  | "REJECTED_OVERLIMIT"
  | "OFFLINE_QUEUED"
  | "PENDING_SYNC"
  | "REJECTED_POST_HOC"
  | "COMPLETED";
export type SPPStatus = "UNPAID" | "PAID" | "FAILED" | "OVERDUE";
export type AccountType = "parent" | "student_vault" | "merchant" | "school_escrow";
export type EntryType = "DEBIT" | "CREDIT";
export type IdempotencyStatus = "PROCESSING" | "COMPLETED" | "FAILED";
export type SyncStatus = "PENDING" | "SYNCED" | "CONFLICT" | "DISCARDED";
export type CardEventType = "issued" | "lost_reported" | "blocked" | "reissued" | "offboarded";
export type PersonaType = "merchant_ai" | "school_treasury_ai" | "parent_ai";

export interface TransactionItem {
  menu: string;
  qty: number;
  price: number;
}

// ─── Supabase-compatible Database Schema Type ─────────────────
// The shape required for Supabase JS client type inference:
// Each table entry needs Row, Insert, Update, Relationships

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
          status: SchoolStatus;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["schools"]["Row"]> & {
          name: string;
          bni_giro_account: string;
        };
        Update: Partial<Database["public"]["Tables"]["schools"]["Row"]>;
        Relationships: [];
      };
      parents: {
        Row: {
          id: string;
          auth_user_id: string | null;
          full_name: string;
          phone_number: string;
          phone_verified: boolean;
          email: string | null;
          bni_account_number: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["parents"]["Row"]> & {
          full_name: string;
          phone_number: string;
          bni_account_number: string;
        };
        Update: Partial<Database["public"]["Tables"]["parents"]["Row"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          school_id: string | null;
          parent_id: string | null;
          merchant_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
          role: UserRole;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      merchants: {
        Row: {
          id: string;
          school_id: string;
          name: string;
          pic_name: string | null;
          bni_merchant_account: string;
          status: MerchantStatus;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["merchants"]["Row"]> & {
          school_id: string;
          name: string;
          bni_merchant_account: string;
        };
        Update: Partial<Database["public"]["Tables"]["merchants"]["Row"]>;
        Relationships: [];
      };
      students: {
        Row: {
          id: string;
          full_name: string;
          school_id: string;
          nfc_uid_hash: string;
          nfc_uid_last4: string | null;
          daily_limit: number;
          daily_limit_used: number;
          daily_limit_reset_at: string;
          emergency_approve: boolean;
          emergency_limit: number;
          emergency_used_today: boolean;
          emergency_overdraft_count_7d: number;
          card_status: CardStatus;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["students"]["Row"]> & {
          full_name: string;
          school_id: string;
          nfc_uid_hash: string;
        };
        Update: Partial<Database["public"]["Tables"]["students"]["Row"]>;
        Relationships: [];
      };
      guardian_student_map: {
        Row: {
          id: string;
          parent_id: string;
          student_id: string;
          relationship: string | null;
          is_primary_guardian: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["guardian_student_map"]["Row"]> & {
          parent_id: string;
          student_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["guardian_student_map"]["Row"]>;
        Relationships: [];
      };
      student_vault: {
        Row: {
          id: string;
          student_id: string;
          vault_balance: number;
          savings_goal_name: string | null;
          savings_goal_target: number | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["student_vault"]["Row"]> & {
          student_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["student_vault"]["Row"]>;
        Relationships: [];
      };
      canteen_transactions: {
        Row: {
          id: string;
          student_id: string;
          merchant_id: string;
          amount: number;
          status: TransactionStatus;
          is_emergency: boolean;
          idempotency_key: string;
          client_local_tx_uuid: string | null;
          settlement_batch_id: string | null;
          items: TransactionItem[] | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["canteen_transactions"]["Row"]> & {
          student_id: string;
          merchant_id: string;
          amount: number;
          status: TransactionStatus;
          idempotency_key: string;
        };
        Update: Partial<Database["public"]["Tables"]["canteen_transactions"]["Row"]>;
        Relationships: [];
      };
      spp_invoices: {
        Row: {
          id: string;
          student_id: string;
          school_id: string;
          period: string;
          amount: number;
          status: SPPStatus;
          retry_count: number;
          due_date: string;
          paid_at: string | null;
          bni_h2h_reference: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["spp_invoices"]["Row"]> & {
          student_id: string;
          school_id: string;
          period: string;
          amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["spp_invoices"]["Row"]>;
        Relationships: [];
      };
      wallet_ledger: {
        Row: {
          id: string;
          account_type: AccountType;
          account_ref_id: string;
          entry_type: EntryType;
          amount: number;
          balance_after: number;
          reference_table: string;
          reference_id: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["wallet_ledger"]["Row"]> & {
          account_type: AccountType;
          account_ref_id: string;
          entry_type: EntryType;
          amount: number;
          balance_after: number;
          reference_table: string;
          reference_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["wallet_ledger"]["Row"]>;
        Relationships: [];
      };
      idempotency_keys: {
        Row: {
          id: string;
          key: string;
          endpoint: string;
          response_snapshot: Record<string, unknown> | null;
          status: IdempotencyStatus;
          created_at: string;
          expires_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["idempotency_keys"]["Row"]> & {
          key: string;
          endpoint: string;
          status: IdempotencyStatus;
        };
        Update: Partial<Database["public"]["Tables"]["idempotency_keys"]["Row"]>;
        Relationships: [];
      };
      offline_sync_queue: {
        Row: {
          id: string;
          merchant_id: string;
          local_tx_uuid: string;
          payload: Record<string, unknown>;
          sync_status: SyncStatus;
          created_at: string;
          synced_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["offline_sync_queue"]["Row"]> & {
          merchant_id: string;
          local_tx_uuid: string;
          payload: Record<string, unknown>;
          sync_status: SyncStatus;
        };
        Update: Partial<Database["public"]["Tables"]["offline_sync_queue"]["Row"]>;
        Relationships: [];
      };
      card_lifecycle_events: {
        Row: {
          id: string;
          student_id: string;
          event_type: CardEventType;
          notes: string | null;
          actor_profile_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["card_lifecycle_events"]["Row"]> & {
          student_id: string;
          event_type: CardEventType;
        };
        Update: Partial<Database["public"]["Tables"]["card_lifecycle_events"]["Row"]>;
        Relationships: [];
      };
      parental_consent: {
        Row: {
          id: string;
          parent_id: string;
          student_id: string;
          consent_type: string;
          consent_token: string;
          granted_at: string | null;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["parental_consent"]["Row"]> & {
          parent_id: string;
          student_id: string;
          consent_type: string;
          consent_token: string;
        };
        Update: Partial<Database["public"]["Tables"]["parental_consent"]["Row"]>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          actor_profile_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Record<string, unknown> | null;
          flag: string | null;
          ip_address: string | null;
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
          persona_type: PersonaType;
          actor_profile_id: string | null;
          prompt: string;
          response: string;
          function_calls: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ai_chat_logs"]["Row"]> & {
          persona_type: PersonaType;
          prompt: string;
          response: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_chat_logs"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// ─── Convenience Row types (exported for component use) ───────
export type SchoolRow = Database["public"]["Tables"]["schools"]["Row"];
export type ParentRow = Database["public"]["Tables"]["parents"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type MerchantRow = Database["public"]["Tables"]["merchants"]["Row"];
export type StudentRow = Database["public"]["Tables"]["students"]["Row"];
export type GuardianStudentMapRow = Database["public"]["Tables"]["guardian_student_map"]["Row"];
export type StudentVaultRow = Database["public"]["Tables"]["student_vault"]["Row"];
export type CanteenTransactionRow = Database["public"]["Tables"]["canteen_transactions"]["Row"];
export type SPPInvoiceRow = Database["public"]["Tables"]["spp_invoices"]["Row"];
export type WalletLedgerRow = Database["public"]["Tables"]["wallet_ledger"]["Row"];
export type IdempotencyKeyRow = Database["public"]["Tables"]["idempotency_keys"]["Row"];
export type OfflineSyncQueueRow = Database["public"]["Tables"]["offline_sync_queue"]["Row"];
export type CardLifecycleEventRow = Database["public"]["Tables"]["card_lifecycle_events"]["Row"];
export type ParentalConsentRow = Database["public"]["Tables"]["parental_consent"]["Row"];
export type AuditLogRow = Database["public"]["Tables"]["audit_log"]["Row"];
export type AIChatLogRow = Database["public"]["Tables"]["ai_chat_logs"]["Row"];

// ─── API types ───────────────────────────────────────────────

export interface CanteenTransactionRequest {
  nfc_uid_hash: string;
  merchant_id: string;
  amount: number;
  items: TransactionItem[];
}

export interface CanteenTransactionResponse {
  transaction_id: string;
  status: TransactionStatus;
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
  status: TransactionStatus | "CONFLICT" | "DISCARDED";
  transaction_id?: string;
}
