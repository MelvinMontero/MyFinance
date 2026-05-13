import { generateOccurrences } from './occurrences';
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
    created_at: FIXED_NOW,
    updated_at: FIXED_NOW,
    ...overrides,
  };
}

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
