/**
 * Cálculo de sobres (envelope budgeting). FUNCIÓN PURA — sin DB, sin
 * efectos. El caller (repository) agrega los totales desde SQLite y los
 * pasa acá.
 *
 * Algoritmo del spec:
 *   savings    = round(income × savings_percent / 100)
 *   free_money = income − savings − fixed_expenses
 *   remaining  = free_money − variable_expenses
 *
 * Todos los montos viven como CENTAVOS ENTEROS (Math.round). Esto evita
 * errores de coma flotante al sumar. La identidad
 *   income = savings + free_money + fixed_expenses
 * se mantiene por construcción.
 */

export interface CalculateBucketsInput {
  /** Total de ingresos del período, centavos enteros ≥ 0. */
  incomeAmount: number;
  /** % objetivo de ahorro, 0 a 100. Admite fracciones (ej. 20.5). */
  savingsPercent: number;
  /** Total de gastos fijos del período, centavos enteros ≥ 0. */
  fixedExpensesAmount: number;
  /** Total ya gastado en gastos variables del período, centavos enteros ≥ 0. */
  variableExpensesAmount: number;
  /** Reservas de metas "aparte" (off_top) del período. Descuentan dinero libre. Default 0. */
  goalReservationsOffTop?: number;
  /** Reservas de metas que salen del sobre Ahorro. No cambian dinero libre. Default 0. */
  goalReservationsFromSavings?: number;
}

export interface BucketBreakdown {
  /** Ingreso total del período. */
  income: number;
  /** Reservado para el sobre de ahorro (round(income × pct / 100)). */
  savings: number;
  /** Total de gastos fijos del período. */
  fixedExpenses: number;
  /** Dinero libre disponible = income − savings − fixedExpenses. Puede ser negativo. */
  freeMoney: number;
  /** Ya gastado del dinero libre. */
  variableExpensesSpent: number;
  /** Lo que queda del dinero libre = freeMoney − variableExpensesSpent. Puede ser negativo. */
  freeMoneyRemaining: number;
  /** True cuando ahorro + fijos superan el ingreso (freeMoney < 0). */
  isOverBudget: boolean;
  /** True cuando los gastos variables superan el dinero libre (remaining < 0). */
  isOverspent: boolean;
  goalReservationsOffTop: number;
  goalReservationsFromSavings: number;
  /** Parte del ahorro ya comprometida en metas from_savings. */
  savingsCommittedToGoals: number;
  /** Ahorro disponible = savings − savingsCommittedToGoals (puede ser negativo). */
  savingsUncommitted: number;
  /** True cuando las metas from_savings exceden el sobre Ahorro. */
  isSavingsOvercommitted: boolean;
}

export function calculateBuckets(input: CalculateBucketsInput): BucketBreakdown {
  const {
    incomeAmount,
    savingsPercent,
    fixedExpensesAmount,
    variableExpensesAmount,
    goalReservationsOffTop = 0,
    goalReservationsFromSavings = 0,
  } = input;

  assertNonNegativeFinite(incomeAmount, 'incomeAmount');
  assertNonNegativeFinite(fixedExpensesAmount, 'fixedExpensesAmount');
  assertNonNegativeFinite(variableExpensesAmount, 'variableExpensesAmount');
  assertNonNegativeFinite(goalReservationsOffTop, 'goalReservationsOffTop');
  assertNonNegativeFinite(goalReservationsFromSavings, 'goalReservationsFromSavings');
  assertPercentInRange(savingsPercent);

  const savings = Math.round((incomeAmount * savingsPercent) / 100);
  const freeMoney = incomeAmount - savings - fixedExpensesAmount - goalReservationsOffTop;
  const freeMoneyRemaining = freeMoney - variableExpensesAmount;
  const savingsUncommitted = savings - goalReservationsFromSavings;

  return {
    income: incomeAmount,
    savings,
    fixedExpenses: fixedExpensesAmount,
    freeMoney,
    variableExpensesSpent: variableExpensesAmount,
    freeMoneyRemaining,
    goalReservationsOffTop,
    goalReservationsFromSavings,
    savingsCommittedToGoals: goalReservationsFromSavings,
    savingsUncommitted,
    isOverBudget: freeMoney < 0,
    isOverspent: freeMoneyRemaining < 0,
    isSavingsOvercommitted: goalReservationsFromSavings > savings,
  };
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} debe ser un número finito (recibido: ${value})`);
  }
  if (value < 0) {
    throw new Error(`${name} debe ser ≥ 0 (recibido: ${value})`);
  }
}

function assertPercentInRange(value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`savingsPercent debe ser un número finito (recibido: ${value})`);
  }
  if (value < 0 || value > 100) {
    throw new Error(`savingsPercent debe estar entre 0 y 100 (recibido: ${value})`);
  }
}
