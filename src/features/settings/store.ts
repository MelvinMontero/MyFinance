import { create } from 'zustand';

import { getSettings, updateSettings } from '@/shared/db';
import type { ThemePreference } from '@/shared/db/types';

export interface SettingsState {
  savings_percent: number;
  currency: string;
  theme: ThemePreference;
  loaded: boolean;

  /** Carga inicial desde DB. Idempotente. */
  load: () => Promise<void>;
  setSavingsPercent: (pct: number) => Promise<void>;
  setCurrency: (currency: string) => Promise<void>;
  setTheme: (theme: ThemePreference) => Promise<void>;
}

/**
 * Store global de settings. Una sola fuente de verdad para % ahorro,
 * moneda y tema. Los componentes se subscriben con `useSettings(s => s.x)`
 * para re-renderear cuando el slice cambia.
 */
export const useSettings = create<SettingsState>((set) => ({
  savings_percent: 20,
  currency: 'CRC',
  theme: 'system',
  loaded: false,

  load: async () => {
    const row = await getSettings();
    if (row) {
      set({
        savings_percent: row.savings_percent,
        currency: row.currency,
        theme: row.theme,
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
}));
