// src/features/goals/reservations.test.ts
import { computeReservations, type ReservationGoalInput } from './reservations';

const base: Omit<ReservationGoalInput, 'id' | 'fundingSource'> = {
  name: 'X',
  currency: 'CRC',
  targetAmount: 80_000_000,
  initialAmount: 20_000_000,
  contributedAmount: 0,
  dueDate: '2026-08-31',
};

describe('computeReservations', () => {
  it('calcula el aporte por meta y agrega los totales por funding_source', () => {
    const result = computeReservations({
      asOf: '2026-07-01',
      currency: 'CRC',
      goals: [
        { ...base, id: 'g1', name: 'Intercambio', fundingSource: 'off_top' },
        {
          ...base,
          id: 'g2',
          name: 'Viaje',
          fundingSource: 'from_savings',
          targetAmount: 40_000_000,
          initialAmount: 0,
        },
      ],
    });
    expect(result.perGoal).toHaveLength(2);
    expect(result.perGoal[0]).toMatchObject({ goalId: 'g1', amount: 15_000_000 });
    expect(result.totalOffTop).toBe(15_000_000);
    expect(result.totalFromSavings).toBe(10_000_000); // 40M/4 quincenas
    expect(result.total).toBe(25_000_000);
  });

  it('ignora metas de otra moneda', () => {
    const result = computeReservations({
      asOf: '2026-07-01',
      currency: 'CRC',
      goals: [
        { ...base, id: 'g1', fundingSource: 'off_top' },
        { ...base, id: 'g2', currency: 'USD', fundingSource: 'off_top' },
      ],
    });
    expect(result.perGoal).toHaveLength(1);
    expect(result.perGoal[0]!.goalId).toBe('g1');
  });

  it('excluye metas fondeadas (perPaycheck 0)', () => {
    const result = computeReservations({
      asOf: '2026-07-01',
      currency: 'CRC',
      goals: [
        { ...base, id: 'g1', fundingSource: 'off_top', initialAmount: 80_000_000 },
      ],
    });
    expect(result.perGoal).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
