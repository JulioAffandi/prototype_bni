// =============================================================
// VALO EDUCATION ECOSYSTEM — Full Database Type Definitions
// Source: PRODUCT_SPECIFICATION_v2.md §6.2 (all 16 tables)
// TypeScript strict mode — zero any types
// =============================================================

export type SchoolStatus = 'active' | 'suspended' | 'offboarded';
export type UserRole = 'parent' | 'school_admin' | 'merchant_staff' | 'platform_admin';
export type MerchantStatus = 'active' | 'suspended';
export type CardStatus = 'active' | 'lost_reported' | 'blocked' | 'graduated' | 'transferred_out';
export type TransactionStatus =
  | 'INITIATED'
  | 'SETTLED'
  | 'SETTLED_OVERDRAFT'
  | 'REJECTED_OVERLIMIT'
  | 'OFFLINE_QUEUED'
  | 'PENDING_SYNC'
  | 'REJECTED_POST_HOC'
  | 'COMPLETED';
export type SPPStatus = 'UNPAID' | 'PAID' | 'FAILED' | 'OVERDUE';
export type AccountType = 'parent' | 'student_vault' | 'merchant' | 'school_escrow';
export type EntryType = 'DEBIT' | 'CREDIT';
export type IdempotencyStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type SyncStatus = 'PENDING' | 'SYNCED' | 'CONFLICT' | 'DISCARDED';
export type CardEventType = 'issued' | 'lost_reported' | 'blocked' | 'reissued' | 'offboarded';
export type PersonaType = 'merchant_ai' | 'school_treasury_ai' | 'parent_ai';
export type AuditFlag = 'FREQUENT_OVERDRAFT' | 'MERCHANT_EMERGENCY_ANOMALY' | string;

// ─── Table Row Types ───────────────────────────────────────────

export interface School {
  id: string;
  name: string;
  npsn: string | null;
  bni_giro_account: string;
  address: string | null;
  status: SchoolStatus;
  created_at: string;
}

export interface Parent {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  phone_number: string;
  phone_verified: boolean;
  email: string | null;
  bni_account_number: string;
  created_at: string;
}

export interface Profile {
  id: string;
  role: UserRole;
  school_id: string | null;
  parent_id: string | null;
  merchant_id: string | null;
  created_at: string;
}

export interface Merchant {
  id: string;
  school_id: string;
  name: string;
  pic_name: string | null;
  bni_merchant_account: string;
  status: MerchantStatus;
  created_at: string;
}

export interface Student {
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
}

export interface GuardianStudentMap {
  id: string;
  parent_id: string;
  student_id: string;
  relationship: string | null;
  is_primary_guardian: boolean;
  created_at: string;
}

export interface StudentVault {
  id: string;
  student_id: string;
  vault_balance: number;
  savings_goal_name: string | null;
  savings_goal_target: number | null;
  updated_at: string;
}

export interface TransactionItem {
  menu: string;
  qty: number;
  price: number;
}

export interface CanteenTransaction {
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
}

export interface SPPInvoice {
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
}

export interface WalletLedgerEntry {
  id: string;
  account_type: AccountType;
  account_ref_id: string;
  entry_type: EntryType;
  amount: number;
  balance_after: number;
  reference_table: string;
  reference_id: string;
  created_at: string;
}

export interface IdempotencyKey {
  id: string;
  key: string;
  endpoint: string;
  response_snapshot: Record<string, unknown> | null;
  status: IdempotencyStatus;
  created_at: string;
  expires_at: string;
}

export interface OfflineSyncQueue {
  id: string;
  merchant_id: string;
  local_tx_uuid: string;
  payload: Record<string, unknown>;
  sync_status: SyncStatus;
  created_at: string;
  synced_at: string | null;
}

export interface CardLifecycleEvent {
  id: string;
  student_id: string;
  event_type: CardEventType;
  notes: string | null;
  actor_profile_id: string | null;
  created_at: string;
}

export interface ParentalConsent {
  id: string;
  parent_id: string;
  student_id: string;
  consent_type: string;
  consent_token: string;
  granted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_profile_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  flag: AuditFlag | null;
  ip_address: string | null;
  created_at: string;
}

export interface AIChatLog {
  id: string;
  persona_type: PersonaType;
  actor_profile_id: string | null;
  prompt: string;
  response: string;
  function_calls: Record<string, unknown> | null;
  created_at: string;
}

// ─── API Request / Response Types ────────────────────────────

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

export interface PaguUpdateRequest {
  daily_limit: number;
}

export interface EmergencyToggleRequest {
  emergency_approve: boolean;
}

export interface VaultWithdrawalRequest {
  amount: number;
  reason?: string;
}

export interface StudentRegistrationRequest {
  full_name: string;
  raw_nfc_uid: string;
  parent_phone: string;
  parent_bni_account: string;
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

export interface OfflineQueueSyncRequest {
  transactions: OfflineQueuePayload[];
}

export interface OfflineQueueSyncResult {
  local_tx_uuid: string;
  status: TransactionStatus | 'CONFLICT' | 'DISCARDED';
  transaction_id?: string;
}

// ─── AI Types ────────────────────────────────────────────────

export interface AIChatRequest {
  messages: { role: 'user' | 'assistant'; content: string }[];
  context?: Record<string, unknown>;
}

// ─── Supabase Database Schema Type ────────────────────────────

export interface Database {
  public: {
    Tables: {
      schools:               { Row: School };
      parents:               { Row: Parent };
      profiles:              { Row: Profile };
      merchants:             { Row: Merchant };
      students:              { Row: Student };
      guardian_student_map:  { Row: GuardianStudentMap };
      student_vault:         { Row: StudentVault };
      canteen_transactions:  { Row: CanteenTransaction };
      spp_invoices:          { Row: SPPInvoice };
      wallet_ledger:         { Row: WalletLedgerEntry };
      idempotency_keys:      { Row: IdempotencyKey };
      offline_sync_queue:    { Row: OfflineSyncQueue };
      card_lifecycle_events: { Row: CardLifecycleEvent };
      parental_consent:      { Row: ParentalConsent };
      audit_log:             { Row: AuditLog };
      ai_chat_logs:          { Row: AIChatLog };
    };
  };
}
