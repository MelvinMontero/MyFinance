import { format, parseISO } from 'date-fns';
import { randomUUID } from 'expo-crypto';

import { getQuincena, quincenaKey } from '@/features/cycle/cycle';
import { getDb } from '@/shared/db';
import type {
  Goal,
  GoalContribution,
  GoalContributionSource,
  GoalPriority,
  SqliteBoolean,
} from '@/shared/db/types';
import { convertCents } from '@/shared/utils/exchange';

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
  /**
   * Lo que FALTA apartar esta quincena = cuota al inicio de la quincena menos
   * lo ya aportado en ella (nunca negativo). Esto alimenta el sobre Metas:
   * una vez aportada la cuota, la reserva de esta quincena baja a 0 en vez de
   * seguir cobrando la cuota recalculada.
   */
  quincena_ask_cents: number;
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

/**
 * Quita SOLO el aporte hecho con el check del Inicio en esa quincena.
 * Los abonos manuales (source='manual') NUNCA se tocan desde acá — desmarcar
 * el check no puede borrar plata que el usuario registró a mano.
 */
export async function removeQuincenaCheckContribution(
  goalId: string,
  quincenaKeyValue: string,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "DELETE FROM goal_contributions WHERE goal_id = ? AND quincena_key = ? AND source = 'check'",
    goalId,
    quincenaKeyValue,
  );
}

export interface AddContributionOptions {
  /** Fecha del aporte ('yyyy-MM-dd'). Default: hoy. Define la quincena_key. */
  contributedAt?: string;
  /** 'manual' (abono libre, default) o 'check' (check quincenal del Inicio). */
  source?: GoalContributionSource;
}

/**
 * Registra un aporte a una meta. La fecha define la quincena (quincena_key).
 * Con source='check' es IDEMPOTENTE: el índice UNIQUE parcial (v8) garantiza a
 * lo sumo un aporte de check por (meta, quincena) — un doble-tap no duplica.
 */
export async function addContribution(
  goalId: string,
  amountCents: number,
  options: AddContributionOptions = {},
): Promise<GoalContribution> {
  const db = await getDb();
  const now = new Date().toISOString();
  const contributedAt = options.contributedAt ?? format(new Date(), 'yyyy-MM-dd');
  const source = options.source ?? 'manual';
  const row: GoalContribution = {
    id: randomUUID(),
    goal_id: goalId,
    amount_cents: amountCents,
    contributed_at: contributedAt,
    quincena_key: quincenaKey(getQuincena(contributedAt)),
    source,
    created_at: now,
  };
  // OR IGNORE solo tiene efecto para 'check' (índice UNIQUE parcial): si el
  // check ya existe, el INSERT se descarta en vez de duplicar el aporte.
  await db.runAsync(
    `INSERT OR IGNORE INTO goal_contributions (id, goal_id, amount_cents, contributed_at, quincena_key, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    row.goal_id,
    row.amount_cents,
    row.contributed_at,
    row.quincena_key,
    row.source,
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

/**
 * Cuota pendiente de ESTA quincena: cuota calculada al INICIO de la quincena
 * (antes de sus aportes) menos lo ya aportado en ella, nunca negativa. Así,
 * marcar el check (o abonar la cuota a mano) deja la reserva de la quincena en
 * 0 en vez de re-cobrar la cuota recalculada sobre el nuevo saldo.
 */
function computeQuincenaAsk(
  goal: Goal,
  savedCents: number,
  contributedThisQuincena: number,
  from: Date,
): number {
  const planAtStart = calculateGoalPlan({
    targetCents: goal.target_cents,
    savedCents: savedCents - contributedThisQuincena,
    from,
    deadline: parseISO(goal.deadline),
  });
  return Math.max(0, planAtStart.perQuincenaCents - contributedThisQuincena);
}

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
      quincena_ask_cents: computeQuincenaAsk(g, saved_cents, contributed_this_quincena, from),
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
    quincena_ask_cents: computeQuincenaAsk(g, saved_cents, contributed_this_quincena, from),
    plan,
  };
}

/**
 * Reserva total pendiente para metas esta quincena, expresada en `viewCurrency`.
 * Suma la cuota PENDIENTE (ask) de TODAS las metas activas, convirtiendo las de
 * otra moneda con la tasa aproximada — mismo criterio que usa el Inicio, para
 * que la alerta de sobregasto y el dashboard no se contradigan.
 * Alimenta `goalsReserveAmount` del presupuesto quincenal.
 */
export async function getGoalsReserve(
  from: Date,
  viewCurrency: string,
  usdToCrcRate: number,
): Promise<number> {
  const plans = await listGoalsWithPlan(from);
  return plans.reduce(
    (sum, g) => sum + convertCents(g.quincena_ask_cents, g.currency, viewCurrency, usdToCrcRate),
    0,
  );
}
