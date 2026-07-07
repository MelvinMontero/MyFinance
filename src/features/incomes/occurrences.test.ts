import { generateOccurrences, paydatesInQuincena } from './occurrences';
import type { Income } from '@/shared/db/types';

// Generador de IDs deterministas para tests
function makeIdGen(prefix = 'occ'): () => string {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

const FIXED_NOW = '2026-01-01T08:00:00.000Z';

function income(overrides: Partial<Income> = {}): Income {
  return {
    id: 'inc-1',
    amount_cents: 100_000,
    source: 'Sueldo',
    frequency: 'monthly',
    start_date: '2026-01-15',
    end_date: null,
    is_active: 1,
    note: null,
    currency: 'CRC',
    payday_1: null,
    payday_2: null,
    created_at: FIXED_NOW,
    updated_at: FIXED_NOW,
    ...overrides,
  };
}

describe('generateOccurrences — biweekly con días de pago configurados', () => {
  it('genera ocurrencias en los días elegidos (clamp al fin de mes corto)', () => {
    const result = generateOccurrences(
      income({
        frequency: 'biweekly',
        start_date: '2026-01-01',
        end_date: '2026-02-28',
        payday_1: 15,
        payday_2: 30,
      }),
      { generateId: makeIdGen(), now: FIXED_NOW },
    );
    expect(result.map((o) => o.occurred_at)).toEqual([
      '2026-01-15',
      '2026-01-30',
      '2026-02-15',
      '2026-02-28', // febrero 2026 tiene 28 días → 30 se recorta
    ]);
  });

  it('sin días configurados cae al comportamiento legacy (cada 14 días)', () => {
    const result = generateOccurrences(
      income({ frequency: 'biweekly', start_date: '2026-01-01', end_date: '2026-01-31' }),
      { generateId: makeIdGen(), now: FIXED_NOW },
    );
    expect(result.map((o) => o.occurred_at)).toEqual(['2026-01-01', '2026-01-15', '2026-01-29']);
  });

  it('NO duplica cuando dos días distintos clampan al mismo día (28 y 30 en febrero)', () => {
    const result = generateOccurrences(
      income({
        frequency: 'biweekly',
        start_date: '2026-02-01',
        end_date: '2026-03-31',
        payday_1: 28,
        payday_2: 30,
      }),
      { generateId: makeIdGen(), now: FIXED_NOW },
    );
    // Febrero 2026 (28 días): 28 y 30 colapsan al 28 → UNA sola ocurrencia.
    expect(result.map((o) => o.occurred_at)).toEqual(['2026-02-28', '2026-03-28', '2026-03-30']);
  });

  it('NO duplica con 30 y 31 en meses de 30 días', () => {
    const result = generateOccurrences(
      income({
        frequency: 'biweekly',
        start_date: '2026-04-01',
        end_date: '2026-05-31',
        payday_1: 30,
        payday_2: 31,
      }),
      { generateId: makeIdGen(), now: FIXED_NOW },
    );
    // Abril (30 días): 30 y 31 colapsan al 30 → una sola. Mayo (31): las dos.
    expect(result.map((o) => o.occurred_at)).toEqual(['2026-04-30', '2026-05-30', '2026-05-31']);
  });

  it('incluye el pago de la QUINCENA de start_date aunque ya haya pasado (bug balance en 0)', () => {
    // Usuario registra su salario el 7 de julio (Q1 = 1–14) con pagos 1 y 15:
    // la ocurrencia del 1 de julio es de SU quincena en curso y debe generarse
    // para poder confirmarla — antes la primera era la del 15 y Q1 quedaba vacía.
    const result = generateOccurrences(
      income({
        frequency: 'biweekly',
        start_date: '2026-07-07',
        end_date: '2026-08-31',
        payday_1: 1,
        payday_2: 15,
      }),
      { generateId: makeIdGen(), now: FIXED_NOW },
    );
    expect(result.map((o) => o.occurred_at)).toEqual([
      '2026-07-01', // ← el pago de la quincena en curso, aunque start_date sea el 7
      '2026-07-15',
      '2026-08-01',
      '2026-08-15',
    ]);
  });

  it('start_date en Q2 (día 20) incluye el pago del 15 de esa quincena', () => {
    const result = generateOccurrences(
      income({
        frequency: 'biweekly',
        start_date: '2026-07-20',
        end_date: '2026-07-31',
        payday_1: 1,
        payday_2: 15,
      }),
      { generateId: makeIdGen(), now: FIXED_NOW },
    );
    // NO incluye el 1 de julio (quincena anterior); SÍ el 15 (quincena de start).
    expect(result.map((o) => o.occurred_at)).toEqual(['2026-07-15']);
  });

  it('días de pago 1 y 15 (default nuevo) generan una ocurrencia por quincena', () => {
    const result = generateOccurrences(
      income({
        frequency: 'biweekly',
        start_date: '2026-01-01',
        end_date: '2026-02-28',
        payday_1: 1,
        payday_2: 15,
      }),
      { generateId: makeIdGen(), now: FIXED_NOW },
    );
    expect(result.map((o) => o.occurred_at)).toEqual([
      '2026-01-01',
      '2026-01-15',
      '2026-02-01',
      '2026-02-15',
    ]);
  });
});

describe('generateOccurrences — frecuencia one_time', () => {
  it('genera exactamente 1 ocurrencia en start_date', () => {
    const result = generateOccurrences(
      income({ frequency: 'one_time', start_date: '2026-03-10' }),
      { generateId: makeIdGen(), now: FIXED_NOW },
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.occurred_at).toBe('2026-03-10');
  });

  it('usa el amount_cents del ingreso', () => {
    const result = generateOccurrences(
      income({ frequency: 'one_time', amount_cents: 50_000 }),
      { generateId: makeIdGen(), now: FIXED_NOW },
    );
    expect(result[0]?.amount_cents).toBe(50_000);
  });

  it('arranca con is_confirmed=0 (sin confirmar)', () => {
    const result = generateOccurrences(
      income({ frequency: 'one_time' }),
      { generateId: makeIdGen(), now: FIXED_NOW },
    );
    expect(result[0]?.is_confirmed).toBe(0);
  });

  it('asocia las ocurrencias al income_id correcto', () => {
    const result = generateOccurrences(
      income({ id: 'inc-99', frequency: 'one_time' }),
      { generateId: makeIdGen(), now: FIXED_NOW },
    );
    expect(result[0]?.income_id).toBe('inc-99');
  });

  it('respeta end_date anterior a start_date (sin ocurrencias)', () => {
    const result = generateOccurrences(
      income({ frequency: 'one_time', start_date: '2026-05-01', end_date: '2026-04-01' }),
      { generateId: makeIdGen(), now: FIXED_NOW },
    );
    expect(result).toHaveLength(0);
  });
});

describe('generateOccurrences — frecuencia monthly', () => {
  it('genera 13 ocurrencias en una ventana de 12 meses (mes 0 al 12)', () => {
    const result = generateOccurrences(
      income({ frequency: 'monthly', start_date: '2026-01-15' }),
      { generateId: makeIdGen(), now: FIXED_NOW, monthsAhead: 12 },
    );
    // Jan 15 2026, Feb 15, ..., Jan 15 2027 inclusive
    expect(result).toHaveLength(13);
    expect(result[0]?.occurred_at).toBe('2026-01-15');
    expect(result[12]?.occurred_at).toBe('2027-01-15');
  });

  it('mantiene el mismo día del mes en meses con suficientes días', () => {
    const result = generateOccurrences(
      income({ frequency: 'monthly', start_date: '2026-03-15' }),
      { generateId: makeIdGen(), now: FIXED_NOW, monthsAhead: 3 },
    );
    expect(result.map((o) => o.occurred_at)).toEqual([
      '2026-03-15',
      '2026-04-15',
      '2026-05-15',
      '2026-06-15',
    ]);
  });

  it('clamps día 31 al último día del mes en meses cortos', () => {
    const result = generateOccurrences(
      income({ frequency: 'monthly', start_date: '2026-01-31' }),
      { generateId: makeIdGen(), now: FIXED_NOW, monthsAhead: 5 },
    );
    expect(result.map((o) => o.occurred_at)).toEqual([
      '2026-01-31',
      '2026-02-28', // febrero clampea a 28 (2026 no es bisiesto)
      '2026-03-31',
      '2026-04-30', // abril tiene 30
      '2026-05-31',
      '2026-06-30',
    ]);
  });

  it('clamps día 31 a 29 en febrero de año bisiesto', () => {
    const result = generateOccurrences(
      income({ frequency: 'monthly', start_date: '2024-01-31' }),
      { generateId: makeIdGen(), now: FIXED_NOW, monthsAhead: 2 },
    );
    expect(result.map((o) => o.occurred_at)).toEqual([
      '2024-01-31',
      '2024-02-29', // bisiesto
      '2024-03-31',
    ]);
  });

  it('regresa al día original tras un clamp (no acumula drift)', () => {
    // Crítico: si en Feb clampeamos a 28, Mar debe volver a 31, no quedarse en 28.
    const result = generateOccurrences(
      income({ frequency: 'monthly', start_date: '2026-01-31' }),
      { generateId: makeIdGen(), now: FIXED_NOW, monthsAhead: 12 },
    );
    expect(result.find((o) => o.occurred_at.startsWith('2026-03'))?.occurred_at).toBe('2026-03-31');
    expect(result.find((o) => o.occurred_at.startsWith('2026-05'))?.occurred_at).toBe('2026-05-31');
    expect(result.find((o) => o.occurred_at.startsWith('2026-07'))?.occurred_at).toBe('2026-07-31');
  });

  it('respeta end_date truncando ocurrencias futuras', () => {
    const result = generateOccurrences(
      income({
        frequency: 'monthly',
        start_date: '2026-01-15',
        end_date: '2026-04-10', // antes del Apr 15 → solo Jan/Feb/Mar
      }),
      { generateId: makeIdGen(), now: FIXED_NOW, monthsAhead: 12 },
    );
    expect(result.map((o) => o.occurred_at)).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
    ]);
  });

  it('incluye la ocurrencia que cae exactamente en end_date', () => {
    const result = generateOccurrences(
      income({
        frequency: 'monthly',
        start_date: '2026-01-15',
        end_date: '2026-03-15', // exacto: debe incluir Mar 15
      }),
      { generateId: makeIdGen(), now: FIXED_NOW, monthsAhead: 12 },
    );
    expect(result.map((o) => o.occurred_at)).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
    ]);
  });

  it('regresa array vacío si end_date < start_date', () => {
    const result = generateOccurrences(
      income({
        frequency: 'monthly',
        start_date: '2026-05-01',
        end_date: '2026-04-01',
      }),
      { generateId: makeIdGen(), now: FIXED_NOW },
    );
    expect(result).toHaveLength(0);
  });
});

