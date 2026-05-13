import { format } from 'date-fns';
import { randomUUID } from 'expo-crypto';

import { getDb } from '@/shared/db';
import type { VariableExpense } from '@/shared/db/types';

export interface NewVariableExpenseInput {
  amount_cents: number;
  currency: string;
  category_id: string;
  occurred_at: string; // 'yyyy-MM-dd'
  note?: string | null;
}

export interface UpdateVariableExpenseInput {
  amount_cents?: number;
  currency?: string;
  category_id?: string;
  occurred_at?: string;
  note?: string | null;
}

export function currentPeriod(): string {
  return format(new Date(), 'yyyy-MM');
}

export async function createVariableExpense(
  input: NewVariableExpenseInput,
): Promise<VariableExpense> {
  const db = await getDb();
  const now = new Date().toISOString();

  const row: VariableExpense = {
    id: randomUUID(),
    amount_cents: input.amount_cents,
    currency: input.currency,
    category_id: input.category_id,
    occurred_at: input.occurred_at,
    note: input.note ?? null,
    created_at: now,
    updated_at: now,
  };

  await db.runAsync(
    `INSERT INTO variable_expenses (id, amount_cents, currency, category_id, occurred_at, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    row.amount_cents,
    row.currency,
    row.category_id,
    row.occurred_at,
    row.note,
    row.created_at,
    row.updated_at,
  );

  return row;
}

export async function listVariableExpenses(
  filter: { period?: string; currency?: string } = {},
): Promise<VariableExpense[]> {
  const db = await getDb();
  const conds: string[] = [];
  const args: (string | number)[] = [];

  if (filter.period) {
    conds.push("substr(occurred_at, 1, 7) = ?");
    args.push(filter.period);
  }
  if (filter.currency) {
    conds.push('currency = ?');
    args.push(filter.currency);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  return db.getAllAsync<VariableExpense>(
    `SELECT * FROM variable_expenses ${where} ORDER BY occurred_at DESC, created_at DESC`,
    ...args,
  );
}

export async function getVariableExpense(id: string): Promise<VariableExpense | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<VariableExpense>(
    'SELECT * FROM variable_expenses WHERE id = ?',
    id,
  );
  return row ?? null;
}

export async function updateVariableExpense(
  id: string,
  patch: UpdateVariableExpenseInput,
): Promise<void> {
  const db = await getDb();
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
  if (patch.category_id !== undefined) {
    sets.push('category_id = ?');
    args.push(patch.category_id);
  }
  if (patch.occurred_at !== undefined) {
    sets.push('occurred_at = ?');
    args.push(patch.occurred_at);
  }
  if (patch.note !== undefined) {
    sets.push('note = ?');
    args.push(patch.note);
  }
  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  args.push(new Date().toISOString());
  args.push(id);

  await db.runAsync(
    `UPDATE variable_expenses SET ${sets.join(', ')} WHERE id = ?`,
    ...args,
  );
}

export async function deleteVariableExpense(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM variable_expenses WHERE id = ?', id);
}

/** Suma de gastos variables del período en una moneda. */
export async function getVariableExpenseTotal(
  period: string = currentPeriod(),
  currency?: string,
): Promise<number> {
  const db = await getDb();
  if (currency) {
    const row = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total
         FROM variable_expenses
        WHERE substr(occurred_at, 1, 7) = ? AND currency = ?`,
      period,
      currency,
    );
    return row?.total ?? 0;
  }
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount_cents), 0) AS total
       FROM variable_expenses
      WHERE substr(occurred_at, 1, 7) = ?`,
    period,
  );
  return row?.total ?? 0;
}

export async function getVariableExpenseCount(period?: string): Promise<number> {
  const db = await getDb();
  if (period) {
    const row = await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM variable_expenses WHERE substr(occurred_at, 1, 7) = ?",
      period,
    );
    return row?.count ?? 0;
  }
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM variable_expenses',
  );
  return row?.count ?? 0;
}
