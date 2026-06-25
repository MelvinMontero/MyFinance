/**
 * Cálculo de metas de ahorro. FUNCIÓN PURA — sin DB, sin efectos.
 */
import { isAfter, startOfDay } from 'date-fns';

import { countRemainingQuincenas } from '@/features/cycle/cycle';
import type { GoalPriority } from '@/shared/db/types';

export interface GoalPlanInput {
  targetCents: number;
  savedCents: number;
  /** Fecha desde la que se calcula (normalmente hoy). */
  from: Date;
  deadline: Date;
}

export interface GoalPlan {
  /** target − ahorrado, nunca negativo. */
  remainingCents: number;
  /** Quincenas (pagos) disponibles entre `from` y `deadline`. */
  remainingQuincenas: number;
  /** Cuánto retener por quincena para llegar a tiempo (redondeo hacia arriba). */
  perQuincenaCents: number;
  /** ahorrado / target, en [0, 1]. */
  progress: number;
  /** true cuando ya se alcanzó el objetivo. */
  isComplete: boolean;
  /** true cuando la deadline ya pasó y la meta no se cumplió. */
  isOverdue: boolean;
}

/**
 * Calcula el plan de ahorro de una meta.
 * Regla: cuota = ceil(restante / quincenas disponibles). Si no quedan
 * quincenas futuras pero la meta sigue abierta, sugiere el restante en
 * una sola cuota (mejor pedir todo ya que diluir en cero).
 */
export function calculateGoalPlan(input: GoalPlanInput): GoalPlan {
  const { targetCents, savedCents, from, deadline } = input;

  const remainingCents = Math.max(0, targetCents - savedCents);
  const progress = targetCents > 0 ? Math.min(1, savedCents / targetCents) : 1;
  const isComplete = remainingCents === 0;
  const isOverdue = !isComplete && isAfter(startOfDay(from), startOfDay(deadline));

  const remainingQuincenas = countRemainingQuincenas(from, deadline);

  let perQuincenaCents: number;
  if (isComplete) {
    perQuincenaCents = 0;
  } else if (remainingQuincenas <= 0) {
    perQuincenaCents = remainingCents; // sin pagos futuros → todo de una
  } else {
    perQuincenaCents = Math.ceil(remainingCents / remainingQuincenas);
  }

  return {
    remainingCents,
    remainingQuincenas,
    perQuincenaCents,
    progress,
    isComplete,
    isOverdue,
  };
}

const CUT_RANK: Record<GoalPriority, number> = { low: 0, medium: 1, high: 2 };

/**
 * Ordena metas por el orden en que conviene RECORTARLAS ante un déficit:
 * prioridad baja primero, alta al final. Estable dentro de igual prioridad.
 * Devuelve solo los ids, en ese orden.
 */
export function rankGoalsByCutPriority<T extends { id: string; priority: GoalPriority }>(
  goals: T[],
): string[] {
  return goals
    .map((g, index) => ({ g, index }))
    .sort((a, b) => CUT_RANK[a.g.priority] - CUT_RANK[b.g.priority] || a.index - b.index)
    .map(({ g }) => g.id);
}
