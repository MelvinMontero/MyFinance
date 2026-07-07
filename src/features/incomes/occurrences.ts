import { addDays, addMonths, format, isAfter, parseISO } from 'date-fns';

import { getQuincena } from '@/features/cycle/cycle';
import type { Income, IncomeOccurrence, SqliteBoolean } from '@/shared/db/types';

export interface GenerateOccurrencesOptions {
  /** Generador de IDs. Inyectable para que los tests sean deterministas. */
  generateId: () => string;
  /** Cuántos meses proyectar adelante cuando no hay end_date. Default: 12. */
  monthsAhead?: number;
  /**
   * Timestamp ISO para `created_at` de las filas generadas.
   * Default: `new Date().toISOString()` al momento de la llamada.
   * Inyectable para reproducibilidad en tests.
   */
  now?: string;
}

type IncomeForGen = Pick<
  Income,
  'id' | 'amount_cents' | 'frequency' | 'start_date' | 'end_date'
> & {
  /** Días de pago (1–31) para 'biweekly'. Si faltan, se usa cada 14 días (legacy). */
  payday_1?: number | null;
  payday_2?: number | null;
};

/**
 * Genera las ocurrencias proyectadas para un ingreso.
 *
 * Reglas:
 * - `one_time`: 1 ocurrencia en `start_date`.
 * - `monthly`: una ocurrencia por mes desde `start_date`, manteniendo el día
 *   del mes (clampea al último día cuando el mes objetivo no tiene ese día —
 *   ej. day=31 → Feb 28/29, Abril 30). Las ocurrencias se computan
 *   `addMonths(start, i)` (NO `addMonths(prev, 1)`) para que un clamp en
 *   febrero no haga drift al resto del año.
 * - `biweekly`: una ocurrencia cada 14 días desde `start_date`.
 *
 * Ventana: `end_date` si existe, si no `start_date + monthsAhead meses`.
 * Las ocurrencias se incluyen si su fecha es ≤ fin de ventana.
 *
 * Todas las ocurrencias arrancan con `is_confirmed = 0` (sin confirmar).
 * Función PURA: no toca DB, no usa randomness propia.
 */
export function generateOccurrences(
  income: IncomeForGen,
  options: GenerateOccurrencesOptions,
): IncomeOccurrence[] {
  const { generateId, monthsAhead = 12, now } = options;
  const createdAt = now ?? new Date().toISOString();

  const startDate = parseISO(income.start_date);
  const defaultWindowEnd = addMonths(startDate, monthsAhead);
  const windowEnd = income.end_date
    ? minDate(parseISO(income.end_date), defaultWindowEnd)
    : defaultWindowEnd;

  if (isAfter(startDate, windowEnd)) {
    return [];
  }

  const build = (date: Date): IncomeOccurrence => ({
    id: generateId(),
    income_id: income.id,
    amount_cents: income.amount_cents,
    occurred_at: format(date, 'yyyy-MM-dd'),
    is_confirmed: 0 as SqliteBoolean,
    created_at: createdAt,
  });

  if (income.frequency === 'one_time') {
    return [build(startDate)];
  }

  // Quincenal con días de pago configurados (ej. 1 y 15): ocurrencias en esos
  // días de cada mes, recortando al último día si el mes es más corto.
  if (income.frequency === 'biweekly') {
    const days = [...new Set([income.payday_1, income.payday_2])]
      .filter((d): d is number => typeof d === 'number' && d >= 1 && d <= 31)
      .sort((a, b) => a - b);
    if (days.length > 0) {
      // La serie cubre desde el INICIO DE LA QUINCENA de start_date, no desde
      // start_date exacto: si el usuario registra su salario el 7 con pago el
      // 1, la ocurrencia del 1 pertenece a SU quincena en curso y debe existir
      // para poder confirmarla (si no, el balance de esa quincena queda en 0).
      const seriesStart = parseISO(getQuincena(startDate).startDate);
      const result: IncomeOccurrence[] = [];
      let year = startDate.getFullYear();
      let month = startDate.getMonth();
      const CAP = 480;
      for (let i = 0; i < CAP; i++) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        // Dedup DESPUÉS del clamp: en meses cortos dos días configurados
        // distintos pueden colapsar al mismo día (ej. 28 y 30 → 28 en febrero);
        // sin esto se generaría el ingreso DOBLE esa quincena.
        const clampedDays = [...new Set(days.map((d) => Math.min(d, daysInMonth)))];
        for (const d of clampedDays) {
          const date = new Date(year, month, d);
          if (!isAfter(seriesStart, date) && !isAfter(date, windowEnd)) {
            result.push(build(date));
          }
        }
        if (isAfter(new Date(year, month, 1), windowEnd)) break;
        month += 1;
        if (month > 11) {
          month = 0;
          year += 1;
        }
      }
      result.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
      return result;
    }
    // sin días configurados → cada 14 días (legacy, abajo)
  }

  const step =
    income.frequency === 'monthly'
      ? (i: number) => addMonths(startDate, i)
      : (i: number) => addDays(startDate, i * 14);

  const result: IncomeOccurrence[] = [];
  const SAFETY_CAP = 1024; // ~85 años mensual o ~40 años biweekly — más que suficiente
  for (let i = 0; i < SAFETY_CAP; i++) {
    const date = step(i);
    if (isAfter(date, windowEnd)) break;
    result.push(build(date));
  }
  return result;
}

function minDate(a: Date, b: Date): Date {
  return a.getTime() < b.getTime() ? a : b;
}
