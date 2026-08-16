// lib/finance/calculations.ts

/**
 * Calculate flat/annuity monthly loan installment for BNI Working Capital Credit.
 */
export function calculateMonthlyInstallment(
  plafonAmount: number,
  annualInterestRatePct: number,
  tenorMonths: number
): number {
  const r = annualInterestRatePct / 100 / 12; // monthly interest rate
  if (r === 0) return Math.round(plafonAmount / tenorMonths);
  const factor = (r * Math.pow(1 + r, tenorMonths)) / (Math.pow(1 + r, tenorMonths) - 1);
  return Math.round(plafonAmount * factor);
}

export interface RunwayInput {
  currentLiquidity: number; // Current Giro + Escrow total balance
  monthlyOperationalExpense: number;
  expectedMonthlyTuitionGross: number; // Monthly gross tuition billing
  collectionRatePct: number; // 0..100, assumed collection rate percentage
  monthlyInvestmentYield?: number; // Passive monthly yields from investments (Enhancement 7)
}

export interface RunwayResult {
  netMonthlyCashflow: number;
  runwayMonths: number | null; // null means infinite runway (cashflow positive)
}

/**
 * Calculate financial runway simulation incorporating tuition collection rates & investment yields.
 */
export function calculateRunway(input: RunwayInput): RunwayResult {
  const collected = input.expectedMonthlyTuitionGross * (input.collectionRatePct / 100);
  const totalInflow = collected + (input.monthlyInvestmentYield || 0);
  const netMonthlyCashflow = totalInflow - input.monthlyOperationalExpense;

  if (netMonthlyCashflow >= 0) {
    return { netMonthlyCashflow, runwayMonths: null };
  }

  const runwayMonths = input.currentLiquidity / Math.abs(netMonthlyCashflow);
  return {
    netMonthlyCashflow,
    runwayMonths: Math.max(0, Math.floor(runwayMonths * 10) / 10),
  };
}
