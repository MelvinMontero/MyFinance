import { format, parseISO } from 'date-fns';
import { randomUUID } from 'expo-crypto';

import { getQuincena, quincenaKey } from '@/features/cycle/cycle';
import { getDb } from '@/shared/db';
import type { Goal, GoalContribution, GoalPriority, SqliteBoolean } from '@/shared/db/types';

import { calculateGoalPlan, type GoalPlan } from './calc';

export interface NewGoalInput {
  name: string;
  target_cents: number;
  currency: string;
  start_date: string; // 'yyyy-MM-dd'
  deadline: string; // 'yyyy-MM-dd'
  priority: GoalPriority;
}

export interface UpdateGoalInput {
  name?: string;
  target_cents?: number;
  currency?: string;
  start_date?: string;
  deadline?: string;
  priority?: GoalPriority;
  is_active?: boolean;
}

/** Meta + total ahorrado + plan calculado a una fecha dada. */
export interface GoalWithPlan extends Goal {
  saved_cents: number;
  /** Aportado en la quincena en curso (quincena_key actual). */
  contributed_this_quincena: number;
  /** Cuota sugerida a apartar esta quincena (= plan.perQuincenaCents, sobre el saldo real). */
  quincena_quota_cents: number;
  plan: GoalPlan;
}

