// types/institution.ts

export type FeeCategoryCode = "SPP_BULANAN" | "UANG_GEDUNG" | "SERAGAM" | "KEGIATAN" | "LAINNYA";
export type PayrollStatus = "DRAFT" | "PENDING" | "PROCESSING" | "DISBURSED" | "FAILED";
export type ProcurementType = "PURCHASE_ORDER" | "REIMBURSEMENT";
export type ProcurementStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "PAID";
export type AssetKind = "NON_WORKING" | "WORKING";
export type AssetCondition = "BAIK" | "PERLU_PERBAIKAN" | "RUSAK";
export type CreditStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "DISBURSED" | "CLOSED";
export type InvestmentType = "BNI_DEPOSITO" | "SUKUK_NEGARA" | "REKSADANA_PASAR_UANG";
export type InvestmentStatus = "ACTIVE" | "MATURED" | "WITHDRAWN";

export interface FeeCategory {
  id: string;
  school_id: string;
  category: FeeCategoryCode;
  label: string;
  default_amount: number;
  is_recurring: boolean;
  is_active: boolean;
}

export interface PayslipItem {
  name: string;
  amount: number;
}

export interface PayrollBreakdownDetails {
  allowance_items: PayslipItem[];
  deduction_items: PayslipItem[];
}

export interface PayrollRecord {
  id: string;
  school_id: string;
  staff_name: string;
  nip: string | null;
  position: string;
  bni_account_number: string;
  bni_account_name: string;
  period: string; // YYYY-MM
  basic_salary: number;
  allowances: number;
  deductions: number;
  net_salary: number; // generated column, read-only
  breakdown_details?: PayrollBreakdownDetails;
  status: PayrollStatus;
  batch_id: string | null;
  bni_h2h_reference: string | null;
  paid_at: string | null;
  failure_reason: string | null;
}

export interface PayrollBatchExecuteRequest {
  school_id: string;
  period: string; // YYYY-MM
  idempotency_key: string; // client-generated UUID
}

export interface PayrollBatchExecuteResponse {
  batch_id: string;
  period: string;
  staff_disbursed: number;
  total_amount: number;
}

export interface OcrExtractionResult {
  vendor_guess: string;
  date_guess: string; // YYYY-MM-DD
  total_guess: number;
  items: string[];
  confidence: number; // 0..1
}

export interface ProcurementItem {
  id: string;
  school_id: string;
  type: ProcurementType;
  requested_by: string | null;
  claimed_by_name: string | null;
  claimed_by_phone: string | null;
  vendor_name: string;
  category: string;
  description: string | null;
  amount: number;
  status: ProcurementStatus;
  receipt_file_path: string | null;
  ocr_raw_json: OcrExtractionResult | null;
  ocr_confidence: number | null;
  reviewed_vendor_name: string | null;
  reviewed_date: string | null;
  reviewed_amount: number | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  paid_at: string | null;
}

export interface ProcurementResolveRequest {
  procurement_id: string;
  decision: "APPROVE" | "REJECT";
  rejection_reason?: string;
  idempotency_key: string;
}

export interface InstitutionAsset {
  id: string;
  school_id: string;
  kind: AssetKind;
  merchant_id: string | null;
  asset_name: string;
  asset_code: string | null;
  category: string;
  location: string | null;
  quantity: number;
  condition: AssetCondition;
  acquisition_date: string | null;
  acquisition_value: number | null;
  merchants?: { name: string } | null;
}

export interface CreditApplication {
  id: string;
  school_id: string;
  plafon_amount: number;
  tenor_months: number;
  purpose: string;
  estimated_interest_rate: number;
  estimated_monthly_installment: number | null;
  status: CreditStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  disbursed_at: string | null;
}

export interface InvestmentPosition {
  id: string;
  school_id: string;
  investment_type: InvestmentType;
  principal_amount: number;
  expected_yield_rate: number;
  accumulated_yield: number;
  placement_date: string;
  maturity_date: string | null;
  status: InvestmentStatus;
}

export interface ApiErrorResponse {
  error: string;
  http_status: number;
  detail?: string;
}