describe('generateOccurrences — frecuencia biweekly', () => {
  it('genera ocurrencias cada 14 días', () => {
    const result = generateOccurrences(
      income({ frequency: 'biweekly', start_date: '2026-01-01' }),
      { generateId: makeIdGen(), now: FIXED_NOW, monthsAhead: 2 },
    );
    expect(result.map((o) => o.occurred_at)).toEqual([
      '2026-01-01',
      '2026-01-15',
      '2026-01-29',
      '2026-02-12',
      '2026-02-26',
    ]);
  });

  it('genera ~26 ocurrencias en una ventana de 12 meses', () => {
    const result = generateOccurrences(
      income({ frequency: 'biweekly', start_date: '2026-01-01' }),
      { generateId: makeIdGen(), now: FIXED_NOW, monthsAhead: 12 },
    );
    // 365 días / 14 ≈ 26.07, contando la inicial → 27 ocurrencias
    expect(result.length).toBeGreaterThanOrEqual(26);
    expect(result.length).toBeLessThanOrEqual(28);
  });

  it('respeta end_date truncando', () => {
    const result = generateOccurrences(
      income({
        frequency: 'biweekly',
        start_date: '2026-01-01',
        end_date: '2026-01-20',
      }),
      { generateId: makeIdGen(), now: FIXED_NOW },
    );
    expect(result.map((o) => o.occurred_at)).toEqual(['2026-01-01', '2026-01-15']);
  });
});

