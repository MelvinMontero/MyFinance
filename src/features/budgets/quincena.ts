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

import { getQuincena, type Quincena } from '@/features/cycle/cycle';
import { monthlyExpenseProvision } from '@/features/cycle/expense';
import { getGoalsReserve } from '@/features/goals/repository';
import { getDb } from '@/shared/db';

import { calculateBuckets, type BucketBreakdown } from './calculate';

export interface ExpenseProvisionRow {
  id: string;
  name: string;
  /** Monto a apartar ESTA quincena, centavos enteros (0 si ya está pagado). */
  amountCents: number;
  /** Fecha de cobro calculada, 'yyyy-MM-dd'. */
  due: string;
  /** Entre cuántas quincenas se reparte (1 = todo esta quincena). */
  quincenasSpan: number;
  /** Ya marcado como pagado este mes → no hay que apartar más. */
  paid: boolean;
}

export interface QuincenaBudget extends BucketBreakdown {
  quincena: Quincena;
  /** Provisión por gasto fijo, para el desglose "¿cuánto aparto?". */
  expenseProvisions: ExpenseProvisionRow[];
  /** Códigos ISO de otras monedas con registros activos (no incluidas). */
  otherCurrenciesPresent: string[];
  /** Ingreso de la quincena proyectado pero AÚN SIN CONFIRMAR (no cuenta como disponible). */
  pendingIncome: number;
}

interface FixedExpenseLite {
  id: string;
  name: string;
  amount_cents: number;
  due_day: number;
  paid: number;
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

  // Solo cuenta el ingreso CONFIRMADO (recibido). Lo proyectado sin confirmar
  // se reporta aparte en `pendingIncome` y no infla los sobres.
  const incomeRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(io.amount_cents), 0) AS total
       FROM income_occurrences io
       JOIN incomes i ON i.id = io.income_id
      WHERE io.occurred_at >= ? AND io.occurred_at <= ?
        AND i.currency = ?
        AND i.is_active = 1
        AND io.is_confirmed = 1`,
    startDate,
    endDate,
    currency,
  );

  const pendingRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(io.amount_cents), 0) AS total
       FROM income_occurrences io
       JOIN incomes i ON i.id = io.income_id
      WHERE io.occurred_at >= ? AND io.occurred_at <= ?
        AND i.currency = ?
        AND i.is_active = 1
        AND io.is_confirmed = 0`,
    startDate,
    endDate,
    currency,
  );

  // Gastos fijos vigentes este mes, en esta moneda. Cada uno se amortiza.
  // LEFT JOIN con los pagos del mes: si ya está pagado, no hay que apartar más.
  const fixedRows = await db.getAllAsync<FixedExpenseLite>(
    `SELECT fe.id, fe.name, fe.amount_cents, fe.due_day,
            CASE WHEN fep.id IS NULL THEN 0 ELSE 1 END AS paid
       FROM fixed_expenses fe
       LEFT JOIN fixed_expense_payments fep
              ON fep.fixed_expense_id = fe.id AND fep.period = ?
      WHERE fe.is_active = 1
        AND fe.currency = ?
        AND substr(fe.start_date, 1, 7) <= ?
        AND (fe.end_date IS NULL OR substr(fe.end_date, 1, 7) >= ?)
      ORDER BY fe.due_day ASC`,
    period,
    currency,
    period,
    period,
  );

  const expenseProvisions: ExpenseProvisionRow[] = fixedRows.map((e) => {
    const isPaid = e.paid === 1;
    const prov = monthlyExpenseProvision(e.amount_cents, e.due_day, from);
    return {
      id: e.id,
      name: e.name,
      amountCents: isPaid ? 0 : prov.perQuincenaCents,
      due: prov.due,
      quincenasSpan: prov.quincenasSpan,
      paid: isPaid,
    };
  });
  // Lo ya pagado no cuenta como "a apartar".
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
    pendingIncome: pendingRow?.total ?? 0,
  };
}

/**
 * Sobregasto de la quincena en curso para `currency`: centavos por encima del
 * dinero libre (0 si no hay sobregasto). Útil tras registrar un gasto real.
 */
export async function getCurrentQuincenaOverspendCents(
  currency: string,
  savingsPercent: number,
): Promise<number> {
  const today = new Date();
  const quincena = getQuincena(today);
  const goalsReserve = await getGoalsReserve(today, currency);
  const qb = await getQuincenaBudget(quincena, currency, savingsPercent, goalsReserve);
  return qb.isOverspent ? Math.abs(qb.freeMoneyRemaining) : 0;
}
