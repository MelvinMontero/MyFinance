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

  // GASTOS FIJOS: SUM de TODOS los fixed_expenses activos en la moneda,
  // sin filtro de fechas de vigencia. Si el usuario crea un gasto que arranca
  // en el futuro (ej. cuota de moto que empieza en agosto), lo queremos contar
  // ya en el presupuesto del mes actual para que reserve el dinero por adelantado.
  // Para "pausar" un gasto sin borrarlo se usaría el flag is_active=0
  // (sin UI todavía — se agenda en una fase futura).
  const fixedRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount_cents), 0) AS total
       FROM fixed_expenses
      WHERE is_active = 1
        AND currency = ?`,
    currency,
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
