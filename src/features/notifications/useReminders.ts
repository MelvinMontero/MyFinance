// src/features/notifications/useReminders.ts
import { useCallback } from 'react';

import { listGoals } from '@/features/goals/repository';
import { isPayday } from '@/features/goals/paydays';
import { listOccurrences } from '@/features/incomes/repository';
import { useSettings } from '@/features/settings/store';

import { schedulePaydayReminders, scheduleGoalDueReminders } from './scheduler';

export function useReminders() {
  const s = useSettings();

  const reschedule = useCallback(async () => {
    await schedulePaydayReminders(s.payday_reminders_enabled);
    const goals = await listGoals({ status: 'active' });
    await scheduleGoalDueReminders(
      s.goal_due_reminders_enabled,
      goals.map((g) => ({ name: g.name, due_date: g.due_date, status: g.status })),
      s.goal_due_lead_days,
    );
  }, [s.payday_reminders_enabled, s.goal_due_reminders_enabled, s.goal_due_lead_days]);

  /** True si hoy es quincena y la ocurrencia de hoy no está confirmada. */
  const checkBehind = useCallback(async (): Promise<boolean> => {
    if (!s.behind_reminders_enabled) return false;
    const t = new Date().toISOString().slice(0, 10);
    if (!isPayday(t)) return false;
    const occ = await listOccurrences({ period: t.slice(0, 7) });
    const todays = occ.filter((o) => o.occurred_at === t);
    return todays.length > 0 && todays.every((o) => o.is_confirmed === 0);
  }, [s.behind_reminders_enabled]);

  return { reschedule, checkBehind };
}
