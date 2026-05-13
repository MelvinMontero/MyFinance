import { getBudgetForPeriod } from '@/features/budgets/repository';
import type { BucketBreakdown } from '@/features/budgets/calculate';
import { getDb } from '@/shared/db';

/** Suma de gastos variables por categoría en un período. */
export interface CategoryBreakdown {
  category_id: string;
  name: string;
  icon: string;
  color: string;
  amount_cents: number;
  count: number;
}

/**
 * Lista categorías con su total de gastos variables en el período/moneda,
 * ordenadas de mayor a menor monto. Excluye categorías sin gastos.
 */
export async function getMonthlyVariableBreakdown(
  period: string,
  currency: string,
): Promise<CategoryBreakdown[]> {
  const db = await getDb();
  return db.getAllAsync<CategoryBreakdown>(
    `SELECT
       ve.category_id,
       c.name,
       c.icon,
       c.color,
       SUM(ve.amount_cents) as amount_cents,
       COUNT(*) as count
     FROM variable_expenses ve
     JOIN categories c ON c.id = ve.category_id
     WHERE substr(ve.occurred_at, 1, 7) = ?
       AND ve.currency = ?
     GROUP BY ve.category_id, c.name, c.icon, c.color
     ORDER BY amount_cents DESC`,
    period,
    currency,
  );
}

/** Resultado de getBudgetForPeriod + el período al que corresponde. */
export interface MonthlyBudgetEntry extends BucketBreakdown {
  period: string;
}

/**
 * Devuelve el desglose de sobres para los 12 meses del año.
 * Iterativo (12 llamadas a getBudgetForPeriod) — para Phase 6 MVP es OK,
 * cada query es de < 5ms en SQLite. Optimización con CTE en Phase 7 si hace falta.
 */
export async function getYearlyBudget(
  year: string,
  currency: string,
  savingsPercent: number,
): Promise<MonthlyBudgetEntry[]> {
  const months: MonthlyBudgetEntry[] = [];
  for (let m = 1; m <= 12; m++) {
    const period = `${year}-${String(m).padStart(2, '0')}`;
    const budget = await getBudgetForPeriod(period, currency, savingsPercent);
    months.push({ ...budget, period });
  }
  return months;
}

export interface YearlyKpis {
  totalSavingsTarget: number; // ahorro objetivo acumulado del año
  totalFixedSpent: number;
  totalVariableSpent: number;
  totalIncome: number;
  highestSpendMonth: { period: string; amount: number } | null;
  averageMonthlyVariableSpend: number;
}

export async function getYearlyKpis(
  year: string,
  currency: string,
  savingsPercent: number,
): Promise<YearlyKpis> {
  const months = await getYearlyBudget(year, currency, savingsPercent);
  let totalSavings = 0;
  let totalFixed = 0;
  let totalVariable = 0;
  let totalIncome = 0;
  let monthsWithVariableSpend = 0;
  let highestSpendMonth: { period: string; amount: number } | null = null;

  for (const m of months) {
    totalSavings += m.savings;
    totalFixed += m.fixedExpenses;
    totalVariable += m.variableExpensesSpent;
    totalIncome += m.income;
    if (m.variableExpensesSpent > 0) monthsWithVariableSpend++;

    const monthOutflow = m.fixedExpenses + m.variableExpensesSpent;
    if (monthOutflow > 0 && (!highestSpendMonth || monthOutflow > highestSpendMonth.amount)) {
      highestSpendMonth = { period: m.period, amount: monthOutflow };
    }
  }

  return {
    totalSavingsTarget: totalSavings,
    totalFixedSpent: totalFixed,
    totalVariableSpent: totalVariable,
    totalIncome,
    highestSpendMonth,
    averageMonthlyVariableSpend:
      monthsWithVariableSpend > 0
        ? Math.round(totalVariable / monthsWithVariableSpend)
        : 0,
  };
}
