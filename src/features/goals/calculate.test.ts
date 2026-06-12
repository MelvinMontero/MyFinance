// src/features/goals/calculate.test.ts
import { calculateGoalPlan } from './calculate';

describe('calculateGoalPlan', () => {
  it('reparte el faltante entre las quincenas restantes (caso programa de intercambio)', () => {
    // Objetivo ₡800.000, prima ₡200.000, nada aportado. asOf 1/7, due 31/8 → 4 quincenas.
    const plan = calculateGoalPlan({
      targetAmount: 80_000_000, // ₡800.000 en centavos
      initialAmount: 20_000_000, // ₡200.000
      contributedAmount: 0,
      dueDate: '2026-08-31',
      asOf: '2026-07-01',
    });
    expect(plan.saved).toBe(20_000_000);
    expect(plan.remaining).toBe(60_000_000);
    expect(plan.paychecksLeft).toBe(4);
    expect(plan.perPaycheck).toBe(15_000_000); // ₡150.000 por quincena
    expect(plan.isFunded).toBe(false);
    expect(plan.isOverdue).toBe(false);
  });

  it('redondea el aporte por quincena hacia arriba (centavos)', () => {
    const plan = calculateGoalPlan({
      targetAmount: 100,
      initialAmount: 0,
      contributedAmount: 0,
      dueDate: '2026-08-31',
      asOf: '2026-07-16', // quincenas: 31/7, 15/8, 31/8 = 3
    });
    expect(plan.paychecksLeft).toBe(3);
    expect(plan.perPaycheck).toBe(34); // ceil(100/3)
  });

  it('meta ya fondeada → perPaycheck 0 e isFunded true', () => {
    const plan = calculateGoalPlan({
      targetAmount: 5_000_000,
      initialAmount: 5_000_000,
      contributedAmount: 0,
      dueDate: '2026-12-31',
      asOf: '2026-07-01',
    });
    expect(plan.remaining).toBe(0);
    expect(plan.perPaycheck).toBe(0);
    expect(plan.isFunded).toBe(true);
  });

  it('sin quincenas restantes y faltante > 0 → hay que reservar todo ya', () => {
    const plan = calculateGoalPlan({
      targetAmount: 1_000_000,
      initialAmount: 0,
      contributedAmount: 0,
      dueDate: '2026-07-20', // due entre quincenas
      asOf: '2026-07-16', // próxima quincena 31/7 > due → 0
    });
    expect(plan.paychecksLeft).toBe(0);
    expect(plan.perPaycheck).toBe(1_000_000);
    expect(plan.isUrgent).toBe(true);
  });

  it('fecha límite ya pasada y meta sin fondear → isOverdue', () => {
    const plan = calculateGoalPlan({
      targetAmount: 1_000_000,
      initialAmount: 0,
      contributedAmount: 0,
      dueDate: '2026-06-30',
      asOf: '2026-07-01',
    });
    expect(plan.isOverdue).toBe(true);
    expect(plan.perPaycheck).toBe(1_000_000);
  });

  it('aportes parciales reducen el faltante', () => {
    const plan = calculateGoalPlan({
      targetAmount: 80_000_000,
      initialAmount: 20_000_000,
      contributedAmount: 15_000_000,
      dueDate: '2026-08-31',
      asOf: '2026-07-16', // quedan 3 quincenas
    });
    expect(plan.saved).toBe(35_000_000);
    expect(plan.remaining).toBe(45_000_000);
    expect(plan.paychecksLeft).toBe(3);
    expect(plan.perPaycheck).toBe(15_000_000);
  });

  it('valida entradas inválidas', () => {
    expect(() =>
      calculateGoalPlan({
        targetAmount: -1,
        initialAmount: 0,
        contributedAmount: 0,
        dueDate: '2026-08-31',
        asOf: '2026-07-01',
      }),
    ).toThrow();
  });
});
