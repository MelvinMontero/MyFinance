import * as DocumentPicker from 'expo-document-picker';
// expo-file-system v19 renombró la API. El módulo /legacy mantiene la firma antigua
// (cacheDirectory + EncodingType). Para Fase 7 usamos legacy — migrar al API nuevo
// (Paths/File) queda para v0.8.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';

import { getDb } from '@/shared/db';

const BACKUP_VERSION = 1;

interface BackupTable {
  name: string;
  rows: Record<string, unknown>[];
}

interface BackupFile {
  app: 'myfinance';
  version: number;
  exported_at: string;
  tables: BackupTable[];
}

const EXPORT_TABLES = [
  'settings',
  'categories',
  'incomes',
  'income_occurrences',
  'fixed_expenses',
  'fixed_expense_payments',
  'variable_expenses',
  'monthly_snapshots',
];

/**
 * Exporta TODA la DB a JSON y abre el sheet de "compartir" para que
 * el usuario guarde el archivo donde quiera (Drive, email, descargas).
 * Sin encriptación todavía — TODO Fase 8: PIN derivado con PBKDF2 + AES.
 */
export async function exportBackup(): Promise<{ uri: string; size: number }> {
  const db = await getDb();
  const tables: BackupTable[] = [];

  for (const name of EXPORT_TABLES) {
    const rows = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${name}`);
    tables.push({ name, rows });
  }

  const data: BackupFile = {
    app: 'myfinance',
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    tables,
  };

  const json = JSON.stringify(data, null, 2);
  const dateStr = format(new Date(), 'yyyy-MM-dd_HHmm');
  const filename = `myfinance-backup-${dateStr}.json`;
  const uri = `${FileSystem.cacheDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(uri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const info = await FileSystem.getInfoAsync(uri);
  const size = info.exists && 'size' in info ? (info.size as number) : json.length;

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      dialogTitle: 'Guardar respaldo de MyFinance',
      UTI: 'public.json',
    });
  }

  return { uri, size };
}

/**
 * Permite al usuario seleccionar un archivo .json y restaura todos los
 * datos. SOBRESCRIBE los datos actuales (DELETE FROM + INSERT en una
 * transacción). El usuario debe confirmar antes.
 */
export async function importBackup(): Promise<
  | { ok: true; tablesRestored: number; rowsRestored: number }
  | { ok: false; reason: string }
> {
  const pick = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });

  if (pick.canceled || !pick.assets || pick.assets.length === 0) {
    return { ok: false, reason: 'cancelled' };
  }

  const asset = pick.assets[0];
  if (!asset) {
    return { ok: false, reason: 'cancelled' };
  }

  let parsed: BackupFile;
  try {
    const text = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    parsed = JSON.parse(text) as BackupFile;
  } catch (err) {
    return {
      ok: false,
      reason: `Archivo inválido: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (parsed.app !== 'myfinance') {
    return { ok: false, reason: 'No es un respaldo de MyFinance.' };
  }
  if (parsed.version !== BACKUP_VERSION) {
    return {
      ok: false,
      reason: `Versión de respaldo ${parsed.version} no soportada (esperaba ${BACKUP_VERSION}).`,
    };
  }
  if (!Array.isArray(parsed.tables)) {
    return { ok: false, reason: 'Estructura del respaldo inválida.' };
  }

  const db = await getDb();
  let rowsRestored = 0;
  let tablesRestored = 0;

  await db.withTransactionAsync(async () => {
    // Borrar en orden inverso de dependencias para no chocar con FK.
    const reverseDeleteOrder = [...EXPORT_TABLES].reverse();
    for (const t of reverseDeleteOrder) {
      await db.execAsync(`DELETE FROM ${t}`);
    }
    // Insertar en orden de dependencia.
    for (const tableName of EXPORT_TABLES) {
      const table = parsed.tables.find((t) => t.name === tableName);
      if (!table || table.rows.length === 0) continue;
      tablesRestored++;
      for (const row of table.rows) {
        const cols = Object.keys(row);
        const placeholders = cols.map(() => '?').join(', ');
        const values = cols.map((c) => row[c] as string | number | null);
        await db.runAsync(
          `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`,
          ...values,
        );
        rowsRestored++;
      }
    }
  });

  return { ok: true, tablesRestored, rowsRestored };
}
