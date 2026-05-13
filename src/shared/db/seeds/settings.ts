import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Inserta la fila única de settings (id = 1) si no existe.
 * Defaults del spec: 20% de ahorro, CRC, tema 'system'.
 */
export async function seedSettings(db: SQLiteDatabase): Promise<void> {
  const existing = await db.getFirstAsync('SELECT id FROM settings WHERE id = 1');
  if (existing) return;

  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO settings (id, savings_percent, currency, theme, created_at, updated_at)
     VALUES (1, 20.0, 'CRC', 'system', ?, ?)`,
    now,
    now,
  );
}