export async function createGoal(input: NewGoalInput): Promise<Goal> {
  const db = await getDb();
  const now = new Date().toISOString();

  const row: Goal = {
    id: randomUUID(),
    name: input.name,
    target_cents: input.target_cents,
    currency: input.currency,
    start_date: input.start_date,
    deadline: input.deadline,
    priority: input.priority,
    is_active: 1 as SqliteBoolean,
    created_at: now,
    updated_at: now,
  };

  await db.runAsync(
    `INSERT INTO goals (id, name, target_cents, currency, start_date, deadline, priority, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    row.name,
    row.target_cents,
    row.currency,
    row.start_date,
    row.deadline,
    row.priority,
    row.is_active,
    row.created_at,
    row.updated_at,
  );

  return row;
}

/** Lista metas ordenadas por prioridad (alta primero) y luego por deadline. */
export async function listGoals(opts: { active?: boolean } = { active: true }): Promise<Goal[]> {
  const db = await getDb();
  const where = opts.active === undefined ? '' : 'WHERE is_active = ?';
  const args = opts.active === undefined ? [] : [opts.active ? 1 : 0];
  return db.getAllAsync<Goal>(
    `SELECT * FROM goals ${where}
      ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
               deadline ASC`,
    ...args,
  );
}

export async function getGoal(id: string): Promise<Goal | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Goal>('SELECT * FROM goals WHERE id = ?', id);
  return row ?? null;
}

export async function updateGoal(id: string, patch: UpdateGoalInput): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const args: (string | number)[] = [];

  if (patch.name !== undefined) {
    sets.push('name = ?');
    args.push(patch.name);
  }
  if (patch.target_cents !== undefined) {
    sets.push('target_cents = ?');
    args.push(patch.target_cents);
  }
  if (patch.currency !== undefined) {
    sets.push('currency = ?');
    args.push(patch.currency);
  }
  if (patch.start_date !== undefined) {
    sets.push('start_date = ?');
    args.push(patch.start_date);
  }
  if (patch.deadline !== undefined) {
    sets.push('deadline = ?');
    args.push(patch.deadline);
  }
  if (patch.priority !== undefined) {
    sets.push('priority = ?');
    args.push(patch.priority);
  }
  if (patch.is_active !== undefined) {
    sets.push('is_active = ?');
    args.push(patch.is_active ? 1 : 0);
  }
  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  args.push(new Date().toISOString());
  args.push(id);

  await db.runAsync(`UPDATE goals SET ${sets.join(', ')} WHERE id = ?`, ...args);
}

/** CASCADE elimina las contribuciones asociadas. */
export async function deleteGoal(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM goals WHERE id = ?', id);
}

/* ===== CONTRIBUCIONES ===== */

/** Total ahorrado por meta, como mapa goal_id → centavos. */
async function getSavedMap(): Promise<Map<string, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ goal_id: string; saved: number }>(
    `SELECT goal_id, COALESCE(SUM(amount_cents), 0) AS saved
       FROM goal_contributions GROUP BY goal_id`,
  );
  return new Map(rows.map((r) => [r.goal_id, r.saved]));
}

export async function getGoalSaved(goalId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ saved: number }>(
    'SELECT COALESCE(SUM(amount_cents), 0) AS saved FROM goal_contributions WHERE goal_id = ?',
    goalId,
  );
  return row?.saved ?? 0;
}

/** Total aportado por meta en una quincena (quincena_key), como mapa. */
async function getThisQuincenaMap(quincenaKeyValue: string): Promise<Map<string, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ goal_id: string; saved: number }>(
    `SELECT goal_id, COALESCE(SUM(amount_cents), 0) AS saved
       FROM goal_contributions WHERE quincena_key = ? GROUP BY goal_id`,
    quincenaKeyValue,
  );
  return new Map(rows.map((r) => [r.goal_id, r.saved]));
}

/** Borra los aportes de una meta en una quincena (para desmarcar). */
export async function removeQuincenaContributions(
  goalId: string,
  quincenaKeyValue: string,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'DELETE FROM goal_contributions WHERE goal_id = ? AND quincena_key = ?',
    goalId,
    quincenaKeyValue,
  );
}

/**
 * Registra un aporte a una meta. La fecha define la quincena (quincena_key).
 */
export async function addContribution(
  goalId: string,
  amountCents: number,
  contributedAt: string = format(new Date(), 'yyyy-MM-dd'),
): Promise<GoalContribution> {
  const db = await getDb();
  const now = new Date().toISOString();
  const row: GoalContribution = {
    id: randomUUID(),
    goal_id: goalId,
    amount_cents: amountCents,
    contributed_at: contributedAt,
    quincena_key: quincenaKey(getQuincena(contributedAt)),
    created_at: now,
  };
  await db.runAsync(
    `INSERT INTO goal_contributions (id, goal_id, amount_cents, contributed_at, quincena_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    row.id,
    row.goal_id,
    row.amount_cents,
    row.contributed_at,
    row.quincena_key,
    row.created_at,
  );
  return row;
}

export async function listContributions(goalId: string): Promise<GoalContribution[]> {
  const db = await getDb();
  return db.getAllAsync<GoalContribution>(
    'SELECT * FROM goal_contributions WHERE goal_id = ? ORDER BY contributed_at DESC',
    goalId,
  );
}

/* ===== PLANES ===== */

/** Metas activas con su total ahorrado, lo aportado esta quincena y plan. */
export async function listGoalsWithPlan(from: Date = new Date()): Promise<GoalWithPlan[]> {
  const goals = await listGoals({ active: true });
  const savedMap = await getSavedMap();
  const thisQMap = await getThisQuincenaMap(quincenaKey(getQuincena(from)));
  return goals.map((g) => {
    const saved_cents = savedMap.get(g.id) ?? 0;
    const contributed_this_quincena = thisQMap.get(g.id) ?? 0;
    // El plan (progreso, cuota, restante) usa el ahorro REAL: cualquier abono
    // baja el restante y recalcula la cuota al instante.
    const plan = calculateGoalPlan({
      targetCents: g.target_cents,
      savedCents: saved_cents,
      from,
      deadline: parseISO(g.deadline),
    });
    return {
      ...g,
      saved_cents,
      contributed_this_quincena,
      quincena_quota_cents: plan.perQuincenaCents,
      plan,
    };
  });
}

/** Una meta con su plan, total ahorrado y aporte de la quincena (para el detalle). */
export async function getGoalWithPlan(
  id: string,
  from: Date = new Date(),
): Promise<GoalWithPlan | null> {
  const g = await getGoal(id);
  if (!g) return null;
  const saved_cents = await getGoalSaved(id);
  const contributed_this_quincena =
    (await getThisQuincenaMap(quincenaKey(getQuincena(from)))).get(id) ?? 0;
  const plan = calculateGoalPlan({
    targetCents: g.target_cents,
    savedCents: saved_cents,
    from,
    deadline: parseISO(g.deadline),
  });
  return {
    ...g,
    saved_cents,
    contributed_this_quincena,
    quincena_quota_cents: plan.perQuincenaCents,
    plan,
  };
}

/**
 * Reserva total sugerida para metas en una moneda y quincena (vista desde `from`).
 * Es la suma de las cuotas quincenales de las metas activas de esa moneda.
 * Alimenta `goalsReserveAmount` del presupuesto quincenal.
 */
export async function getGoalsReserve(from: Date, currency: string): Promise<number> {
  const plans = await listGoalsWithPlan(from);
  return plans
    .filter((g) => g.currency === currency)
    .reduce((sum, g) => sum + g.plan.perQuincenaCents, 0);
}
