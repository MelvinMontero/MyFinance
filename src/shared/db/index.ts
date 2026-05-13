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

export { getDb, closeDb } from './client';
export type * from './types';
