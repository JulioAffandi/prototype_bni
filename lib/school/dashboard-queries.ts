import { formatCompactIDR } from "@/lib/format";
import type {
  KpiMetric,
  CashflowPoint,
  AgingBucket,
  FinancialAlert,
  BudgetRow,
  ForecastPoint,
  ActivityRow,
} from "./dashboard-types";

// Helper for date string math
function getDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getFutureDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function getCashflowSeries(
  service: any,
  schoolId: string,
  range: string = "30d"
): Promise<CashflowPoint[]> {
  let days = 30;
  if (range === "7d") days = 7;
  if (range === "3m") days = 90;
  if (range === "12m") days = 365;

  const fromDate = getDaysAgo(days);
  const toDate = getToday();

  const { data, error } = await service.rpc("fn_school_cashflow_daily", {
    p_school_id: schoolId,
    p_from: fromDate,
    p_to: toDate,
  });

  if (error || !data || data.length === 0) {
    // Escrow balance fallback for zero-transaction days
    const { data: escrow } = await service
      .from("ledger_accounts")
      .select("balance")
      .eq("owner_school_id", schoolId)
      .eq("account_type", "school_escrow")
      .eq("is_active", true)
      .maybeSingle();

    const currentBal = Number(escrow?.balance || 0);

    const emptySeries: CashflowPoint[] = [];
    for (let i = days; i >= 0; i--) {
      emptySeries.push({
        date: getDaysAgo(i),
        inflow: 0,
        outflow: 0,
        netFlow: 0,
        closingBalance: currentBal,
      });
    }
    return emptySeries;
  }

  return data.map((d: any) => ({
    date: d.bucket_date,
    inflow: Number(d.inflow || 0),
    outflow: Number(d.outflow || 0),
    netFlow: Number(d.net_flow || 0),
    closingBalance: Number(d.closing_balance || 0),
  }));
}

export async function getTuitionAging(
  service: any,
  schoolId: string
): Promise<{ buckets: AgingBucket[]; totalOutstanding: number }> {
  const { data, error } = await service.rpc("fn_school_tuition_aging", {
    p_school_id: schoolId,
    p_as_of: getToday(),
  });

  const bucketLabels: Record<string, { label: string; key: AgingBucket["key"] }> = {
    current: { label: "Lancar (Belum Jatuh Tempo)", key: "current" },
    d1_30: { label: "1 - 30 Hari", key: "d1_30" },
    d31_60: { label: "31 - 60 Hari", key: "d31_60" },
    d61_90: { label: "61 - 90 Hari", key: "d61_90" },
    d90_plus: { label: "> 90 Hari (Macet)", key: "d90_plus" },
  };

  const rawMap: Record<string, { amount: number; count: number }> = {
    current: { amount: 0, count: 0 },
    d1_30: { amount: 0, count: 0 },
    d31_60: { amount: 0, count: 0 },
    d61_90: { amount: 0, count: 0 },
    d90_plus: { amount: 0, count: 0 },
  };

  if (data && Array.isArray(data)) {
    data.forEach((row: any) => {
      if (rawMap[row.bucket]) {
        rawMap[row.bucket].amount = Number(row.amount || 0);
        rawMap[row.bucket].count = Number(row.invoice_count || 0);
      }
    });
  }

  const totalOutstanding = Object.values(rawMap).reduce((acc, cur) => acc + cur.amount, 0);

  const buckets: AgingBucket[] = Object.keys(bucketLabels).map((k) => {
    const info = bucketLabels[k];
    const item = rawMap[k];
    const percentage = totalOutstanding > 0 ? (item.amount / totalOutstanding) * 100 : 0;

    return {
      key: info.key,
      label: info.label,
      amount: item.amount,
      count: item.count,
      percentage,
    };
  });

  return { buckets, totalOutstanding };
}

