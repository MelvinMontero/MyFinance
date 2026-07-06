/**
 * Lógica pura de quincenas. SIN DB, SIN efectos — testeable directo.
 *
 * Modelo de quincena (confirmado con el dueño, 2026-07-06):
 *   Q1 = días 1–14, Q2 = días 15–fin de mes.
 * Días de pago por defecto: 1 y 15 — cada pago cae en SU propia quincena
 * (el del 1 cubre Q1, el del 15 cubre Q2). Si a alguien le pagan a fin de
 * mes, se registra como día 1: ese dinero es de la quincena que arranca.
 */
import { format, getDaysInMonth, isAfter, parseISO, startOfDay } from 'date-fns';

export type QuincenaHalf = 1 | 2;

export interface Quincena {
  /** 'yyyy-MM' del mes calendario. */
  period: string;
  /** 1 = días 1–14, 2 = días 15–fin de mes. */
  half: QuincenaHalf;
  /** 'yyyy-MM-dd' primer día de la quincena. */
  startDate: string;
  /** 'yyyy-MM-dd' último día de la quincena. */
  endDate: string;
}

/** Último día del mes de `period` ('yyyy-MM'), como número (28..31). */
function lastDayOfMonth(period: string): number {
  return getDaysInMonth(parseISO(`${period}-01`));
}

/** Devuelve los límites de una quincena dado el mes y la mitad. */
export function quincenaBounds(
  period: string,
  half: QuincenaHalf,
): { startDate: string; endDate: string } {
  if (half === 1) {
    return { startDate: `${period}-01`, endDate: `${period}-14` };
  }
  const last = String(lastDayOfMonth(period)).padStart(2, '0');
  return { startDate: `${period}-15`, endDate: `${period}-${last}` };
}

/** Clasifica una fecha ('yyyy-MM-dd' o Date) en su quincena. */
export function getQuincena(date: string | Date): Quincena {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const period = format(d, 'yyyy-MM');
  const half: QuincenaHalf = d.getDate() < 15 ? 1 : 2;
  const bounds = quincenaBounds(period, half);
  return { period, half, ...bounds };
}

/** 'yyyy-MM-H' — clave estable de una quincena. */
export function quincenaKey(q: Quincena): string {
  return `${q.period}-${q.half}`;
}

/**
 * Ordinal monótono de una quincena (2 por mes). Sirve para contar el span
 * inclusivo entre dos quincenas: `quincenaIndex(b) - quincenaIndex(a) + 1`.
 */
export function quincenaIndex(q: Quincena): number {
  const [yearStr, monthStr] = q.period.split('-');
  const year = Number(yearStr);
  const monthIndex0 = Number(monthStr) - 1;
  return year * 24 + monthIndex0 * 2 + (q.half - 1);
}

/**
 * Cuenta cuántas quincenas (pagos) quedan disponibles entre `from` y `deadline`.
 * Un "pago" es un anclaje de quincena: día 1 o día 15. Cuenta los anclajes
 * ESTRICTAMENTE posteriores a `from` y ≤ `deadline`. Representa los sueldos
 * que el usuario todavía va a recibir antes de la fecha límite.
 */
export function countRemainingQuincenas(from: Date, deadline: Date): number {
  const start = startOfDay(from);
  const end = startOfDay(deadline);
  if (isAfter(start, end)) return 0;

  let count = 0;
  let year = start.getFullYear();
  let month = start.getMonth();
  const CAP = 1200; // ~50 años — backstop

  for (let i = 0; i < CAP; i++) {
    for (const anchorDay of [1, 15]) {
      const anchor = new Date(year, month, anchorDay);
      if (isAfter(anchor, start) && !isAfter(anchor, end)) {
        count++;
      }
    }
    const monthStart = new Date(year, month, 1);
    if (isAfter(monthStart, end)) break;
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return count;
}
