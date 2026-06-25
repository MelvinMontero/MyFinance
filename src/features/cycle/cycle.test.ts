import {
  countRemainingQuincenas,
  getQuincena,
  quincenaBounds,
  quincenaIndex,
  quincenaKey,
} from './cycle';

describe('getQuincena — clasifica una fecha', () => {
  it('día 1–14 es la primera quincena (half=1)', () => {
    const q = getQuincena('2026-06-10');
    expect(q.half).toBe(1);
    expect(q.period).toBe('2026-06');
    expect(q.startDate).toBe('2026-06-01');
    expect(q.endDate).toBe('2026-06-14');
  });

  it('día 14 sigue siendo la primera quincena', () => {
    expect(getQuincena('2026-06-14').half).toBe(1);
  });

  it('día 15 en adelante es la segunda quincena (half=2)', () => {
    const q = getQuincena('2026-06-15');
    expect(q.half).toBe(2);
    expect(q.startDate).toBe('2026-06-15');
    expect(q.endDate).toBe('2026-06-30'); // junio tiene 30 días
  });

  it('Q2 de febrero termina el 28 en año no bisiesto', () => {
    expect(getQuincena('2026-02-20').endDate).toBe('2026-02-28');
  });

  it('Q2 de febrero termina el 29 en año bisiesto', () => {
    expect(getQuincena('2024-02-20').endDate).toBe('2024-02-29');
  });
});

describe('quincenaKey', () => {
  it('arma yyyy-MM-H', () => {
    expect(quincenaKey(getQuincena('2026-06-10'))).toBe('2026-06-1');
    expect(quincenaKey(getQuincena('2026-06-20'))).toBe('2026-06-2');
  });
});

describe('quincenaBounds — desde period + half', () => {
  it('Q1 de un mes de 31 días', () => {
    expect(quincenaBounds('2026-01', 1)).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-01-14',
    });
  });
  it('Q2 de un mes de 31 días', () => {
    expect(quincenaBounds('2026-01', 2)).toEqual({
      startDate: '2026-01-15',
      endDate: '2026-01-31',
    });
  });
});

describe('quincenaIndex — ordinal monótono de quincena', () => {
  it('Q2 es exactamente 1 más que Q1 del mismo mes', () => {
    expect(quincenaIndex(getQuincena('2026-06-20')) - quincenaIndex(getQuincena('2026-06-05'))).toBe(
      1,
    );
  });
  it('Q1 del mes siguiente es 1 más que Q2 del mes actual', () => {
    expect(quincenaIndex(getQuincena('2026-07-03')) - quincenaIndex(getQuincena('2026-06-20'))).toBe(
      1,
    );
  });
  it('cruza el cambio de año correctamente', () => {
    // dic Q2 -> ene Q1 = +1
    expect(quincenaIndex(getQuincena('2027-01-05')) - quincenaIndex(getQuincena('2026-12-20'))).toBe(
      1,
    );
  });
});

describe('countRemainingQuincenas — pagos futuros entre dos fechas', () => {
  it('cuenta los anclajes (día 1 y 15) estrictamente después de `from` y hasta `deadline`', () => {
    // Desde 2026-06-10 hasta 2026-08-31:
    // anclajes futuros: 06-15, 07-01, 07-15, 08-01, 08-15 = 5
    expect(countRemainingQuincenas(new Date(2026, 5, 10), new Date(2026, 7, 31))).toBe(5);
  });

  it('incluye un anclaje que cae justo en la deadline', () => {
    // 2026-06-10 → 2026-07-15 : 06-15, 07-01, 07-15 = 3
    expect(countRemainingQuincenas(new Date(2026, 5, 10), new Date(2026, 6, 15))).toBe(3);
  });

  it('devuelve 0 si la deadline es anterior a from', () => {
    expect(countRemainingQuincenas(new Date(2026, 5, 20), new Date(2026, 5, 10))).toBe(0);
  });

  it('no cuenta un anclaje igual a `from` (ya recibido)', () => {
    // from = 2026-06-15 (ya recibiste ese pago) → próximo es 07-01
    // hasta 2026-07-15: 07-01, 07-15 = 2
    expect(countRemainingQuincenas(new Date(2026, 5, 15), new Date(2026, 6, 15))).toBe(2);
  });
});
