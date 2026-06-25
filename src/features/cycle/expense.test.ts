import { expenseProvision, monthlyExpenseProvision, nextMonthlyDue } from './expense';

describe('expenseProvision — amortiza un gasto entre las quincenas que faltan', () => {
  it('mismo quincena: el monto completo (span 1)', () => {
    // celular ₡20.000 vence 31-ene, desde el pago del 15-ene → 1 quincena
    const p = expenseProvision(2_000_000, new Date(2026, 0, 31), new Date(2026, 0, 15));
    expect(p.quincenasSpan).toBe(1);
    expect(p.perQuincenaCents).toBe(2_000_000);
  });

  it('reparte entre la quincena actual y la del cobro (span 2)', () => {
    // desde inicio de Q1 (1-ene) hasta un gasto que vence en Q2 (30-ene) → 2 quincenas
    const p = expenseProvision(2_000_000, new Date(2026, 0, 30), new Date(2026, 0, 1));
    expect(p.quincenasSpan).toBe(2);
    expect(p.perQuincenaCents).toBe(1_000_000);
  });

  it('reparte entre varias quincenas hasta el cobro', () => {
    // 10-ene (Q1) → 20-mar (Q2): Q1ene,Q2ene,Q1feb,Q2feb,Q1mar,Q2mar = 6
    const p = expenseProvision(6_000_000, new Date(2026, 2, 20), new Date(2026, 0, 10));
    expect(p.quincenasSpan).toBe(6);
    expect(p.perQuincenaCents).toBe(1_000_000);
  });

  it('redondea a centavos enteros', () => {
    const p = expenseProvision(1_000_000, new Date(2026, 0, 30), new Date(2026, 0, 1)); // /2
    expect(p.perQuincenaCents).toBe(500_000);
    const p2 = expenseProvision(1_000_001, new Date(2026, 0, 30), new Date(2026, 0, 1));
    expect(p2.perQuincenaCents).toBe(Math.round(1_000_001 / 2));
  });

  it('gasto vencido (due antes de from): span 1, todo de una', () => {
    const p = expenseProvision(500_000, new Date(2026, 0, 5), new Date(2026, 0, 20));
    expect(p.quincenasSpan).toBe(1);
    expect(p.perQuincenaCents).toBe(500_000);
  });
});

describe('nextMonthlyDue — próxima ocurrencia de un día del mes', () => {
  it('si el día aún no pasó este mes, es este mes', () => {
    expect(nextMonthlyDue(new Date(2026, 0, 10), 15)).toEqual(new Date(2026, 0, 15));
  });

  it('si el día ya pasó este mes, es el mes siguiente', () => {
    expect(nextMonthlyDue(new Date(2026, 0, 20), 15)).toEqual(new Date(2026, 1, 15));
  });

  it('si hoy es el día, es hoy', () => {
    expect(nextMonthlyDue(new Date(2026, 0, 15), 15)).toEqual(new Date(2026, 0, 15));
  });

  it('clampa al último día si el mes no tiene ese día (31 en febrero no bisiesto)', () => {
    expect(nextMonthlyDue(new Date(2026, 1, 1), 31)).toEqual(new Date(2026, 1, 28));
  });
});

describe('monthlyExpenseProvision — integra nextMonthlyDue + amortización', () => {
  it('celular día 31 desde el pago del 15-ene → todo en esta quincena', () => {
    const p = monthlyExpenseProvision(2_000_000, 31, new Date(2026, 0, 15));
    expect(p.due).toBe('2026-01-31');
    expect(p.quincenasSpan).toBe(1);
    expect(p.perQuincenaCents).toBe(2_000_000);
  });

  it('gasto día 30 visto desde inicio de mes → repartido en 2 quincenas', () => {
    const p = monthlyExpenseProvision(2_000_000, 30, new Date(2026, 0, 1));
    expect(p.due).toBe('2026-01-30');
    expect(p.quincenasSpan).toBe(2);
    expect(p.perQuincenaCents).toBe(1_000_000);
  });
});