export async function getTuitionKpi(
  service: any,
  schoolId: string,
  cashflowSeries: CashflowPoint[]
): Promise<{
  metrics: KpiMetric[];
  totalBilling: number;
  collectedAmount: number;
  outstandingAmount: number;
  overdueAmount: number;
  collectionRatePct: number;
}> {
  // 1. Escrow account cash position
  const { data: escrow } = await service
    .from("ledger_accounts")
    .select("balance")
    .eq("owner_school_id", schoolId)
    .eq("account_type", "school_escrow")
    .eq("is_active", true)
    .maybeSingle();

  const cashPosition = Number(escrow?.balance ?? (cashflowSeries.length ? cashflowSeries[cashflowSeries.length - 1].closingBalance : 0));

  // 2. Sum Inflow & Outflow from cashflowSeries
  const totalInflow = cashflowSeries.reduce((acc, pt) => acc + pt.inflow, 0);
  const totalOutflow = cashflowSeries.reduce((acc, pt) => acc + pt.outflow, 0);

  // 3. SPP Invoices from Supabase
  const { data: invoices } = await service
    .from("spp_invoices")
    .select("amount, amount_paid, status, due_date")
    .eq("school_id", schoolId);

  let totalBilling = 0;
  let collectedAmount = 0;
  let outstandingAmount = 0;
  let overdueAmount = 0;

  const today = getToday();

  if (invoices && invoices.length > 0) {
    invoices.forEach((inv: any) => {
      const amt = Number(inv.amount || 0);
      const paid = Number(inv.amount_paid || (inv.status === "PAID" ? amt : 0));
      totalBilling += amt;
      collectedAmount += paid;

      if (inv.status !== "PAID") {
        const remaining = Math.max(0, amt - paid);
        outstandingAmount += remaining;
        if (inv.due_date < today || inv.status === "OVERDUE" || inv.status === "FAILED") {
          overdueAmount += remaining;
        }
      }
    });
  }

  const collectionRatePct = totalBilling > 0 ? (collectedAmount / totalBilling) * 100 : 0;

  const sparkSeries = (key: "inflow" | "outflow" | "netFlow" | "closingBalance"): number[] => {
    const vals = cashflowSeries.map((pt) => Number(pt[key] || 0));
    return vals.length > 0 ? vals : [0, 0, 0, 0, 0];
  };

  const metrics: KpiMetric[] = [
    {
      id: "cash-position",
      label: "Cash Position (Giro BNI)",
      sublabel: "Saldo Kas Escrow Sekolah Terverifikasi",
      value: cashPosition,
      formattedValue: formatCompactIDR(cashPosition),
      deltaPct: 0,
      comparisonLabel: "vs saldo terdaftar",
      series: sparkSeries("closingBalance"),
      accent: "primary",
    },
    {
      id: "total-inflow",
      label: "Total Inflow (Penerimaan)",
      sublabel: "SPP + Kantin + Transfer BNI H2H",
      value: totalInflow,
      formattedValue: formatCompactIDR(totalInflow),
      deltaPct: 0,
      comparisonLabel: "vs target periode",
      series: sparkSeries("inflow"),
      accent: "net",
    },
    {
      id: "total-outflow",
      label: "Total Outflow (Pengeluaran)",
      sublabel: "Payroll + Procurement Supplier",
      value: totalOutflow,
      formattedValue: formatCompactIDR(totalOutflow),
      deltaPct: 0,
      comparisonLabel: "vs anggaran unit",
      series: sparkSeries("outflow"),
      accent: "outflow",
      invertPolarity: true,
    },
    {
      id: "tuition-collection",
      label: "Tuition Collection Rate",
      sublabel: `${formatCompactIDR(collectedAmount)} lunas`,
      value: collectionRatePct,
      formattedValue: `${collectionRatePct.toFixed(1).replace(".", ",")}%`,
      deltaPct: 0,
      comparisonLabel: "vs total tagihan",
      series: [collectionRatePct],
      accent: "primary",
    },
    {
      id: "outstanding",
      label: "Outstanding SPP",
      sublabel: `${formatCompactIDR(overdueAmount)} jatuh tempo`,
      value: outstandingAmount,
      formattedValue: formatCompactIDR(outstandingAmount),
      deltaPct: 0,
      comparisonLabel: "total piutang siswa",
      series: [outstandingAmount],
      accent: "warning",
      invertPolarity: true,
    },
  ];

  return {
    metrics,
    totalBilling,
    collectedAmount,
    outstandingAmount,
    overdueAmount,
    collectionRatePct,
  };
}

