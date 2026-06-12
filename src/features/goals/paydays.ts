// src/features/goals/paydays.ts
import { format, lastDayOfMonth, parseISO } from 'date-fns';

/**
 * Calendario de quincenas en Costa Rica: se cobra el día 15 y el último
 * día del mes. Todas las fechas entran y salen como 'YYYY-MM-DD' (ISO date).
 * Funciones PURAS — sin DB, sin Date.now().
 */

const ISO = 'yyyy-MM-dd';

function lastDayNum(date: Date): number {
  return lastDayOfMonth(date).getDate();
}

/** True si `date` (YYYY-MM-DD) es día de pago: 15 o último del mes. */
export function isPayday(date: string): boolean {
  const dt = parseISO(date);
  const day = dt.getDate();
  return day === 15 || day === lastDayNum(dt);
}

/** Primera quincena en o después de `date` (inclusive). */
export function nextPaydayOnOrAfter(date: string): string {
  const dt = parseISO(date);
  const day = dt.getDate();
  const last = lastDayNum(dt);

  if (day <= 15) {
    return format(new Date(dt.getFullYear(), dt.getMonth(), 15), ISO);
  }
  if (day <= last) {
    return format(new Date(dt.getFullYear(), dt.getMonth(), last), ISO);
  }
  return format(new Date(dt.getFullYear(), dt.getMonth() + 1, 15), ISO);
}

/** Lista de quincenas con fecha estrictamente > `asOf` y <= `due`. */
export function paydaysBetween(asOf: string, due: string): string[] {
  const result: string[] = [];
  if (due < asOf) return result;

  let cursor = nextPaydayOnOrAfter(asOf);
  if (cursor === asOf) {
    cursor = nextPaydayAfterDay(asOf);
  }
  const SAFETY = 1024;
  for (let i = 0; i < SAFETY && cursor <= due; i++) {
    result.push(cursor);
    cursor = nextPaydayAfterDay(cursor);
  }
  return result;
}

/** Cantidad de quincenas en (asOf, due]. */
export function countPaydaysAfter(asOf: string, due: string): number {
  return paydaysBetween(asOf, due).length;
}

/** Próxima quincena con fecha estrictamente posterior a `date`. */
function nextPaydayAfterDay(date: string): string {
  const dt = parseISO(date);
  const day = dt.getDate();
  const last = lastDayNum(dt);

  if (day < 15) {
    return format(new Date(dt.getFullYear(), dt.getMonth(), 15), ISO);
  }
  if (day < last) {
    return format(new Date(dt.getFullYear(), dt.getMonth(), last), ISO);
  }
  return format(new Date(dt.getFullYear(), dt.getMonth() + 1, 15), ISO);
}
