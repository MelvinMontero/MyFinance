import { buildExpenseReminders, buildGoalCountdown, buildPaydayReminders } from './plan';

describe('buildPaydayReminders — días de pago (15 y fin de mes) a las 9am', () => {
  it('devuelve los próximos N días de pago desde una fecha', () => {
    const r = buildPaydayReminders(new Date(2026, 0, 5), 3);
    expect(r.map((n) => fmt(n.date))).toEqual(['2026-01-15', '2026-01-31', '2026-02-15']);
    r.forEach((n) => expect(n.date.getHours()).toBe(9));
    expect(r[0]!.title).toMatch(/pago/i);
  });

  it('si hoy es día 15, ese mismo pago cuenta (la alerta es a las 9am)', () => {
    const r = buildPaydayReminders(new Date(2026, 0, 15), 1);
    expect(fmt(r[0]!.date)).toBe('2026-01-15');
  });
});

describe('buildGoalCountdown — hitos antes de la deadline', () => {
  it('solo incluye hitos futuros y a las 9am', () => {
    const from = new Date(2026, 0, 1);
    const deadline = new Date(2026, 1, 10); // +40 días aprox
    const r = buildGoalCountdown([{ id: 'g1', name: 'Viaje', deadline }], from, [30, 15, 7, 1]);
    expect(r.length).toBeGreaterThan(0);
    r.forEach((n) => {
      expect(n.date.getTime()).toBeGreaterThan(from.getTime());
      expect(n.date.getHours()).toBe(9);
      expect(n.title).toContain('Viaje');
    });
  });

  it('no genera nada si todos los hitos ya pasaron', () => {
    const from = new Date(2026, 0, 11); // posterior a la deadline → todos los hitos quedaron atrás
    const deadline = new Date(2026, 0, 10);
    const r = buildGoalCountdown([{ id: 'g1', name: 'X', deadline }], from, [30, 15, 7, 1]);
    expect(r).toEqual([]);
  });
});

describe('buildExpenseReminders — N días antes y el día del cobro', () => {
  it('programa daysBefore y el día mismo, ambos futuros, a las 9am', () => {
    const from = new Date(2026, 0, 1);
    const r = buildExpenseReminders(
      [{ id: 'e1', name: 'Internet', amount_cents: 2_000_000, currency: 'CRC', due_day: 20 }],
      from,
      2,
    );
    // due = 20-ene → avisos el 18-ene y el 20-ene
    expect(r.map((n) => fmt(n.date))).toEqual(['2026-01-18', '2026-01-20']);
    r.forEach((n) => expect(n.date.getHours()).toBe(9));
  });

  it('omite avisos que ya pasaron', () => {
    const from = new Date(2026, 0, 19); // el aviso de 2 días antes (17-ene) ya pasó
    const r = buildExpenseReminders(
      [{ id: 'e1', name: 'Internet', amount_cents: 2_000_000, currency: 'CRC', due_day: 20 }],
      from,
      2,
    );
    expect(r.map((n) => fmt(n.date))).toEqual(['2026-01-20']);
  });
});

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
