import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

const DB_NAME = 'myfinance.db';

let dbInstance: SQLiteDatabase | null = null;
let openPromise: Promise<SQLiteDatabase> | null = null;

/**
 * Singleton de la conexión SQLite. Devuelve siempre la misma instancia
 * y serializa la apertura inicial para evitar carreras en el primer arranque.
 */
export async function getDb(): Promise<SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  if (openPromise) return openPromise;

  openPromise = (async () => {
    const db = await openDatabaseAsync(DB_NAME);
    await db.execAsync('PRAGMA foreign_keys = ON');
    await db.execAsync('PRAGMA journal_mode = WAL');
    dbInstance = db;
    return db;
  })();

  return openPromise;
}

/**
 * Cierra la DB. Útil solo en tests o en logout. En producción la dejamos abierta.
 */
export async function closeDb(): Promise<void> {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
    openPromise = null;
  }
}