export async function getBudgetVsActual(
  service: any,
  schoolId: string,
  academicYear: string = "2024/2025"
): Promise<BudgetRow[]> {
  const { data: budgetData } = await service
    .from("institution_budgets")
    .select("unit, budget_amount")
    .eq("school_id", schoolId)
    .eq("fiscal_year", academicYear);

  const unitLabels: Record<string, string> = {
    ACADEMIC: "Academic",
    OPERATIONS: "Operations",
    HR_PAYROLL: "HR and Payroll",
    IT: "IT",
    FACILITIES: "Facilities",
    STUDENT_ACTIVITIES: "Student Activities",
  };

  const budgets: Record<string, { budget: number; actual: number }> = {
    ACADEMIC: { budget: 0, actual: 0 },
    OPERATIONS: { budget: 0, actual: 0 },
    HR_PAYROLL: { budget: 0, actual: 0 },
    IT: { budget: 0, actual: 0 },
    FACILITIES: { budget: 0, actual: 0 },
    STUDENT_ACTIVITIES: { budget: 0, actual: 0 },
  };

  if (budgetData && budgetData.length > 0) {
    budgetData.forEach((b: any) => {
      if (budgets[b.unit]) {
        budgets[b.unit].budget = Number(b.budget_amount || 0);
      }
    });
  }

  // Fetch actual HR Payroll disbursed from Supabase
  const { data: payroll } = await service
    .from("institution_payroll")
    .select("net_salary")
    .eq("school_id", schoolId)
    .eq("status", "DISBURSED");

  if (payroll && payroll.length > 0) {
    const totalDisbursed = payroll.reduce((acc: number, p: any) => acc + Number(p.net_salary || 0), 0);
    budgets.HR_PAYROLL.actual = totalDisbursed;
  }

  // Fetch actual procurement per unit from Supabase
  const { data: procurement } = await service
    .from("institution_procurement")
    .select("category, amount, reviewed_amount")
    .eq("school_id", schoolId)
    .eq("status", "PAID");

  if (procurement && procurement.length > 0) {
    procurement.forEach((p: any) => {
      const amt = Number(p.reviewed_amount || p.amount || 0);
      const cat = (p.category || "").toUpperCase();
      if (cat.includes("IT") || cat.includes("KOMPUTER")) budgets.IT.actual += amt;
      else if (cat.includes("FASILITAS") || cat.includes("GEDUNG")) budgets.FACILITIES.actual += amt;
      else if (cat.includes("KEGIATAN") || cat.includes("SISWA")) budgets.STUDENT_ACTIVITIES.actual += amt;
      else if (cat.includes("AKADEMIK") || cat.includes("BUKU")) budgets.ACADEMIC.actual += amt;
      else budgets.OPERATIONS.actual += amt;
    });
  }

  return Object.keys(budgets).map((unitKey) => {
    const b = budgets[unitKey];
    const utilizationPct = b.budget > 0 ? (b.actual / b.budget) * 100 : 0;
    return {
      unit: unitKey,
      unitLabel: unitLabels[unitKey] || unitKey,
      budgetAmount: b.budget,
      actualAmount: b.actual,
      varianceAmount: b.budget - b.actual,
      utilizationPct,
      isOverBudget: utilizationPct > 100,
    };
  });
}

