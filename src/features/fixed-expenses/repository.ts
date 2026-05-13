import { format } from 'date-fns';
import { randomUUID } from 'expo-crypto';

import { getDb } from '@/shared/db';
import type { FixedExpense, FixedExpensePayment, SqliteBoolean } from '@/shared/db/types';

export interface NewFixedExpenseInput {
  name: string;
  amount_cents: number;
  currency: string;
  category_id: string;
  due_day: number;
  start_date: string;
  end_date?: string | null;
}

export interface UpdateFixedExpenseInput {
  name?: string;
  amount_cents?: number;
  currency?: string;
  category_id?: string;
  due_day?: number;
  start_date?: string;
  end_date?: string | null;
  is_active?: boolean;
}

/** Una fixed_expense + info de su pago en un período específico (LEFT JOIN). */
export interface FixedExpenseWithPayment extends FixedExpense {
  payment_id: string | null;
  paid_at: string | null;
  paid_amount_cents: number | null;
}

/** Devuelve "yyyy-MM" del momento actual. */
export function currentPeriod(): string {
  return format(new Date(), 'yyyy-MM');
}

export async function createFixedExpense(input: NewFixedExpenseInput): Promise<FixedExpense> {
  const db = await getDb();
  const now = new Date().toISOString();

  const row: FixedExpense = {
    id: randomUUID(),
    name: input.name,
    amount_cents: input.amount_cents,
    currency: input.currency,
    category_id: input.category_id,
    due_day: input.due_day,
    start_date: input.start_date,
    end_date: input.end_date ?? null,
    is_active: 1 as SqliteBoolean,
    created_at: now,
    updated_at: now,
  };

  await db.runAsync(
    `INSERT INTO fixed_expenses (id, name, amount_cents, currency, category_id, due_day, is_active, start_date, end_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    row.name,
    row.amount_cents,
    row.currency,
    row.category_id,
    row.due_day,
    row.is_active,
    row.start_date,
    row.end_date,
    row.created_at,
    row.updated_at,
  );

  return row;
}

export async function listFixedExpenses(
  opts: { active?: boolean } = {},
): Promise<FixedExpense[]> {
  const db = await getDb();
  if (opts.active === undefined) {
    return db.getAllAsync<FixedExpense>(
      'SELECT * FROM fixed_expenses ORDER BY is_active DESC, due_day ASC, name ASC',
    );
  }
  return db.getAllAsync<FixedExpense>(
    'SELECT * FROM fixed_expenses WHERE is_active = ? ORDER BY due_day ASC, name ASC',
    opts.active ? 1 : 0,
  );
}

/**
 * Lista los gastos fijos con info del pago en el período dado vía LEFT JOIN.
 * Una fila por gasto, payment_id es null si aún no se pagó este mes.
 */
export async function listFixedExpensesWithPayment(
  period: string,
): Promise<FixedExpenseWithPayment[]> {
  const db = await getDb();
  return db.getAllAsync<FixedExpenseWithPayment>(
    `SELECT fe.*,
            fep.id   AS payment_id,
            fep.paid_at,
            fep.amount_cents AS paid_amount_cents
       FROM fixed_expenses fe
       LEFT JOIN fixed_expense_payments fep
              ON fep.fixed_expense_id = fe.id
             AND fep.period = ?
      WHERE fe.is_active = 1
      ORDER BY fe.due_day ASC, fe.name ASC`,
    period,
  );
}

export async function getFixedExpense(id: string): Promise<FixedExpense | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<FixedExpense>(
    'SELECT * FROM fixed_expenses WHERE id = ?',
    id,
  );
  return row ?? null;
}

export async function updateFixedExpense(
  id: string,
  patch: UpdateFixedExpenseInput,
): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const args: (string | number | null)[] = [];

  if (patch.name !== undefined) {
    sets.push('name = ?');
    args.push(patch.name);
  }
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
  if (patch.due_day !== undefined) {
    sets.push('due_day = ?');
    args.push(patch.due_day);
  }
  if (patch.start_date !== undefined) {
    sets.push('start_date = ?');
    args.push(patch.start_date);
  }
  if (patch.end_date !== undefined) {
    sets.push('end_date = ?');
    args.push(patch.end_date);
  }
  if (patch.is_active !== undefined) {
    sets.push('is_active = ?');
    args.push(patch.is_active ? 1 : 0);
  }
  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  args.push(new Date().toISOString());
  args.push(id);

  await db.runAsync(
    `UPDATE fixed_expenses SET ${sets.join(', ')} WHERE id = ?`,
    ...args,
  );
}

/** CASCADE elimina los payments asociados. */
export async function deleteFixedExpense(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM fixed_expenses WHERE id = ?', id);
}

/* ===== PAGOS ===== */

/**
 * Marca un gasto fijo como pagado en el período dado. Idempotente —
 * si ya existe un pago para (expense, period), no duplica.
 * Usa el amount_cents actual del expense como monto del pago.
 */
export async function markAsPaid(
  fixedExpenseId: string,
  period: string = currentPeriod(),
): Promise<FixedExpensePayment | null> {
  const db = await getDb();
  const existing = await db.getFirstAsync<FixedExpensePayment>(
    'SELECT * FROM fixed_expense_payments WHERE fixed_expense_id = ? AND period = ?',
    fixedExpenseId,
    period,
  );
  if (existing) return existing;

  const expense = await getFixedExpense(fixedExpenseId);
  if (!expense) {
    throw new Error(`Gasto fijo ${fixedExpenseId} no encontrado`);
  }

  const now = new Date().toISOString();
  const payment: FixedExpensePayment = {
    id: randomUUID(),
    fixed_expense_id: fixedExpenseId,
    amount_cents: expense.amount_cents,
    paid_at: now,
    period,
    created_at: now,
  };

  await db.runAsync(
    `INSERT INTO fixed_expense_payments (id, fixed_expense_id, amount_cents, paid_at, period, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    payment.id,
    payment.fixed_expense_id,
    payment.amount_cents,
    payment.paid_at,
    payment.period,
    payment.created_at,
  );

  return payment;
}

/** Quita el pago de un gasto fijo en el período dado. */
export async function unmarkAsPaid(
  fixedExpenseId: string,
  period: string = currentPeriod(),
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'DELETE FROM fixed_expense_payments WHERE fixed_expense_id = ? AND period = ?',
    fixedExpenseId,
    period,
  );
}

export async function listPaymentsForExpense(
  fixedExpenseId: string,
): Promise<FixedExpensePayment[]> {
  const db = await getDb();
  return db.getAllAsync<FixedExpensePayment>(
    'SELECT * FROM fixed_expense_payments WHERE fixed_expense_id = ? ORDER BY period DESC',
    fixedExpenseId,
  );
}

/* ===== STATS ===== */

export async function getFixedExpenseCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM fixed_expenses WHERE is_active = 1',
  );
  return row?.count ?? 0;
}

export async function getPaymentSummary(
  period: string = currentPeriod(),
): Promise<{ total: number; paid: number }> {
  const db = await getDb();
  const total = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM fixed_expenses WHERE is_active = 1',
  );
  const paid = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(DISTINCT fep.fixed_expense_id) as count
       FROM fixed_expense_payments fep
       JOIN fixed_expenses fe ON fe.id = fep.fixed_expense_id
      WHERE fep.period = ? AND fe.is_active = 1`,
    period,
  );
  return {
    total: total?.count ?? 0,
    paid: paid?.count ?? 0,
  };
}
