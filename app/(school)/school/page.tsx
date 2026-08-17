import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { DashboardHeader } from "@/components/school/dashboard/DashboardHeader";
import { DashboardFilters } from "@/components/school/dashboard/DashboardFilters";
import { KPIRow } from "@/components/school/dashboard/KPIRow";
import { CashflowChart } from "@/components/school/dashboard/CashflowChart";
import { TuitionCollectionWidget } from "@/components/school/dashboard/TuitionCollectionWidget";
import { TuitionAgingWidget } from "@/components/school/dashboard/TuitionAgingWidget";
import { FinancialAlertsPanel } from "@/components/school/dashboard/FinancialAlertsPanel";
import { PaymentForecastChart } from "@/components/school/dashboard/PaymentForecastChart";
import { BudgetUtilizationWidget } from "@/components/school/dashboard/BudgetUtilizationWidget";
import { QuickAIChatWidget } from "@/components/school/dashboard/QuickAIChatWidget";
import { RecentActivityTable } from "@/components/school/dashboard/RecentActivityTable";

import {
  getCashflowSeries,
  getTuitionAging,
  getTuitionKpi,
  getBudgetVsActual,
  getPaymentForecast,
  getRecentActivity,
  getPayrollObligation,
  getPendingProcurementCount,
  deriveAlerts,
} from "@/lib/school/dashboard-queries";

export const metadata: Metadata = {
  title: "Executive Financial Dashboard | BNI EduConnect",
  description: "Dashboard Manajemen Keuangan & Treasury Sekolah BNI H2H",
};

interface PageProps {
  searchParams: Promise<{
    ay?: string;
    range?: string;
  }>;
}

export default async function SchoolDashboardPage({ searchParams }: PageProps) {
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

  // Fetch school details
  const { data: school } = await service
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .single();

  const resolvedSearchParams = await searchParams;
  const currentAy = resolvedSearchParams.ay || "2024/2025";
  const currentRange = resolvedSearchParams.range || "30d";

  // Concurrent data fetching
  const cashflowSeries = await getCashflowSeries(service, schoolId, currentRange);
  const agingData = await getTuitionAging(service, schoolId);

  const [kpiData, budgetRows, forecastData, activityRows, payrollObligation, pendingProcurementCount] =
    await Promise.all([
      getTuitionKpi(service, schoolId, cashflowSeries),
      getBudgetVsActual(service, schoolId, currentAy),
      getPaymentForecast(service, schoolId),
      getRecentActivity(service, schoolId),
      getPayrollObligation(service, schoolId),
      getPendingProcurementCount(service, schoolId),
    ]);

  const alerts = deriveAlerts({
    kpi: kpiData,
    budget: budgetRows,
    aging: agingData,
    cashflow: cashflowSeries,
    payrollObligation,
    pendingProcurementCount,
  });

  const now = new Date();
  const lastUpdatedStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <DashboardHeader schoolName={school?.name ?? "SMA BNI Harapan Bangsa"} lastUpdated={lastUpdatedStr} />

      {/* Filters */}
      <DashboardFilters
        academicYears={["2024/2025", "2023/2024", "2025/2026"]}
        currentAy={currentAy}
        currentRange={currentRange}
      />

      {/* Row 1: Top 5 KPIs with Sparklines */}
      <KPIRow metrics={kpiData.metrics} />

      {/* Row 2: Visualizations (Grid 12) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 flex flex-col">
          <CashflowChart series={cashflowSeries} />
        </div>
        <div className="lg:col-span-4 flex flex-col space-y-5">
          <TuitionCollectionWidget
            totalBilling={kpiData.totalBilling}
            collectedAmount={kpiData.collectedAmount}
            outstandingAmount={kpiData.outstandingAmount}
            overdueAmount={kpiData.overdueAmount}
            collectionRatePct={kpiData.collectionRatePct}
          />
          <TuitionAgingWidget buckets={agingData.buckets} />
        </div>
        <div className="lg:col-span-3 flex flex-col">
          <FinancialAlertsPanel alerts={alerts} />
        </div>
      </div>

      {/* Row 3: Operations & AI (Grid 12) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4 flex flex-col">
          <PaymentForecastChart
            points={forecastData.points}
            expectedNext30Days={forecastData.expectedNext30Days}
            confidenceLevel={forecastData.confidenceLevel}
          />
        </div>
        <div className="lg:col-span-5 flex flex-col">
          <BudgetUtilizationWidget rows={budgetRows} fiscalYear={currentAy} />
        </div>
        <div className="lg:col-span-3 flex flex-col">
          <QuickAIChatWidget />
        </div>
      </div>

      {/* Row 4: Recent Activity Table */}
      <RecentActivityTable rows={activityRows} />
    </div>
  );
}
