import { create } from 'zustand';

import { getSettings, updateSettings } from '@/shared/db';
import type { ThemePreference } from '@/shared/db/types';

export interface SettingsState {
  savings_percent: number;
  currency: string;
  theme: ThemePreference;
  biometric_enabled: boolean;
  notifications_enabled: boolean;
  onboarding_completed: boolean;
  payday_reminders_enabled: boolean;
  goal_due_reminders_enabled: boolean;
  behind_reminders_enabled: boolean;
  goal_due_lead_days: number;
  loaded: boolean;

  /** Carga inicial desde DB. Idempotente. */
  load: () => Promise<void>;
  setSavingsPercent: (pct: number) => Promise<void>;
  setCurrency: (currency: string) => Promise<void>;
  setTheme: (theme: ThemePreference) => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  setOnboardingCompleted: (completed: boolean) => Promise<void>;
  setPaydayReminders: (enabled: boolean) => Promise<void>;
  setGoalDueReminders: (enabled: boolean) => Promise<void>;
  setBehindReminders: (enabled: boolean) => Promise<void>;
  setGoalDueLeadDays: (days: number) => Promise<void>;
}

/**
 * Store global de settings. Una sola fuente de verdad. Los componentes
 * se subscriben con `useSettings(s => s.x)` para re-renderear cuando el slice cambia.
 */
export const useSettings = create<SettingsState>((set) => ({
  savings_percent: 20,
  currency: 'CRC',
  theme: 'system',
  biometric_enabled: false,
  notifications_enabled: false,
  onboarding_completed: false,
  payday_reminders_enabled: false,
  goal_due_reminders_enabled: false,
  behind_reminders_enabled: false,
  goal_due_lead_days: 5,
  loaded: false,

  load: async () => {
    const row = await getSettings();
    if (row) {
      set({
        savings_percent: row.savings_percent,
        currency: row.currency,
        theme: row.theme,
        biometric_enabled: row.biometric_enabled === 1,
        notifications_enabled: row.notifications_enabled === 1,
        onboarding_completed: row.onboarding_completed === 1,
        payday_reminders_enabled: row.payday_reminders_enabled === 1,
        goal_due_reminders_enabled: row.goal_due_reminders_enabled === 1,
        behind_reminders_enabled: row.behind_reminders_enabled === 1,
        goal_due_lead_days: row.goal_due_lead_days,
        loaded: true,
      });
    } else {
      set({ loaded: true });
    }
  },

  setSavingsPercent: async (pct) => {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    await updateSettings({ savings_percent: clamped });
    set({ savings_percent: clamped });
  },

  setCurrency: async (currency) => {
    await updateSettings({ currency });
    set({ currency });
  },

  setTheme: async (theme) => {
    await updateSettings({ theme });
    set({ theme });
  },

  setBiometricEnabled: async (enabled) => {
    await updateSettings({ biometric_enabled: enabled });
    set({ biometric_enabled: enabled });
  },

  setNotificationsEnabled: async (enabled) => {
    await updateSettings({ notifications_enabled: enabled });
    set({ notifications_enabled: enabled });
  },

  setOnboardingCompleted: async (completed) => {
    await updateSettings({ onboarding_completed: completed });
    set({ onboarding_completed: completed });
  },

  setPaydayReminders: async (enabled) => {
    await updateSettings({ payday_reminders_enabled: enabled });
    set({ payday_reminders_enabled: enabled });
  },

  setGoalDueReminders: async (enabled) => {
    await updateSettings({ goal_due_reminders_enabled: enabled });
    set({ goal_due_reminders_enabled: enabled });
  },

  setBehindReminders: async (enabled) => {
    await updateSettings({ behind_reminders_enabled: enabled });
    set({ behind_reminders_enabled: enabled });
  },

  setGoalDueLeadDays: async (days) => {
    await updateSettings({ goal_due_lead_days: days });
    set({ goal_due_lead_days: days });
  },
}));
