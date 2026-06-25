/**
 * Amortización de gastos por quincena. FUNCIÓN PURA.
 *
 * Regla de negocio (confirmada con el dueño): un gasto mensual o puntual NO se
 * divide entre 2 fijo; se reparte entre TODAS las quincenas que faltan hasta su
 * fecha de cobro, contando la quincena actual y la del cobro (span inclusivo).
 *   provisión por quincena = round(monto / quincenas_del_span)
 */
import { format, getDaysInMonth, startOfDay } from 'date-fns';

import { getQuincena, quincenaIndex } from './cycle';

export interface ExpenseProvision {
  /** Cuántas quincenas abarca el reparto (≥ 1). */
  quincenasSpan: number;
  /** Cuánto apartar por quincena, centavos enteros. */
  perQuincenaCents: number;
}

/**
 * Reparte `amountCents` entre las quincenas desde la de `from` hasta la de
 * `due`, ambas inclusive. Si `due` ya pasó, el span es 1 (apartar todo ya).
 */
export function expenseProvision(amountCents: number, due: Date, from: Date): ExpenseProvision {
  const span = quincenaIndex(getQuincena(due)) - quincenaIndex(getQuincena(from)) + 1;
  const quincenasSpan = Math.max(1, span);
  return {
    quincenasSpan,
    perQuincenaCents: Math.round(amountCents / quincenasSpan),
  };
}

/**
 * Próxima ocurrencia de un día del mes (1–31) en o después de `from`.
 * Si el mes no tiene ese día (ej. 31 en febrero), clampa al último día.
 */
export function nextMonthlyDue(from: Date, dueDay: number): Date {
  const y = from.getFullYear();
  const m = from.getMonth();
  const dimThis = getDaysInMonth(new Date(y, m, 1));
  const candidate = new Date(y, m, Math.min(dueDay, dimThis));
  if (candidate >= startOfDay(from)) return candidate;
  const dimNext = getDaysInMonth(new Date(y, m + 1, 1));
  return new Date(y, m + 1, Math.min(dueDay, dimNext));
}

export interface MonthlyExpenseProvision extends ExpenseProvision {
  /** Fecha de cobro calculada, 'yyyy-MM-dd'. */
  due: string;
}

/**
 * Provisión por quincena de un gasto mensual con `dueDay`, visto desde `from`.
 * Calcula la próxima fecha de cobro y amortiza hasta ahí.
 */
export function monthlyExpenseProvision(
  amountCents: number,
  dueDay: number,
  from: Date,
): MonthlyExpenseProvision {
  const due = nextMonthlyDue(from, dueDay);
  return { ...expenseProvision(amountCents, due, from), due: format(due, 'yyyy-MM-dd') };
}
