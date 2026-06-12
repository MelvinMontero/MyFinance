import { nextPaydayTriggers, goalDueTrigger } from './triggers';

describe('nextPaydayTriggers', () => {
  it('devuelve las próximas N quincenas a las 9am desde una fecha', () => {
    const triggers = nextPaydayTriggers('2026-07-01', 3, 9);
    expect(triggers).toEqual([
      '2026-07-15T09:00:00',
      '2026-07-31T09:00:00',
      '2026-08-15T09:00:00',
    ]);
  });
});

describe('goalDueTrigger', () => {
  it('resta los días de anticipación a la fecha de la meta', () => {
    expect(goalDueTrigger('2026-07-31', 5, 9, '2026-07-01')).toBe('2026-07-26T09:00:00');
  });
  it('si la fecha con anticipación ya pasó respecto a asOf, devuelve null', () => {
    expect(goalDueTrigger('2026-07-31', 5, 9, '2026-07-28')).toBeNull();
  });
});
