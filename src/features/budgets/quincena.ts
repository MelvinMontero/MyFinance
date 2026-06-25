/**
 * Presupuesto de UNA quincena real (no dividir el mes entre 2).
 *
 * - Ingresos: ocurrencias cuyo `occurred_at` cae en [startDate, endDate].
 * - Gastos fijos: cada gasto mensual activo se AMORTIZA — su provisión de esta
 *   quincena = monto repartido entre las quincenas que faltan hasta su cobro
 *   (regla confirmada con el dueño; ver features/cycle/expense.ts).
 * - Gastos variables: los del rango de fechas de la quincena.
 * - Metas: `goalsReserveAmount` lo pasa el caller (suma de cuotas sugeridas).
 */
import { parseISO } from 'date-fns';

import { monthlyExpenseProvision } from '@/features/cycle/expense';
import type { Quincena } from '@/features/cycle/cycle';
import { getDb } from '@/shared/db';

import { calculateBuckets, type BucketBreakdown } from './calculate';

export interface ExpenseProvisionRow {
  id: string;
  name: string;
  /** Monto a apartar ESTA quincena, centavos enteros. */
  amountCents: number;
  /** Fecha de cobro calculada, 'yyyy-MM-dd'. */
  due: string;
  /** Entre cuántas quincenas se reparte (1 = todo esta quincena). */
  quincenasSpan: number;
}

export interface QuincenaBudget extends BucketBreakdown {
  quincena: Quincena;
  /** Provisión por gasto fijo, para el desglose "¿cuánto aparto?". */
  expenseProvisions: ExpenseProvisionRow[];
  /** Códigos ISO de otras monedas con registros activos (no incluidas). */
  otherCurrenciesPresent: string[];
}

interface FixedExpenseLite {
  id: string;
  name: string;
  amount_cents: number;
  due_day: number;
}

/**
 * Calcula los sobres de la quincena `quincena` en `currency`.
 * `savingsPercent` aplica sobre el ingreso de ESTA quincena.
 * `goalsReserveAmount` es la suma de cuotas de metas sugeridas (Fase D).
 */
export async function getQuincenaBudget(
  quincena: Quincena,
  currency: string,
  savingsPercent: number,
  goalsReserveAmount: number,
): Promise<QuincenaBudget> {
  const db = await getDb();
  const { period, startDate, endDate } = quincena;
  const from = parseISO(startDate);

  const incomeRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(io.amount_cents), 0) AS total
       FROM income_occurrences io
       JOIN incomes i ON i.id = io.income_id
      WHERE io.occurred_at >= ? AND io.occurred_at <= ?
        AND i.currency = ?
        AND i.is_active = 1`,
    startDate,
    endDate,
    currency,
  );

  // Gastos fijos vigentes este mes, en esta moneda. Cada uno se amortiza.
  const fixedRows = await db.getAllAsync<FixedExpenseLite>(
    `SELECT id, name, amount_cents, due_day
       FROM fixed_expenses
      WHERE is_active = 1
        AND currency = ?
        AND substr(start_date, 1, 7) <= ?
        AND (end_date IS NULL OR substr(end_date, 1, 7) >= ?)
      ORDER BY due_day ASC`,
    currency,
    period,
    period,
  );

  const expenseProvisions: ExpenseProvisionRow[] = fixedRows.map((e) => {
    const prov = monthlyExpenseProvision(e.amount_cents, e.due_day, from);
    return {
      id: e.id,
      name: e.name,
      amountCents: prov.perQuincenaCents,
      due: prov.due,
      quincenasSpan: prov.quincenasSpan,
    };
  });
  const fixedProvisionTotal = expenseProvisions.reduce((sum, e) => sum + e.amountCents, 0);

  const variableRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount_cents), 0) AS total
       FROM variable_expenses
      WHERE occurred_at >= ? AND occurred_at <= ?
        AND currency = ?`,
    startDate,
    endDate,
    currency,
  );

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
    fixedExpensesAmount: fixedProvisionTotal,
    variableExpensesAmount: variableRow?.total ?? 0,
    goalsReserveAmount,
  });

  return {
    ...breakdown,
    quincena,
    expenseProvisions,
    otherCurrenciesPresent: otherRows.map((r) => r.currency),
  };
}
