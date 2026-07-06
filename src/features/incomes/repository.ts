import { format } from 'date-fns';
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
  currency: string;
  source?: string | null;
  frequency: IncomeFrequency;
  start_date: string; // 'yyyy-MM-dd'
  end_date?: string | null;
  note?: string | null;
  /** Días de pago (1–31) para 'biweekly'. */
  payday_1?: number | null;
  payday_2?: number | null;
}

export interface UpdateIncomeInput {
  amount_cents?: number;
  currency?: string;
  source?: string | null;
  start_date?: string;
  end_date?: string | null;
  note?: string | null;
  is_active?: boolean;
  payday_1?: number | null;
  payday_2?: number | null;
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
    currency: input.currency,
    source: input.source ?? null,
    frequency: input.frequency,
    start_date: input.start_date,
    end_date: input.end_date ?? null,
    is_active: 1 as SqliteBoolean,
    note: input.note ?? null,
    payday_1: input.frequency === 'biweekly' ? (input.payday_1 ?? null) : null,
    payday_2: input.frequency === 'biweekly' ? (input.payday_2 ?? null) : null,
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
      `INSERT INTO incomes (id, amount_cents, currency, source, frequency, start_date, end_date, is_active, note, payday_1, payday_2, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      income.id,
      income.amount_cents,
      income.currency,
      income.source,
      income.frequency,
      income.start_date,
      income.end_date,
      income.is_active,
      income.note,
      income.payday_1,
      income.payday_2,
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
 * Actualiza campos del ingreso. Si cambia el CALENDARIO de pagos (start_date,
 * end_date, payday_1 o payday_2), reproyecta las ocurrencias futuras SIN
 * confirmar: borra las pendientes de hoy en adelante y las regenera con el
 * nuevo calendario. Las ocurrencias pasadas y las ya CONFIRMADAS (dinero ya
 * recibido) nunca se tocan. Cambiar solo monto/fuente/nota no reproyecta.
 */
export async function updateIncome(id: string, patch: UpdateIncomeInput): Promise<void> {
  const db = await getDb();

  const existing = await getIncome(id);
  if (!existing) return;

  const sets: string[] = [];
  const args: (string | number | null)[] = [];

  if (patch.amount_cents !== undefined) {
    sets.push('amount_cents = ?');
    args.push(patch.amount_cents);
  }
  if (patch.currency !== undefined) {
    sets.push('currency = ?');
    args.push(patch.currency);
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
  if (patch.payday_1 !== undefined) {
    sets.push('payday_1 = ?');
    args.push(patch.payday_1);
  }
  if (patch.payday_2 !== undefined) {
    sets.push('payday_2 = ?');
    args.push(patch.payday_2);
  }
  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  args.push(new Date().toISOString());
  args.push(id);

  // ¿Cambió el calendario de pagos? Entonces hay que reproyectar las
  // ocurrencias futuras sin confirmar con el nuevo calendario.
  const scheduleChanged =
    (patch.start_date !== undefined && patch.start_date !== existing.start_date) ||
    (patch.end_date !== undefined && (patch.end_date ?? null) !== existing.end_date) ||
    (patch.payday_1 !== undefined && (patch.payday_1 ?? null) !== existing.payday_1) ||
    (patch.payday_2 !== undefined && (patch.payday_2 ?? null) !== existing.payday_2);

  await db.withTransactionAsync(async () => {
    await db.runAsync(`UPDATE incomes SET ${sets.join(', ')} WHERE id = ?`, ...args);
    if (!scheduleChanged) return;

    const updated = await db.getFirstAsync<Income>('SELECT * FROM incomes WHERE id = ?', id);
    if (!updated) return;

    const today = format(new Date(), 'yyyy-MM-dd');

    // Borra solo las futuras SIN confirmar; conserva el historial y lo confirmado.
    await db.runAsync(
      'DELETE FROM income_occurrences WHERE income_id = ? AND is_confirmed = 0 AND occurred_at >= ?',
      id,
      today,
    );

    // Fechas que sobreviven (pasadas o confirmadas): no las dupliques al regenerar.
    const kept = await db.getAllAsync<{ occurred_at: string }>(
      'SELECT occurred_at FROM income_occurrences WHERE income_id = ?',
      id,
    );
    const keptDates = new Set(kept.map((r) => r.occurred_at));

    const now = new Date().toISOString();
    const fresh = generateOccurrences(updated, {
      generateId: () => randomUUID(),
      now,
      monthsAhead: 12,
    });

    for (const occ of fresh) {
      if (occ.occurred_at < today) continue; // no recrear el pasado
      if (keptDates.has(occ.occurred_at)) continue; // ya existe (confirmada)
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

/** Ocurrencia + datos de su ingreso padre (fuente y moneda). */
export interface OccurrenceWithSource extends IncomeOccurrence {
  source: string | null;
  currency: string;
}

/**
 * Lista las ocurrencias en un rango de fechas [startDate, endDate] de ingresos
 * activos en la moneda dada, con la fuente del ingreso. Para el panel
 * "Ingresos por confirmar" del Inicio.
 */
export async function listOccurrencesInRange(
  startDate: string,
  endDate: string,
  currency: string,
): Promise<OccurrenceWithSource[]> {
  const db = await getDb();
  return db.getAllAsync<OccurrenceWithSource>(
    `SELECT io.id, io.income_id, io.amount_cents, io.occurred_at, io.is_confirmed, io.created_at,
            i.source AS source, i.currency AS currency
       FROM income_occurrences io
       JOIN incomes i ON i.id = io.income_id
      WHERE io.occurred_at >= ? AND io.occurred_at <= ?
        AND i.currency = ?
        AND i.is_active = 1
      ORDER BY io.is_confirmed ASC, io.occurred_at ASC`,
    startDate,
    endDate,
    currency,
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
