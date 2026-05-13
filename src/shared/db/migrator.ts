import type { SQLiteDatabase } from 'expo-sqlite';

import { migrations } from './migrations';

/**
 * Aplica las migraciones pendientes en orden. Usa PRAGMA user_version
 * como contador. Cada migración corre dentro de una transacción para
 * que un fallo no deje la DB a medio camino.
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;

  const pending = migrations
    .filter((m) => m.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.sql);
      // PRAGMA no admite parámetros — interpolar es seguro porque version es int del código.
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}
