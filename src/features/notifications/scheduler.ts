import { addDays, getDaysInMonth, set } from 'date-fns';
import * as Notifications from 'expo-notifications';

import { listFixedExpenses } from '@/features/fixed-expenses/repository';
import { formatCents } from '@/shared/utils/money';

import { goalDueTrigger, nextPaydayTriggers } from './triggers';

export { goalDueTrigger, nextPaydayTriggers } from './triggers';

/**
 * Días de aviso antes del vencimiento. Se programan 2 notificaciones por
 * cada gasto fijo activo: una 3 días antes a las 9am, otra el día mismo a las 9am.
 */
const ALERT_DAYS_BEFORE = [3, 0];

const CHANNEL_ID = 'fixed-expenses';

/**
 * Configura el handler global de notificaciones. Llamarlo una sola vez al
 * arranque de la app (en el root layout o un boot effect).
 */
export function setupNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

async function ensureChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Gastos fijos',
    importance: Notifications.AndroidImportance.DEFAULT,
    enableVibrate: true,
  });
}

/**
 * Borra TODAS las notificaciones programadas. Útil al desactivar el toggle
 * o antes de re-programar.
 */
export async function cancelAllScheduled(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Etiquetas para cancelar cada familia de notificaciones sin tocar las demás. */
const FIXED_TAG = 'fixed-expense';
const PAYDAY_TAG = 'payday';
const GOAL_DUE_TAG = 'goal-due';
const ACHIEVE_TAG = 'goal-achieved';
const BEHIND_TAG = 'behind';

async function cancelByTag(tag: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => (n.content.data as { tag?: string } | undefined)?.tag === tag)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** Cancela solo las notificaciones de gastos fijos (deja recordatorios intactos). */
export async function cancelFixedExpenseNotifications(): Promise<void> {
  await cancelByTag(FIXED_TAG);
}

/**
 * Programa notificaciones para los gastos fijos activos en la moneda dada.
 * Primero cancela todo lo que había, después programa fresco.
 *
 * Para cada expense: una notificación 3 días antes del due_day del mes
 * siguiente (o este mes si todavía no ha pasado) y otra el día mismo.
 * Solo se programan los AVISOS PRÓXIMOS (no se llena la cola por todo el año).
 */
export async function rescheduleFixedExpenseNotifications(currency: string): Promise<number> {
  await ensureChannel();
  await cancelByTag(FIXED_TAG);

  const expenses = await listFixedExpenses({ active: true });
  const inCurrency = expenses.filter((e) => e.currency === currency);
  if (inCurrency.length === 0) return 0;

  let scheduled = 0;
  const now = new Date();

  for (const exp of inCurrency) {
    // Calcular el próximo "due date" basado en due_day y la fecha actual.
    const next = nextDueDate(now, exp.due_day);

    for (const daysBefore of ALERT_DAYS_BEFORE) {
      const fireAt = set(addDays(next, -daysBefore), {
        hours: 9,
        minutes: 0,
        seconds: 0,
        milliseconds: 0,
      });
      if (fireAt.getTime() <= now.getTime()) continue; // ya pasó

      const title =
        daysBefore === 0
          ? `Hoy se vence ${exp.name}`
          : `Faltan ${daysBefore} días: ${exp.name}`;
      const body = `${formatCents(exp.amount_cents, { currency: exp.currency })} · día ${exp.due_day}`;

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { tag: FIXED_TAG, fixed_expense_id: exp.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
          channelId: CHANNEL_ID,
        },
      });
      scheduled++;
    }
  }

  return scheduled;
}

/**
 * Calcula el próximo due date dada la fecha actual y el day-of-month.
 * Si el due_day de este mes ya pasó, devuelve el del mes siguiente.
 * Si el mes no tiene ese día (ej. day=31 en febrero), clampa al último día.
 */
function nextDueDate(from: Date, dueDay: number): Date {
  const thisMonth = new Date(from.getFullYear(), from.getMonth(), 1);
  const dimThis = getDaysInMonth(thisMonth);
  const clampedThis = Math.min(dueDay, dimThis);
  const candidateThis = new Date(from.getFullYear(), from.getMonth(), clampedThis);

  if (candidateThis.getTime() >= startOfDay(from).getTime()) {
    return candidateThis;
  }

  const nextMonth = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  const dimNext = getDaysInMonth(nextMonth);
  const clampedNext = Math.min(dueDay, dimNext);
  return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), clampedNext);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// ---------- Recordatorios de quincena y metas (Fase 10) ----------

const REMINDERS_CHANNEL_ID = 'reminders';

async function ensureRemindersChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync(REMINDERS_CHANNEL_ID, {
    name: 'Recordatorios',
    importance: Notifications.AndroidImportance.DEFAULT,
    enableVibrate: true,
  });
}

const today = () => new Date().toISOString().slice(0, 10);

/** Reprograma los recordatorios de quincena (15 y fin de mes, 9am). */
export async function schedulePaydayReminders(enabled: boolean): Promise<void> {
  await cancelByTag(PAYDAY_TAG);
  if (!enabled) return;
  await ensureRemindersChannel();
  for (const iso of nextPaydayTriggers(today(), 6, 9)) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '¡Llegó tu quincena! 💰',
        body: 'Registrá tu ingreso y revisá cuánto apartar para tus metas.',
        data: { tag: PAYDAY_TAG },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(iso),
        channelId: REMINDERS_CHANNEL_ID,
      },
    });
  }
}

/** Reprograma los avisos previos a la fecha de cada meta activa. */
export async function scheduleGoalDueReminders(
  enabled: boolean,
  goals: { name: string; due_date: string; status: string }[],
  leadDays: number,
): Promise<void> {
  await cancelByTag(GOAL_DUE_TAG);
  if (!enabled) return;
  await ensureRemindersChannel();
  for (const g of goals) {
    if (g.status !== 'active') continue;
    const iso = goalDueTrigger(g.due_date, leadDays, 9, today());
    if (!iso) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Se acerca el pago de "${g.name}"`,
        body: `Faltan ${leadDays} días. Revisá que tengas lo reservado.`,
        data: { tag: GOAL_DUE_TAG },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(iso),
        channelId: REMINDERS_CHANNEL_ID,
      },
    });
  }
}

/** Notificación inmediata de logro (tras un aporte que fondea la meta). */
export async function notifyGoalAchieved(goalName: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🎉 ¡Meta alcanzada!',
      body: `Completaste "${goalName}". ¡Bien ahí!`,
      data: { tag: ACHIEVE_TAG },
    },
    trigger: null,
  });
}

/** Notificación inmediata de atraso (la dispara el chequeo de foreground). */
export async function notifyBehind(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'No olvidés tu quincena',
      body: 'Hoy es día de pago y todavía no registraste tu ingreso.',
      data: { tag: BEHIND_TAG },
    },
    trigger: null,
  });
}