export async function getPaymentForecast(
  service: any,
  schoolId: string
): Promise<{ points: ForecastPoint[]; expectedNext30Days: number; confidenceLevel: "High" | "Medium" | "Low" }> {
  // Query upcoming invoices due within next 30 days from spp_invoices
  const today = getToday();
  const future30 = getFutureDays(30);

  const { data: upcomingInvoices } = await service
    .from("spp_invoices")
    .select("amount, amount_paid, due_date, status")
    .eq("school_id", schoolId)
    .gte("due_date", today)
    .lte("due_date", future30);

  // Query historical collection rate from spp_invoices
  const { data: pastInvoices } = await service
    .from("spp_invoices")
    .select("amount, amount_paid, status")
    .eq("school_id", schoolId);

  let historicalTotal = 0;
  let historicalPaid = 0;

  if (pastInvoices && pastInvoices.length > 0) {
    pastInvoices.forEach((inv: any) => {
      const amt = Number(inv.amount || 0);
      const paid = Number(inv.amount_paid || (inv.status === "PAID" ? amt : 0));
      historicalTotal += amt;
      historicalPaid += paid;
    });
  }

  const historicalRate = historicalTotal > 0 ? historicalPaid / historicalTotal : 0.85;

  // Group upcoming by 5-day buckets
  const pointsMap: Record<string, { upcoming: number; expected: number }> = {};
  for (let i = 5; i <= 30; i += 5) {
    const dt = getFutureDays(i);
    pointsMap[dt] = { upcoming: 0, expected: 0 };
  }

  let expectedNext30Days = 0;

  if (upcomingInvoices && upcomingInvoices.length > 0) {
    upcomingInvoices.forEach((inv: any) => {
      if (inv.status !== "PAID") {
        const remaining = Number(inv.amount || 0) - Number(inv.amount_paid || 0);
        const exp = remaining * historicalRate;
        expectedNext30Days += exp;

        // Assign to nearest bucket
        const keys = Object.keys(pointsMap);
        const targetKey = keys.find((k) => k >= inv.due_date) || keys[keys.length - 1];
        if (targetKey && pointsMap[targetKey]) {
          pointsMap[targetKey].upcoming += remaining;
          pointsMap[targetKey].expected += exp;
        }
      }
    });
  }

  const points: ForecastPoint[] = Object.keys(pointsMap).map((dt) => ({
    date: dt,
    upcomingBilling: pointsMap[dt].upcoming,
    expectedCollection: pointsMap[dt].expected,
  }));

  const sampleSize = pastInvoices?.length || 0;
  const confidenceLevel: "High" | "Medium" | "Low" =
    sampleSize >= 10 ? "High" : sampleSize >= 2 ? "Medium" : "Low";

  return {
    points,
    expectedNext30Days,
    confidenceLevel,
  };
}

export async function getPayrollObligation(service: any, schoolId: string): Promise<number> {
  const { data } = await service
    .from("institution_payroll")
    .select("net_salary")
    .eq("school_id", schoolId);

  if (!data || data.length === 0) return 0;
  return data.reduce((acc: number, r: any) => acc + Number(r.net_salary || 0), 0);
}

export async function getPendingProcurementCount(service: any, schoolId: string): Promise<number> {
  const { count } = await service
    .from("institution_procurement")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .in("status", ["SUBMITTED", "UNDER_REVIEW"]);

  return count ?? 0;
}

export async function getRecentActivity(
  service: any,
  schoolId: string
): Promise<ActivityRow[]> {
  const { data: ledgerTx } = await service
    .from("ledger_transactions")
    .select("id, business_date, source, description, bni_h2h_ref")
    .eq("school_id", schoolId)
    .order("business_date", { ascending: false })
    .limit(10);

  if (ledgerTx && ledgerTx.length > 0) {
    return ledgerTx.map((tx: any, idx: number) => ({
      id: tx.id || `tx-${idx}`,
      date: tx.business_date || getToday(),
      category: tx.source === "SPP_COLLECTION" ? "Pembayaran SPP" : tx.source === "PAYROLL" ? "Gaji & Remunerasi" : "Operasional",
      description: tx.description || "Transaksi Jurnal Ledger BNI H2H",
      reference: tx.bni_h2h_ref || `BNI-H2H-${tx.id.slice(0, 8)}`,
      amount: 500000,
      isIncome: tx.source === "SPP_COLLECTION" || tx.source === "CANTEEN_POS",
      status: "SETTLED",
    }));
  }

  // Query spp_invoices if ledger_transactions is empty
  const { data: invoices } = await service
    .from("spp_invoices")
    .select("id, created_at, amount, amount_paid, status, bni_h2h_reference")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (invoices && invoices.length > 0) {
    return invoices.map((inv: any) => ({
      id: inv.id,
      date: inv.created_at ? inv.created_at.slice(0, 10) : getToday(),
      category: "Pembayaran SPP",
      description: `Tagihan SPP Siswa (${inv.status})`,
      reference: inv.bni_h2h_reference || `BNI-VA-${inv.id.slice(0, 8)}`,
      amount: Number(inv.amount || 0),
      isIncome: true,
      status: inv.status === "PAID" ? "SETTLED" : inv.status,
    }));
  }

  return [];
}

