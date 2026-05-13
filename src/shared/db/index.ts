import { getDb } from './client';
import { runMigrations } from './migrator';
import { seedCategories } from './seeds/categories';
import { seedSettings } from './seeds/settings';
import type { Settings } from './types';

let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Punto único de entrada para arrancar la DB.
 * - Abre la conexión (singleton)
 * - Aplica migraciones pendientes
 * - Corre seeds idempotentes
 * Llamable múltiples veces sin efecto duplicado.
 */
export async function initDb(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const db = await getDb();
    await runMigrations(db);
    await seedSettings(db);
    await seedCategories(db);
    initialized = true;
  })();

  return initPromise;
}

export async function getCategoryCount(): Promise<number> {
  const db = await getDb();
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories',
  );
  return result?.count ?? 0;
}

export async function getSettings(): Promise<Settings | null> {
  const db = await getDb();
  const result = await db.getFirstAsync<Settings>('SELECT * FROM settings WHERE id = 1');
  return result ?? null;
}

export interface UpdateSettingsInput {
  savings_percent?: number;
  currency?: string;
  theme?: Settings['theme'];
  biometric_enabled?: boolean;
  notifications_enabled?: boolean;
  onboarding_completed?: boolean;
}

/**
 * Actualiza la fila única de settings (id=1). Patch parcial.
 */
export async function updateSettings(patch: UpdateSettingsInput): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const args: (string | number)[] = [];

  if (patch.savings_percent !== undefined) {
    sets.push('savings_percent = ?');
    args.push(patch.savings_percent);
  }
  if (patch.currency !== undefined) {
    sets.push('currency = ?');
    args.push(patch.currency);
  }
  if (patch.theme !== undefined) {
    sets.push('theme = ?');
    args.push(patch.theme);
  }
  if (patch.biometric_enabled !== undefined) {
    sets.push('biometric_enabled = ?');
    args.push(patch.biometric_enabled ? 1 : 0);
  }
  if (patch.notifications_enabled !== undefined) {
    sets.push('notifications_enabled = ?');
    args.push(patch.notifications_enabled ? 1 : 0);
  }
  if (patch.onboarding_completed !== undefined) {
    sets.push('onboarding_completed = ?');
    args.push(patch.onboarding_completed ? 1 : 0);
  }
  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  args.push(new Date().toISOString());

  await db.runAsync(`UPDATE settings SET ${sets.join(', ')} WHERE id = 1`, ...args);
}

export { getDb, closeDb } from './client';
export type * from './types';
