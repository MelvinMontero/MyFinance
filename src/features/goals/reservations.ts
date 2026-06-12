// src/features/goals/reservations.ts
import type { GoalFundingSource } from '@/shared/db/types';

import { calculateGoalPlan } from './calculate';

export interface ReservationGoalInput {
  id: string;
  name: string;
  currency: string;
  targetAmount: number;
  initialAmount: number;
  contributedAmount: number;
  dueDate: string;
  fundingSource: GoalFundingSource;
}

export interface ReservationLine {
  goalId: string;
  name: string;
  amount: number; // centavos a reservar esta quincena
  fundingSource: GoalFundingSource;
  isUrgent: boolean;
}

export interface ReservationResult {
  perGoal: ReservationLine[];
  totalOffTop: number;
  totalFromSavings: number;
  total: number;
}

export interface ComputeReservationsInput {
  asOf: string; // 'YYYY-MM-DD'
  currency: string; // solo metas en esta moneda
  goals: ReservationGoalInput[];
}

/**
 * Para una quincena (asOf) y una moneda, calcula cuánto reservar por cada
 * meta activa de esa moneda y agrega los totales según funding_source.
 * Las metas fondeadas (perPaycheck 0) se excluyen del desglose. PURA.
 */
export function computeReservations(input: ComputeReservationsInput): ReservationResult {
  const { asOf, currency, goals } = input;
  const perGoal: ReservationLine[] = [];
  let totalOffTop = 0;
  let totalFromSavings = 0;

  for (const g of goals) {
    if (g.currency !== currency) continue;
    const plan = calculateGoalPlan({
      targetAmount: g.targetAmount,
      initialAmount: g.initialAmount,
      contributedAmount: g.contributedAmount,
      dueDate: g.dueDate,
      asOf,
    });
    if (plan.perPaycheck <= 0) continue;

    perGoal.push({
      goalId: g.id,
      name: g.name,
      amount: plan.perPaycheck,
      fundingSource: g.fundingSource,
      isUrgent: plan.isUrgent,
    });
    if (g.fundingSource === 'off_top') totalOffTop += plan.perPaycheck;
    else totalFromSavings += plan.perPaycheck;
  }

  return {
    perGoal,
    totalOffTop,
    totalFromSavings,
    total: totalOffTop + totalFromSavings,
  };
}
