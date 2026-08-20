import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { DashboardHeader } from "@/components/school/dashboard/DashboardHeader";
import { DashboardFilters } from "@/components/school/dashboard/DashboardFilters";
import { KPIRow } from "@/components/school/dashboard/KPIRow";
import { CashflowChart } from "@/components/school/dashboard/CashflowChart";
import { TuitionManagementCard } from "@/components/school/dashboard/TuitionManagementCard";
import { BudgetUtilizationWidget } from "@/components/school/dashboard/BudgetUtilizationWidget";
import { RecentActivityTable } from "@/components/school/dashboard/RecentActivityTable";
import { FinancialAlertsPanel } from "@/components/school/dashboard/FinancialAlertsPanel";

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
      {/* Header & Filter Bar */}
      <DashboardHeader schoolName={school?.name ?? "SMA BNI Harapan Bangsa"} lastUpdated={lastUpdatedStr} />
      <DashboardFilters
        academicYears={["2024/2025", "2023/2024", "2025/2026"]}
        currentAy={currentAy}
        currentRange={currentRange}
      />

      {/* ROW 1: 5 Summary KPI Cards (Uniform Height: 115px) */}
      <KPIRow metrics={kpiData.metrics} />

      {/* ROW 2: Primary Analytics (Equalized Height: 430px) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left (7 Cols): Cashflow Trend Line Chart */}
        <div className="lg:col-span-7 h-[430px] min-h-0">
          <CashflowChart series={cashflowSeries} className="h-full flex flex-col" />
        </div>

        {/* Right (5 Cols): SPP Collection & Aging Tabs/Dual Panel */}
        <div className="lg:col-span-5 h-[430px] min-h-0">
          <TuitionManagementCard
            totalBilling={kpiData.totalBilling}
            collectedAmount={kpiData.collectedAmount}
            outstandingAmount={kpiData.outstandingAmount}
            overdueAmount={kpiData.overdueAmount}
            collectionRatePct={kpiData.collectionRatePct}
            buckets={agingData.buckets}
            className="h-full flex flex-col"
          />
        </div>
      </div>

      {/* ROW 3: Secondary Operations & Feeds (Equalized Height: 380px) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left (4 Cols): Budget vs Actual Utilization */}
        <div className="lg:col-span-4 h-[380px] min-h-0">
          <BudgetUtilizationWidget rows={budgetRows} fiscalYear={currentAy} className="h-full flex flex-col" />
        </div>

        {/* Middle (5 Cols): Recent Live Transactions */}
        <div className="lg:col-span-5 h-[380px] min-h-0">
          <RecentActivityTable rows={activityRows} className="h-full flex flex-col" />
        </div>

        {/* Right (3 Cols): Financial Alerts & AI Assistant Trigger */}
        <div className="lg:col-span-3 h-[380px] min-h-0">
          <FinancialAlertsPanel alerts={alerts} className="h-full flex flex-col" />
        </div>
      </div>
    </div>
  );
}
