import { randomUUID } from 'expo-crypto';

import { getDb } from '@/shared/db';
import type {
  Income,
  IncomeFrequency,
  IncomeOccurrence,
  SqliteBoolean,
} from '@/shared/db/types';

import { generateOccurrences } from './occurrences';

export interface NewIncomeInput {
  amount_cents: number;
  source?: string | null;
  frequency: IncomeFrequency;
  start_date: string; // 'yyyy-MM-dd'
  end_date?: string | null;
  note?: string | null;
}

export interface UpdateIncomeInput {
  amount_cents?: number;
  source?: string | null;
  start_date?: string;
  end_date?: string | null;
  note?: string | null;
  is_active?: boolean;
}

/**
 * Crea un ingreso y proyecta sus ocurrencias (12 meses adelante por default).
 * Todo en una transacción — si algo falla, se rolea la inserción del income también.
 */
export async function createIncome(input: NewIncomeInput): Promise<{
  income: Income;
  occurrences: IncomeOccurrence[];
}> {
  const db = await getDb();
  const now = new Date().toISOString();

  const income: Income = {
    id: randomUUID(),
    amount_cents: input.amount_cents,
    source: input.source ?? null,
    frequency: input.frequency,
    start_date: input.start_date,
    end_date: input.end_date ?? null,
    is_active: 1 as SqliteBoolean,
    note: input.note ?? null,
    created_at: now,
    updated_at: now,
  };

  const occurrences = generateOccurrences(income, {
    generateId: () => randomUUID(),
    now,
    monthsAhead: 12,
  });

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO incomes (id, amount_cents, source, frequency, start_date, end_date, is_active, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      income.id,
      income.amount_cents,
      income.source,
      income.frequency,
      income.start_date,
      income.end_date,
      income.is_active,
      income.note,
      income.created_at,
      income.updated_at,
    );

    for (const occ of occurrences) {
      await db.runAsync(
        `INSERT INTO income_occurrences (id, income_id, amount_cents, occurred_at, is_confirmed, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        occ.id,
        occ.income_id,
        occ.amount_cents,
        occ.occurred_at,
        occ.is_confirmed,
        occ.created_at,
      );
    }
  });

  return { income, occurrences };
}

export async function listIncomes(opts: { active?: boolean } = {}): Promise<Income[]> {
  const db = await getDb();
  if (opts.active === undefined) {
    return db.getAllAsync<Income>(
      'SELECT * FROM incomes ORDER BY is_active DESC, start_date DESC',
    );
  }
  return db.getAllAsync<Income>(
    'SELECT * FROM incomes WHERE is_active = ? ORDER BY start_date DESC',
    opts.active ? 1 : 0,
  );
}

export async function getIncome(id: string): Promise<Income | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Income>('SELECT * FROM incomes WHERE id = ?', id);
  return row ?? null;
}

/**
 * Actualiza campos del ingreso. NO regenera ocurrencias —
 * si el usuario cambia frecuencia o fechas, las ocurrencias futuras quedan
 * con los valores viejos. Decisión consciente (Fase 2 simple); en Fase 5+
 * podemos exponer un "regenerar futuras" como acción explícita.
 */
export async function updateIncome(id: string, patch: UpdateIncomeInput): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const args: (string | number | null)[] = [];

  if (patch.amount_cents !== undefined) {
    sets.push('amount_cents = ?');
    args.push(patch.amount_cents);
  }
  if (patch.source !== undefined) {
    sets.push('source = ?');
    args.push(patch.source);
  }
  if (patch.start_date !== undefined) {
    sets.push('start_date = ?');
    args.push(patch.start_date);
  }
  if (patch.end_date !== undefined) {
    sets.push('end_date = ?');
    args.push(patch.end_date);
  }
  if (patch.note !== undefined) {
    sets.push('note = ?');
    args.push(patch.note);
  }
  if (patch.is_active !== undefined) {
    sets.push('is_active = ?');
    args.push(patch.is_active ? 1 : 0);
  }
  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  args.push(new Date().toISOString());
  args.push(id);

  await db.runAsync(`UPDATE incomes SET ${sets.join(', ')} WHERE id = ?`, ...args);
}

/**
 * Elimina un ingreso. Las ocurrencias se borran por CASCADE en el schema.
 */
export async function deleteIncome(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM incomes WHERE id = ?', id);
}

export async function listOccurrences(
  filter: { incomeId?: string; period?: string } = {},
): Promise<IncomeOccurrence[]> {
  const db = await getDb();
  const conds: string[] = [];
  const args: (string | number)[] = [];

  if (filter.incomeId) {
    conds.push('income_id = ?');
    args.push(filter.incomeId);
  }
  if (filter.period) {
    conds.push("strftime('%Y-%m', occurred_at) = ?");
    args.push(filter.period);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  return db.getAllAsync<IncomeOccurrence>(
    `SELECT * FROM income_occurrences ${where} ORDER BY occurred_at ASC`,
    ...args,
  );
}

export async function setOccurrenceConfirmed(
  id: string,
  confirmed: boolean,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE income_occurrences SET is_confirmed = ? WHERE id = ?',
    confirmed ? 1 : 0,
    id,
  );
}

/**
 * Sobre-escribe el monto de una ocurrencia puntual. Útil cuando un mes
 * el sueldo llega distinto (aguinaldo, bono, recorte). NO afecta a la serie.
 */
export async function overrideOccurrenceAmount(
  id: string,
  amount_cents: number,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE income_occurrences SET amount_cents = ? WHERE id = ?',
    amount_cents,
    id,
  );
}

export async function getIncomeCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM incomes WHERE is_active = 1',
  );
  return row?.count ?? 0;
}

export async function getOccurrenceCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM income_occurrences',
  );
  return row?.count ?? 0;
}
