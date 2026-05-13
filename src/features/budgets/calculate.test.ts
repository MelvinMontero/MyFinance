import { calculateBuckets, type CalculateBucketsInput } from './calculate';

/** Helper para construir inputs con defaults. Todo en centavos enteros. */
function buildInput(overrides: Partial<CalculateBucketsInput> = {}): CalculateBucketsInput {
  return {
    incomeAmount: 0,
    savingsPercent: 20,
    fixedExpensesAmount: 0,
    variableExpensesAmount: 0,
    ...overrides,
  };
}

describe('calculateBuckets — happy path', () => {
  it('reparte 500k correctamente: 20% ahorro, 200k fijos, 100k variable', () => {
    const r = calculateBuckets(
      buildInput({
        incomeAmount: 50_000_000, // ₡500k
        savingsPercent: 20,
        fixedExpensesAmount: 20_000_000, // ₡200k
        variableExpensesAmount: 10_000_000, // ₡100k
      }),
    );
    expect(r.income).toBe(50_000_000);
    expect(r.savings).toBe(10_000_000); // 20% de 500k = 100k
    expect(r.fixedExpenses).toBe(20_000_000);
    expect(r.freeMoney).toBe(20_000_000); // 500k - 100k - 200k = 200k
    expect(r.variableExpensesSpent).toBe(10_000_000);
    expect(r.freeMoneyRemaining).toBe(10_000_000); // 200k - 100k = 100k
    expect(r.isOverBudget).toBe(false);
    expect(r.isOverspent).toBe(false);
  });

  it('arroja cero en todos los buckets cuando no hay datos', () => {
    const r = calculateBuckets(buildInput());
    expect(r.income).toBe(0);
    expect(r.savings).toBe(0);
    expect(r.fixedExpenses).toBe(0);
    expect(r.freeMoney).toBe(0);
    expect(r.freeMoneyRemaining).toBe(0);
    expect(r.isOverBudget).toBe(false);
    expect(r.isOverspent).toBe(false);
  });
});

describe('calculateBuckets — savings_percent edge cases', () => {
  it('savings=0 cuando savings_percent=0 (todo va a fijos+libre)', () => {
    const r = calculateBuckets(
      buildInput({ incomeAmount: 100_000, savingsPercent: 0, fixedExpensesAmount: 30_000 }),
    );
    expect(r.savings).toBe(0);
    expect(r.freeMoney).toBe(70_000);
  });

  it('savings=income cuando savings_percent=100 (no queda nada para fijos ni libre)', () => {
    const r = calculateBuckets(
      buildInput({ incomeAmount: 100_000, savingsPercent: 100, fixedExpensesAmount: 0 }),
    );
    expect(r.savings).toBe(100_000);
    expect(r.freeMoney).toBe(0);
    expect(r.isOverBudget).toBe(false);
  });

  it('savings_percent=100 con fijos > 0 genera over-budget', () => {
    const r = calculateBuckets(
      buildInput({ incomeAmount: 100_000, savingsPercent: 100, fixedExpensesAmount: 10_000 }),
    );
    expect(r.savings).toBe(100_000);
    expect(r.freeMoney).toBe(-10_000);
    expect(r.isOverBudget).toBe(true);
  });

  it('admite savings_percent fraccional (ej 20.5%)', () => {
    const r = calculateBuckets(
      buildInput({ incomeAmount: 100_000, savingsPercent: 20.5 }),
    );
    // 20.5% de 100000 = 20500 centavos exactos
    expect(r.savings).toBe(20_500);
  });
});

describe('calculateBuckets — over-budget', () => {
  it('detecta over-budget cuando ahorro + fijos > ingreso', () => {
    // income=100k, savings=50k (50%), fixed=80k → free = 100-50-80 = -30k
    const r = calculateBuckets(
      buildInput({
        incomeAmount: 100_000,
        savingsPercent: 50,
        fixedExpensesAmount: 80_000,
      }),
    );
    expect(r.savings).toBe(50_000);
    expect(r.freeMoney).toBe(-30_000);
    expect(r.isOverBudget).toBe(true);
  });

  it('NO over-budget cuando free money es exactamente 0', () => {
    const r = calculateBuckets(
      buildInput({
        incomeAmount: 100_000,
        savingsPercent: 20,
        fixedExpensesAmount: 80_000,
      }),
    );
    expect(r.freeMoney).toBe(0);
    expect(r.isOverBudget).toBe(false);
  });
});

