export interface KpiMetric {
  id: string;
  label: string;
  sublabel: string;
  value: number;
  formattedValue: string;
  deltaPct: number;
  comparisonLabel: string;
  series: number[];
  accent: "primary" | "outflow" | "net" | "warning" | "danger";
  invertPolarity?: boolean;
  iconName?: string;
}

export interface CashflowPoint {
  date: string;
  inflow: number;
  outflow: number;
  netFlow: number;
  closingBalance: number;
}

export interface AgingBucket {
  key: "current" | "d1_30" | "d31_60" | "d61_90" | "d90_plus";
  label: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface FinancialAlert {
  id: string;
  severity: "critical" | "attention" | "info";
  title: string;
  description: string;
  timestamp: string;
  actionUrl?: string;
  actionLabel?: string;
}

export interface BudgetRow {
  unit: string;
  unitLabel: string;
  budgetAmount: number;
  actualAmount: number;
  varianceAmount: number;
  utilizationPct: number;
  isOverBudget: boolean;
}

export interface ForecastPoint {
  date: string;
  actualCollection?: number;
  upcomingBilling: number;
  expectedCollection: number;
}

export interface ActivityRow {
  id: string;
  date: string;
  category: string;
  description: string;
  reference: string; // bni_h2h_reference, payroll period, or procurement ref
  amount: number;
  isIncome: boolean;
  status: "SETTLED" | "PAID" | "PENDING" | "FAILED" | "DISBURSED";
}
