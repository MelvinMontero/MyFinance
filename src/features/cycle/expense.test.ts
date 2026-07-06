import { nextMonthlyDue } from './expense';

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
