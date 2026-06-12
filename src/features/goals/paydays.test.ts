// src/features/goals/paydays.test.ts
import {
  isPayday,
  nextPaydayOnOrAfter,
  paydaysBetween,
  countPaydaysAfter,
} from './paydays';

describe('isPayday', () => {
  it('el 15 es quincena', () => {
    expect(isPayday('2026-07-15')).toBe(true);
  });
  it('el último día del mes es quincena (julio = 31)', () => {
    expect(isPayday('2026-07-31')).toBe(true);
  });
  it('el último día de febrero no bisiesto (28)', () => {
    expect(isPayday('2026-02-28')).toBe(true);
  });
  it('el 28 de un mes de 31 días NO es quincena', () => {
    expect(isPayday('2026-07-28')).toBe(false);
  });
  it('el 14 no es quincena', () => {
    expect(isPayday('2026-07-14')).toBe(false);
  });
});

describe('nextPaydayOnOrAfter', () => {
  it('antes del 15 → devuelve el 15 del mismo mes', () => {
    expect(nextPaydayOnOrAfter('2026-07-01')).toBe('2026-07-15');
  });
  it('en el 15 → devuelve el 15 (inclusive)', () => {
    expect(nextPaydayOnOrAfter('2026-07-15')).toBe('2026-07-15');
  });
  it('entre el 16 y fin de mes → fin de mes', () => {
    expect(nextPaydayOnOrAfter('2026-07-16')).toBe('2026-07-31');
  });
  it('en el último día → ese día (inclusive)', () => {
    expect(nextPaydayOnOrAfter('2026-07-31')).toBe('2026-07-31');
  });
  it('después del fin de mes salta al 15 del siguiente', () => {
    expect(nextPaydayOnOrAfter('2026-03-01')).toBe('2026-03-15');
  });
});

describe('countPaydaysAfter (estricto: paydays con fecha > asOf y <= due)', () => {
  it('del 1 de julio al 31 de agosto hay 4 quincenas (15/7, 31/7, 15/8, 31/8)', () => {
    expect(countPaydaysAfter('2026-07-01', '2026-08-31')).toBe(4);
  });
  it('si asOf cae en una quincena, esa NO se cuenta (ya pasó ese pago)', () => {
    expect(countPaydaysAfter('2026-07-15', '2026-08-31')).toBe(3);
  });
  it('due antes de la próxima quincena → 0', () => {
    expect(countPaydaysAfter('2026-07-16', '2026-07-20')).toBe(0);
  });
  it('due exactamente en una quincena la incluye', () => {
    expect(countPaydaysAfter('2026-07-01', '2026-07-15')).toBe(1);
  });
});

describe('paydaysBetween', () => {
  it('lista las quincenas en (asOf, due]', () => {
    expect(paydaysBetween('2026-07-01', '2026-08-15')).toEqual([
      '2026-07-15',
      '2026-07-31',
      '2026-08-15',
    ]);
  });
});
