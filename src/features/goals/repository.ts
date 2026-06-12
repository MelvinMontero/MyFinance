// src/features/goals/repository.ts
import { randomUUID } from 'expo-crypto';

import { getDb } from '@/shared/db';
import type {
  ContributionSource,
  Goal,
  GoalContribution,
  GoalFundingSource,
  GoalStatus,
} from '@/shared/db/types';

import { paydaysBetween } from './paydays';
import { computeReservations } from './reservations';

export interface NewGoalInput {
  name: string;
  target_amount_cents: number;
  initial_amount_cents: number;
  currency: string;
  due_date: string; // 'YYYY-MM-DD'
  funding_source: GoalFundingSource;
  category_id?: string | null;
  note?: string | null;
}

export interface UpdateGoalInput {
  name?: string;
  target_amount_cents?: number;
  initial_amount_cents?: number;
  currency?: string;
  due_date?: string;
  funding_source?: GoalFundingSource;
  category_id?: string | null;
  status?: GoalStatus;
  note?: string | null;
}

/** Meta + total aportado (initial + Σ ledger) ya calculado, para listados. */
export interface GoalWithProgress extends Goal {
  contributed_cents: number; // Σ goal_contributions
  saved_cents: number; // initial + contributed
}

export async function createGoal(input: NewGoalInput): Promise<Goal> {
  const db = await getDb();
  const now = new Date().toISOString();
  const goal: Goal = {
    id: randomUUID(),
    name: input.name,
    target_amount_cents: input.target_amount_cents,
    initial_amount_cents: input.initial_amount_cents,
    currency: input.currency,
    due_date: input.due_date,
    funding_source: input.funding_source,
    category_id: input.category_id ?? null,
    status: 'active',
    note: input.note ?? null,
    created_at: now,
    updated_at: now,
  };
  await db.runAsync(
    `INSERT INTO goals (id, name, target_amount_cents, initial_amount_cents, currency, due_date, funding_source, category_id, status, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    goal.id,
    goal.name,
    goal.target_amount_cents,
    goal.initial_amount_cents,
    goal.currency,
    goal.due_date,
    goal.funding_source,
    goal.category_id,
    goal.status,
    goal.note,
    goal.created_at,
    goal.updated_at,
  );
  return goal;
}

export async function listGoals(opts: { status?: GoalStatus } = {}): Promise<GoalWithProgress[]> {
  const db = await getDb();
  const where = opts.status ? 'WHERE g.status = ?' : '';
  const rows = await db.getAllAsync<GoalWithProgress>(
    `SELECT g.*,
            COALESCE((SELECT SUM(c.amount_cents) FROM goal_contributions c WHERE c.goal_id = g.id), 0) AS contributed_cents,
            g.initial_amount_cents + COALESCE((SELECT SUM(c.amount_cents) FROM goal_contributions c WHERE c.goal_id = g.id), 0) AS saved_cents
       FROM goals g
       ${where}
      ORDER BY g.due_date ASC`,
    ...(opts.status ? [opts.status] : []),
  );
  return rows;
}

export async function getGoal(id: string): Promise<GoalWithProgress | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<GoalWithProgress>(
    `SELECT g.*,
            COALESCE((SELECT SUM(c.amount_cents) FROM goal_contributions c WHERE c.goal_id = g.id), 0) AS contributed_cents,
            g.initial_amount_cents + COALESCE((SELECT SUM(c.amount_cents) FROM goal_contributions c WHERE c.goal_id = g.id), 0) AS saved_cents
       FROM goals g WHERE g.id = ?`,
    id,
  );
  return row ?? null;
}

export async function updateGoal(id: string, patch: UpdateGoalInput): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  const push = (col: string, val: string | number | null) => {
    sets.push(`${col} = ?`);
    args.push(val);
  };
  if (patch.name !== undefined) push('name', patch.name);
  if (patch.target_amount_cents !== undefined) push('target_amount_cents', patch.target_amount_cents);
  if (patch.initial_amount_cents !== undefined) push('initial_amount_cents', patch.initial_amount_cents);
  if (patch.currency !== undefined) push('currency', patch.currency);
  if (patch.due_date !== undefined) push('due_date', patch.due_date);
  if (patch.funding_source !== undefined) push('funding_source', patch.funding_source);
  if (patch.category_id !== undefined) push('category_id', patch.category_id);
  if (patch.status !== undefined) push('status', patch.status);
  if (patch.note !== undefined) push('note', patch.note);
  if (sets.length === 0) return;
  push('updated_at', new Date().toISOString());
  args.push(id);
  await db.runAsync(`UPDATE goals SET ${sets.join(', ')} WHERE id = ?`, ...args);
}

export async function deleteGoal(id: string): Promise<void> {
  const db = await getDb();
  // goal_contributions cae por CASCADE
  await db.runAsync('DELETE FROM goals WHERE id = ?', id);
}

// ---------- Ledger / historial ----------

export interface NewContributionInput {
  goal_id: string;
  amount_cents: number;
  occurred_at: string; // 'YYYY-MM-DD'
  income_occurrence_id?: string | null;
  source?: ContributionSource;
  note?: string | null;
}

/** Inserta un aporte. Si tras el aporte la meta queda fondeada, marca status='completed'. */
export async function addContribution(input: NewContributionInput): Promise<GoalContribution> {
  const db = await getDb();
  const now = new Date().toISOString();
  const contribution: GoalContribution = {
    id: randomUUID(),
    goal_id: input.goal_id,
    amount_cents: input.amount_cents,
    occurred_at: input.occurred_at,
    period: input.occurred_at.slice(0, 7),
    income_occurrence_id: input.income_occurrence_id ?? null,
    source: input.source ?? 'auto',
    note: input.note ?? null,
    created_at: now,
  };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO goal_contributions (id, goal_id, amount_cents, occurred_at, period, income_occurrence_id, source, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      contribution.id,
      contribution.goal_id,
      contribution.amount_cents,
      contribution.occurred_at,
      contribution.period,
      contribution.income_occurrence_id,
      contribution.source,
      contribution.note,
      contribution.created_at,
    );
    const g = await db.getFirstAsync<{ target: number; saved: number }>(
      `SELECT target_amount_cents AS target,
              initial_amount_cents + COALESCE((SELECT SUM(amount_cents) FROM goal_contributions WHERE goal_id = ?), 0) AS saved
         FROM goals WHERE id = ?`,
      input.goal_id,
      input.goal_id,
    );
    if (g && g.saved >= g.target) {
      await db.runAsync(
        `UPDATE goals SET status = 'completed', updated_at = ? WHERE id = ? AND status = 'active'`,
        now,
        input.goal_id,
      );
    }
  });
  return contribution;
}

/** Historial de aportes de una meta, más reciente primero. */
export async function listContributions(goalId: string): Promise<GoalContribution[]> {
  const db = await getDb();
  return db.getAllAsync<GoalContribution>(
    'SELECT * FROM goal_contributions WHERE goal_id = ? ORDER BY occurred_at DESC, created_at DESC',
    goalId,
  );
}

/** Historial global de aportes de un período (para el desglose "por quincena"). */
export async function listContributionsByPeriod(period: string): Promise<GoalContribution[]> {
  const db = await getDb();
  return db.getAllAsync<GoalContribution>(
    'SELECT * FROM goal_contributions WHERE period = ? ORDER BY occurred_at DESC',
    period,
  );
}

/** Aportes ligados a una ocurrencia de ingreso (para evitar doble registro). */
export async function listContributionsByOccurrence(
  occurrenceId: string,
): Promise<GoalContribution[]> {
  const db = await getDb();
  return db.getAllAsync<GoalContribution>(
    'SELECT * FROM goal_contributions WHERE income_occurrence_id = ?',
    occurrenceId,
  );
}

export async function deleteContribution(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM goal_contributions WHERE id = ?', id);
}

/**
 * Reserva del período para los sobres, separada por funding_source y moneda.
 * Suma perPaycheck × (quincenas de este período aún por venir desde asOf).
 * Devuelve centavos. Lo usa budgets/repository.
 */
export async function getPeriodGoalReservations(
  period: string,
  currency: string,
  asOf: string,
): Promise<{ offTop: number; fromSavings: number }> {
  const goals = await listGoals({ status: 'active' });

  const periodStart = `${period}-01`;
  const periodEnd = `${period}-31`; // límite holgado; paydaysBetween filtra por fechas válidas
  const lowerBound = asOf > periodStart ? asOf : periodStart;
  const remainingPaydaysThisPeriod = paydaysBetween(
    shiftDay(lowerBound, -1), // -1 para incluir asOf si es quincena
    periodEnd,
  ).filter((d) => d.slice(0, 7) === period);

  const mapped = goals.map((g) => ({
    id: g.id,
    name: g.name,
    currency: g.currency,
    targetAmount: g.target_amount_cents,
    initialAmount: g.initial_amount_cents,
    contributedAmount: g.contributed_cents,
    dueDate: g.due_date,
    fundingSource: g.funding_source,
  }));

  let offTop = 0;
  let fromSavings = 0;
  for (const payday of remainingPaydaysThisPeriod) {
    const res = computeReservations({ asOf: payday, currency, goals: mapped });
    offTop += res.totalOffTop;
    fromSavings += res.totalFromSavings;
  }
  return { offTop, fromSavings };
}

function shiftDay(iso: string, days: number): string {
  const dt = new Date(`${iso}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
