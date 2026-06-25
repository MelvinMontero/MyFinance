/**
 * Constructores PUROS de notificaciones planificadas. Sin efectos, sin Expo —
 * solo arman la lista de "qué avisar y cuándo". El scheduler las programa.
 *
 * Nota: las notificaciones locales con fecha absoluta no se repiten solas. El
 * scheduler reprograma una ventana (próximas N quincenas / hitos) cada vez que
 * cambian los datos o se abre la app.
 */
import { addDays, getDaysInMonth, set } from 'date-fns';

import { nextMonthlyDue } from '@/features/cycle/expense';
import { formatCents } from '@/shared/utils/money';

export interface PlannedNotification {
  key: string;
  title: string;
  body: string;
  date: Date;
}

function at9am(d: Date): Date {
  return set(d, { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 });
}

/**
 * Próximos `count` días de pago (15 y último día del mes) a las 9am, posteriores
 * a `from`. Recuerda registrar el salario y revisar cuánto apartar.
 */
export function buildPaydayReminders(from: Date, count: number): PlannedNotification[] {
  const result: PlannedNotification[] = [];
  let year = from.getFullYear();
  let month = from.getMonth();
  let guard = 0;

  while (result.length < count && guard < 240) {
    const lastDay = getDaysInMonth(new Date(year, month, 1));
    for (const day of [15, lastDay]) {
      if (result.length >= count) break;
      const date = at9am(new Date(year, month, day));
      if (date.getTime() > from.getTime()) {
        result.push({
          key: `payday-${date.toISOString()}`,
          title: 'Día de pago 💰',
          body: 'Registrá tu salario y revisá cuánto apartar este cobro.',
          date,
        });
      }
    }
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    guard += 1;
  }
  return result;
}

export interface ExpenseLite {
  id: string;
  name: string;
  amount_cents: number;
  currency: string;
  due_day: number;
}

/**
 * Para cada gasto fijo: un aviso `daysBefore` días antes del próximo cobro y otro
 * el día mismo, ambos a las 9am, solo si caen en el futuro.
 */
export function buildExpenseReminders(
  expenses: ExpenseLite[],
  from: Date,
  daysBefore: number,
): PlannedNotification[] {
  const result: PlannedNotification[] = [];
  for (const e of expenses) {
    const due = nextMonthlyDue(from, e.due_day);
    for (const offset of [daysBefore, 0]) {
      const date = at9am(addDays(due, -offset));
      if (date.getTime() <= from.getTime()) continue;
      const title = offset === 0 ? `Hoy se vence ${e.name}` : `Faltan ${offset} día(s): ${e.name}`;
      result.push({
        key: `expense-${e.id}-${offset}`,
        title,
        body: `${formatCents(e.amount_cents, { currency: e.currency })} · día ${e.due_day}`,
        date,
      });
    }
  }
  return result;
}

export interface GoalLite {
  id: string;
  name: string;
  deadline: Date;
}

/**
 * Cuenta regresiva por meta: avisos en hitos (default 30/15/7/1 días antes de la
 * deadline), a las 9am, solo los que caen en el futuro.
 */
export function buildGoalCountdown(
  goals: GoalLite[],
  from: Date,
  milestones: number[] = [30, 15, 7, 1],
): PlannedNotification[] {
  const result: PlannedNotification[] = [];
  for (const g of goals) {
    for (const m of milestones) {
      const date = at9am(addDays(g.deadline, -m));
      if (date.getTime() <= from.getTime()) continue;
      result.push({
        key: `goal-${g.id}-${m}`,
        title: `Meta: ${g.name}`,
        body: `Faltan ${m} día(s) para la fecha de "${g.name}".`,
        date,
      });
    }
  }
  return result;
}