describe('generateOccurrences — metadata', () => {
  it('genera IDs únicos usando el generador inyectado', () => {
    const result = generateOccurrences(
      income({ frequency: 'monthly' }),
      { generateId: makeIdGen('test'), now: FIXED_NOW, monthsAhead: 3 },
    );
    expect(result.map((o) => o.id)).toEqual([
      'test-1',
      'test-2',
      'test-3',
      'test-4',
    ]);
  });

  it('usa el "now" provisto para created_at en todas las ocurrencias', () => {
    const fixedNow = '2026-02-14T12:00:00.000Z';
    const result = generateOccurrences(
      income({ frequency: 'monthly' }),
      { generateId: makeIdGen(), now: fixedNow, monthsAhead: 2 },
    );
    for (const occ of result) {
      expect(occ.created_at).toBe(fixedNow);
    }
  });

  it('propaga amount_cents a todas las ocurrencias', () => {
    const result = generateOccurrences(
      income({ frequency: 'monthly', amount_cents: 250_000 }),
      { generateId: makeIdGen(), now: FIXED_NOW, monthsAhead: 3 },
    );
    for (const occ of result) {
      expect(occ.amount_cents).toBe(250_000);
    }
  });
});

describe('paydatesInQuincena — backfill de la quincena en curso', () => {
  const biweekly = (over: Partial<Income> = {}) =>
    income({ frequency: 'biweekly', start_date: '2026-06-23', payday_1: 1, payday_2: 15, ...over });

  it('caso real del bug: serie editada sin la ocurrencia del 1 de julio', () => {
    // Salario creado el 23-jun con paydays viejos, editado a 1/15. Hoy 7-jul
    // (Q1): la fecha que DEBE existir en esta quincena es el 1 de julio.
    expect(paydatesInQuincena(biweekly(), '2026-07-07')).toEqual(['2026-07-01']);
  });

  it('en Q2 devuelve el pago del 15', () => {
    expect(paydatesInQuincena(biweekly(), '2026-07-20')).toEqual(['2026-07-15']);
  });

  it('clampa y deduplica en meses cortos (30 y 31 en febrero → un solo 28)', () => {
    expect(
      paydatesInQuincena(
        biweekly({ start_date: '2026-01-01', payday_1: 30, payday_2: 31 }),
        '2026-02-20',
      ),
    ).toEqual(['2026-02-28']);
  });

  it('no crea pagos anteriores a la quincena de start_date', () => {
    // Ingreso arranca el 20-jul (Q2): visto desde el 7-jul (Q1) no hay nada.
    expect(paydatesInQuincena(biweekly({ start_date: '2026-07-20' }), '2026-07-07')).toEqual([]);
  });

  it('respeta end_date', () => {
    expect(
      paydatesInQuincena(biweekly({ end_date: '2026-07-10' }), '2026-07-20'),
    ).toEqual([]);
  });

  it('monthly usa el día del mes de start_date', () => {
    const m = income({ frequency: 'monthly', start_date: '2026-01-05' });
    expect(paydatesInQuincena(m, '2026-07-07')).toEqual(['2026-07-05']);
    expect(paydatesInQuincena(m, '2026-07-20')).toEqual([]); // día 5 no cae en Q2
  });

  it('one_time y biweekly legacy (sin paydays) devuelven []', () => {
    expect(paydatesInQuincena(income({ frequency: 'one_time' }), '2026-07-07')).toEqual([]);
    expect(
      paydatesInQuincena(
        income({ frequency: 'biweekly', payday_1: null, payday_2: null }),
        '2026-07-07',
      ),
    ).toEqual([]);
  });
});
