import { parseISO } from 'date-fns';
import * as Notifications from 'expo-notifications';

import { listFixedExpenses } from '@/features/fixed-expenses/repository';
import { listGoals } from '@/features/goals/repository';
import { listIncomes } from '@/features/incomes/repository';
import { formatCents } from '@/shared/utils/money';

import {
  buildExpenseReminders,
  buildGoalCountdown,
  buildPaydayReminders,
  type PlannedNotification,
} from './plan';

const CHANNEL_ID = 'finance';

/** Cuántas quincenas hacia adelante se programan recordatorios de día de pago. */
const PAYDAY_WINDOW = 8;

/**
 * Configura el handler global de notificaciones. Llamarlo una sola vez al
 * arranque de la app (root layout).
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
    name: 'Recordatorios de finanzas',
    importance: Notifications.AndroidImportance.DEFAULT,
    enableVibrate: true,
  });
}

/** Borra TODAS las notificaciones programadas. */
export async function cancelAllScheduled(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Reprograma TODAS las notificaciones locales: día de pago, gastos fijos por
 * vencer y cuenta regresiva de metas. Primero cancela lo previo.
 *
 * Las notificaciones con fecha absoluta no se repiten solas; por eso se
 * reprograma una ventana (PAYDAY_WINDOW quincenas + hitos) cada vez que cambian
 * los datos o se abre la app.
 */
export async function rescheduleAllNotifications(
  currency: string,
  notifyDaysBefore: number,
): Promise<number> {
  await ensureChannel();
  await cancelAllScheduled();

  const now = new Date();

  const expenses = (await listFixedExpenses({ active: true }))
    .filter((e) => e.currency === currency)
    .map((e) => ({
      id: e.id,
      name: e.name,
      amount_cents: e.amount_cents,
      currency: e.currency,
      due_day: e.due_day,
    }));

  const goals = (await listGoals({ active: true }))
    .filter((g) => g.currency === currency)
    .map((g) => ({ id: g.id, name: g.name, deadline: parseISO(g.deadline) }));

  // Días de pago = los configurados en los ingresos quincenales activos; si no
  // hay, se usa 15 y fin de mes por defecto.
  const incomes = await listIncomes({ active: true });
  const configuredDays = [
    ...new Set(
      incomes
        .filter((i) => i.frequency === 'biweekly')
        .flatMap((i) => [i.payday_1, i.payday_2])
        .filter((d): d is number => typeof d === 'number'),
    ),
  ];
  const paydayDays = configuredDays.length > 0 ? configuredDays : [15, 31];

  const planned: PlannedNotification[] = [
    ...buildPaydayReminders(now, paydayDays, PAYDAY_WINDOW),
    ...buildExpenseReminders(expenses, now, notifyDaysBefore),
    ...buildGoalCountdown(goals, now),
  ];

  for (const p of planned) {
    await Notifications.scheduleNotificationAsync({
      content: { title: p.title, body: p.body, data: { key: p.key } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: p.date,
        channelId: CHANNEL_ID,
      },
    });
  }

  return planned.length;
}

/**
 * Dispara una notificación inmediata de sobregasto. Se llama cuando, al registrar
 * un gasto real, los gastos del período superan el dinero libre disponible.
 */
export async function notifyOverspendNow(overspentCents: number, currency: string): Promise<void> {
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Te pasaste del presupuesto ⚠️',
      body: `Vas ${formatCents(overspentCents, { currency })} por encima de tu dinero libre de esta quincena.`,
      data: { key: 'overspend' },
    },
    trigger: null, // inmediata
  });
}
