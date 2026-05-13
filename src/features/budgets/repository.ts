import { getDb } from '@/shared/db';

import { calculateBuckets, type BucketBreakdown } from './calculate';

export interface BudgetForPeriod extends BucketBreakdown {
  /** Códigos ISO de otras monedas con registros activos (no incluidas en este cálculo). */
  otherCurrenciesPresent: string[];
}

/**
 * Calcula los sobres para un período (yyyy-MM) en una moneda específica.
 * Records en otras monedas se EXCLUYEN — sumar dólares y colones daría
 * un total sin sentido. Se devuelven en `otherCurrenciesPresent` para
 * que la UI muestre un aviso.
 */
export async function getBudgetForPeriod(
  period: string,
  currency: string,
  savingsPercent: number,
): Promise<BudgetForPeriod> {
  const db = await getDb();

  // INGRESOS: SUM de income_occurrences cuyo income padre está en esta moneda.
  const incomeRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(io.amount_cents), 0) AS total
       FROM income_occurrences io
       JOIN incomes i ON i.id = io.income_id
      WHERE substr(io.occurred_at, 1, 7) = ?
        AND i.currency = ?
        AND i.is_active = 1`,
    period,
    currency,
  );

  // GASTOS FIJOS: solo los que están vigentes en este período.
  // Vigente = start_date <= período Y (end_date IS NULL OR end_date >= período).
  // Comparamos por substring 'YYYY-MM' que ordena lexicográficamente.
  // Un gasto agendado para el futuro (start_date posterior al período actual)
  // aparece en la lista de Fijos con un badge "Empieza en …" pero NO cuenta
  // todavía en el presupuesto del mes.
  const fixedRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount_cents), 0) AS total
       FROM fixed_expenses
      WHERE is_active = 1
        AND currency = ?
        AND substr(start_date, 1, 7) <= ?
        AND (end_date IS NULL OR substr(end_date, 1, 7) >= ?)`,
    currency,
    period,
    period,
  );

  // GASTOS VARIABLES: SUM del período en la moneda. (Fase 5 — por ahora siempre 0.)
  const variableRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount_cents), 0) AS total
       FROM variable_expenses
      WHERE substr(occurred_at, 1, 7) = ?
        AND currency = ?`,
    period,
    currency,
  );

  // OTRAS MONEDAS: códigos distintos al actual con registros activos.
  const otherRows = await db.getAllAsync<{ currency: string }>(
    `SELECT DISTINCT currency FROM (
        SELECT currency FROM incomes        WHERE is_active = 1 AND currency != ?
        UNION
        SELECT currency FROM fixed_expenses WHERE is_active = 1 AND currency != ?
      )
      ORDER BY currency ASC`,
    currency,
    currency,
  );

  const breakdown = calculateBuckets({
    incomeAmount: incomeRow?.total ?? 0,
    savingsPercent,
    fixedExpensesAmount: fixedRow?.total ?? 0,
    variableExpensesAmount: variableRow?.total ?? 0,
  });

  return {
    ...breakdown,
    otherCurrenciesPresent: otherRows.map((r) => r.currency),
  };
}