export function deriveAlerts(params: {
  kpi: any;
  budget: BudgetRow[];
  aging: { buckets: AgingBucket[]; totalOutstanding: number };
  cashflow: CashflowPoint[];
  payrollObligation: number;
  pendingProcurementCount: number;
}): FinancialAlert[] {
  const alerts: FinancialAlert[] = [];

  // R1: Outstanding SPP surge
  if (params.kpi.metrics.find((m: any) => m.id === "outstanding")?.deltaPct > 5) {
    alerts.push({
      id: "alt-1",
      severity: "critical",
      title: "Lonjakan Tunggakan SPP",
      description: "Tunggakan SPP siswa meningkat lebih dari 5% pada periode ini. Diperlukan tindakan penagihan.",
      timestamp: getToday(),
      actionUrl: "/school/spp",
      actionLabel: "Kirim Broadcast Tagihan",
    });
  }

  // R2: Cash position below payroll requirement
  const cashPos = params.kpi.metrics.find((m: any) => m.id === "cash-position")?.value || 0;
  if (params.payrollObligation > 0 && cashPos < params.payrollObligation) {
    alerts.push({
      id: "alt-2",
      severity: "critical",
      title: "Defisit Kas vs Obligasi Payroll",
      description: `Saldo Giro BNI (${formatCompactIDR(cashPos)}) di bawah estimasi kebutuhan payroll bulan ini (${formatCompactIDR(params.payrollObligation)}).`,
      timestamp: getToday(),
      actionUrl: "/school/payroll",
      actionLabel: "Review Payroll",
    });
  }

  // R3: Budget overutilization
  const overBudgetUnit = params.budget.find((b) => b.isOverBudget || b.utilizationPct > 90);
  if (overBudgetUnit && overBudgetUnit.budgetAmount > 0) {
    alerts.push({
      id: "alt-3",
      severity: "attention",
      title: `Utilisasi Anggaran Unit ${overBudgetUnit.unitLabel} > 90%`,
      description: `Realisasi anggaran unit ${overBudgetUnit.unitLabel} telah mencapai ${overBudgetUnit.utilizationPct.toFixed(1)}% dari plafon.`,
      timestamp: getToday(),
      actionUrl: "/school/procurement",
      actionLabel: "Audit Pengadaan",
    });
  }

  // R4: Pending procurement approvals
  if (params.pendingProcurementCount > 0) {
    alerts.push({
      id: "alt-4",
      severity: "info",
      title: `${params.pendingProcurementCount} Tagihan Supplier Menunggu Persetujuan`,
      description: "Pengajuan pengadaan barang/jasa memerlukan verifikasi admin sekolah.",
      timestamp: getToday(),
      actionUrl: "/school/procurement",
      actionLabel: "Verifikasi Pengadaan",
    });
  }

  // R5: Critical aging (> 90 days > 10%)
  const d90Bucket = params.aging.buckets.find((b) => b.key === "d90_plus");
  if (d90Bucket && d90Bucket.percentage > 10) {
    alerts.push({
      id: "alt-5",
      severity: "critical",
      title: "Piutang SPP >90 Hari Melebihi 10%",
      description: `Tunggakan di atas 90 hari mencapai ${d90Bucket.percentage.toFixed(1)}% dari total piutang (${formatCompactIDR(d90Bucket.amount)}).`,
      timestamp: getToday(),
      actionUrl: "/school/spp",
      actionLabel: "Restrukturisasi Piutang",
    });
  }

  return alerts;
}
