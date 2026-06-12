import { paydaysBetween } from '@/features/goals/paydays';

/**
 * Lógica PURA de "próximas fechas a notificar" — sin expo-notifications ni
 * DB, para poder testearla en Jest. El scheduler la envuelve con los efectos.
 */

/** Devuelve hasta N triggers de quincena (ISO local 'YYYY-MM-DDTHH:00:00') desde `from`. */
export function nextPaydayTriggers(from: string, count: number, hour: number): string[] {
  const hh = String(hour).padStart(2, '0');
  const start = shiftDay(from, -1); // incluir la quincena de hoy si `from` lo es
  const far = shiftDay(from, 400);
  return paydaysBetween(start, far)
    .slice(0, count)
    .map((d) => `${d}T${hh}:00:00`);
}

/** Trigger para avisar `lead` días antes de la fecha de una meta. null si ya pasó. */
export function goalDueTrigger(
  dueDate: string,
  lead: number,
  hour: number,
  asOf: string,
): string | null {
  const fire = shiftDay(dueDate, -lead);
  if (fire < asOf) return null;
  const hh = String(hour).padStart(2, '0');
  return `${fire}T${hh}:00:00`;
}

function shiftDay(iso: string, days: number): string {
  const dt = new Date(`${iso}T00:00:00`);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}
