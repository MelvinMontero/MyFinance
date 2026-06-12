// src/features/goals/calculate.ts
import { countPaydaysAfter } from './paydays';

/**
 * Motor de metas (sinking funds). FUNCIÓN PURA — sin DB, sin Date.now().
 * Dado el estado de una meta y la fecha de evaluación, calcula cuánto
 * apartar en CADA quincena restante para llegar al objetivo a tiempo.
 *
 *   saved        = initial (prima) + contributed (ledger)
 *   remaining    = max(0, target − saved)
 *   paychecksLeft= quincenas en (asOf, dueDate]   (15 y fin de mes)
 *   perPaycheck  = ceil(remaining / paychecksLeft) en centavos
 *
 * Todo en CENTAVOS ENTEROS.
 */

export interface CalculateGoalPlanInput {
  targetAmount: number; // centavos ≥ 0
  initialAmount: number; // centavos ≥ 0 (prima)
  contributedAmount: number; // centavos ≥ 0 (suma del ledger)
  dueDate: string; // 'YYYY-MM-DD'
  asOf: string; // 'YYYY-MM-DD'
}

export interface GoalPlan {
  target: number;
  saved: number; // initial + contributed
  remaining: number; // max(0, target − saved)
  paychecksLeft: number;
  perPaycheck: number; // a reservar en la próxima quincena
  progressRatio: number; // saved / target en [0,1]
  isFunded: boolean;
  isOverdue: boolean; // due < asOf y no fondeada
  isUrgent: boolean; // 0 quincenas restantes y falta plata
}

export function calculateGoalPlan(input: CalculateGoalPlanInput): GoalPlan {
  const { targetAmount, initialAmount, contributedAmount, dueDate, asOf } = input;

  assertNonNegativeFinite(targetAmount, 'targetAmount');
  assertNonNegativeFinite(initialAmount, 'initialAmount');
  assertNonNegativeFinite(contributedAmount, 'contributedAmount');
  assertIsoDate(dueDate, 'dueDate');
  assertIsoDate(asOf, 'asOf');

  const saved = initialAmount + contributedAmount;
  const remaining = Math.max(0, targetAmount - saved);
  const paychecksLeft = countPaydaysAfter(asOf, dueDate);
  const isFunded = remaining === 0;
  const isOverdue = !isFunded && dueDate < asOf;

  let perPaycheck: number;
  let isUrgent = false;
  if (isFunded) {
    perPaycheck = 0;
  } else if (paychecksLeft <= 0) {
    perPaycheck = remaining; // hay que reservar todo en la próxima entrada
    isUrgent = true;
  } else {
    perPaycheck = Math.ceil(remaining / paychecksLeft);
  }

  const progressRatio = targetAmount === 0 ? 1 : Math.min(1, saved / targetAmount);

  return {
    target: targetAmount,
    saved,
    remaining,
    paychecksLeft,
    perPaycheck,
    progressRatio,
    isFunded,
    isOverdue,
    isUrgent,
  };
}

function assertNonNegativeFinite(v: number, name: string): void {
  if (!Number.isFinite(v) || v < 0) {
    throw new Error(`${name} debe ser un número finito ≥ 0 (recibido: ${v})`);
  }
}

function assertIsoDate(v: string, name: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new Error(`${name} debe ser 'YYYY-MM-DD' (recibido: ${v})`);
  }
}