describe('calculateBuckets — overspent', () => {
  it('detecta overspent cuando variable > dinero libre', () => {
    // freeMoney=200k, variable=250k → remaining=-50k
    const r = calculateBuckets(
      buildInput({
        incomeAmount: 500_000,
        savingsPercent: 20,
        fixedExpensesAmount: 200_000,
        variableExpensesAmount: 250_000,
      }),
    );
    expect(r.freeMoney).toBe(200_000);
    expect(r.freeMoneyRemaining).toBe(-50_000);
    expect(r.isOverspent).toBe(true);
  });

  it('NO overspent cuando variable es exactamente freeMoney', () => {
    const r = calculateBuckets(
      buildInput({
        incomeAmount: 500_000,
        savingsPercent: 20,
        fixedExpensesAmount: 200_000,
        variableExpensesAmount: 200_000,
      }),
    );
    expect(r.freeMoneyRemaining).toBe(0);
    expect(r.isOverspent).toBe(false);
  });

  it('puede ser over-budget Y overspent a la vez', () => {
    // free=-30k, variable=10k → remaining=-40k. Both flags true.
    const r = calculateBuckets(
      buildInput({
        incomeAmount: 100_000,
        savingsPercent: 50,
        fixedExpensesAmount: 80_000,
        variableExpensesAmount: 10_000,
      }),
    );
    expect(r.isOverBudget).toBe(true);
    expect(r.isOverspent).toBe(true);
    expect(r.freeMoneyRemaining).toBe(-40_000);
  });
});

describe('calculateBuckets — rounding', () => {
  it('redondea el ahorro al centavo más cercano (half-up)', () => {
    // 33% de 10000 = 3300 exacto
    expect(calculateBuckets(buildInput({ incomeAmount: 10_000, savingsPercent: 33 })).savings).toBe(3_300);
    // 33% de 10001 = 3300.33 → round = 3300
    expect(calculateBuckets(buildInput({ incomeAmount: 10_001, savingsPercent: 33 })).savings).toBe(3_300);
    // 33.5% de 10000 = 3350 exacto
    expect(calculateBuckets(buildInput({ incomeAmount: 10_000, savingsPercent: 33.5 })).savings).toBe(3_350);
  });

  it('mantiene la identidad income = savings + (freeMoney + fixed) sin pérdida de centavo', () => {
    const r = calculateBuckets(
      buildInput({
        incomeAmount: 12_345,
        savingsPercent: 17,
        fixedExpensesAmount: 4_321,
      }),
    );
    // El delta tras redondear el ahorro debe quedar en freeMoney, no perderse
    expect(r.savings + r.freeMoney + r.fixedExpenses).toBe(r.income);
  });
});

describe('calculateBuckets — validación de entradas', () => {
  it('lanza si incomeAmount es negativo', () => {
    expect(() => calculateBuckets(buildInput({ incomeAmount: -1 }))).toThrow();
  });

  it('lanza si fixedExpensesAmount es negativo', () => {
    expect(() => calculateBuckets(buildInput({ fixedExpensesAmount: -1 }))).toThrow();
  });

  it('lanza si variableExpensesAmount es negativo', () => {
    expect(() => calculateBuckets(buildInput({ variableExpensesAmount: -1 }))).toThrow();
  });

  it('lanza si savings_percent < 0', () => {
    expect(() => calculateBuckets(buildInput({ savingsPercent: -1 }))).toThrow();
  });

  it('lanza si savings_percent > 100', () => {
    expect(() => calculateBuckets(buildInput({ savingsPercent: 101 }))).toThrow();
  });

  it('lanza con NaN o Infinity', () => {
    expect(() => calculateBuckets(buildInput({ incomeAmount: NaN }))).toThrow();
    expect(() => calculateBuckets(buildInput({ incomeAmount: Infinity }))).toThrow();
    expect(() => calculateBuckets(buildInput({ savingsPercent: NaN }))).toThrow();
  });

  it('acepta savings_percent en los extremos (0 y 100)', () => {
    expect(() => calculateBuckets(buildInput({ savingsPercent: 0 }))).not.toThrow();
    expect(() => calculateBuckets(buildInput({ savingsPercent: 100 }))).not.toThrow();
  });
});

describe('calculateBuckets — el escenario de la docu', () => {
  it('replica el ejemplo del CLAUDE.md (₡1M, 20% ahorro, ₡450k fijos)', () => {
    const r = calculateBuckets(
      buildInput({
        incomeAmount: 100_000_000, // ₡1,000,000
        savingsPercent: 20,
        fixedExpensesAmount: 45_000_000, // ₡450,000
        variableExpensesAmount: 0,
      }),
    );
    expect(r.savings).toBe(20_000_000); // ₡200k
    expect(r.freeMoney).toBe(35_000_000); // ₡350k = 1M - 200k - 450k
    expect(r.freeMoneyRemaining).toBe(35_000_000);
    expect(r.isOverBudget).toBe(false);
  });
});
