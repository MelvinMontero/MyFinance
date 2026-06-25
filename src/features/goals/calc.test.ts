import { calculateGoalPlan, rankGoalsByCutPriority } from './calc';

describe('calculateGoalPlan — cuota quincenal', () => {
  it('divide lo restante entre las quincenas disponibles (redondeo hacia arriba)', () => {
    // target 100000, ahorrado 0, 5 quincenas → 20000 c/u
    const p = calculateGoalPlan({
      targetCents: 100_000,
      savedCents: 0,
      from: new Date(2026, 5, 10),
      deadline: new Date(2026, 7, 31), // 5 quincenas
    });
    expect(p.remainingCents).toBe(100_000);
    expect(p.remainingQuincenas).toBe(5);
    expect(p.perQuincenaCents).toBe(20_000);
    expect(p.isComplete).toBe(false);
    expect(p.isOverdue).toBe(false);
  });

  it('redondea la cuota hacia arriba para no quedar corto', () => {
    // 100001 / 5 = 20000.2 → 20001
    const p = calculateGoalPlan({
      targetCents: 100_001,
      savedCents: 0,
      from: new Date(2026, 5, 10),
      deadline: new Date(2026, 7, 31),
    });
    expect(p.perQuincenaCents).toBe(20_001);
  });

  it('descuenta lo ya ahorrado', () => {
    const p = calculateGoalPlan({
      targetCents: 100_000,
      savedCents: 40_000,
      from: new Date(2026, 5, 10),
      deadline: new Date(2026, 7, 31),
    });
    expect(p.remainingCents).toBe(60_000);
    expect(p.perQuincenaCents).toBe(12_000); // 60000 / 5
  });

  it('meta cumplida: cuota 0, isComplete true', () => {
    const p = calculateGoalPlan({
      targetCents: 100_000,
      savedCents: 100_000,
      from: new Date(2026, 5, 10),
      deadline: new Date(2026, 7, 31),
    });
    expect(p.remainingCents).toBe(0);
    expect(p.perQuincenaCents).toBe(0);
    expect(p.isComplete).toBe(true);
  });

  it('sin quincenas restantes pero con deadline futura: pide todo en una cuota', () => {
    const p = calculateGoalPlan({
      targetCents: 50_000,
      savedCents: 0,
      from: new Date(2026, 5, 20),
      deadline: new Date(2026, 5, 25),
    });
    expect(p.remainingQuincenas).toBe(0);
    expect(p.perQuincenaCents).toBe(50_000); // fallback: todo de una
    expect(p.isOverdue).toBe(false);
  });

  it('deadline pasada y meta incompleta: isOverdue true, cuota = restante', () => {
    const p = calculateGoalPlan({
      targetCents: 50_000,
      savedCents: 10_000,
      from: new Date(2026, 5, 20),
      deadline: new Date(2026, 4, 1), // mayo, ya pasó
    });
    expect(p.isOverdue).toBe(true);
    expect(p.remainingCents).toBe(40_000);
    expect(p.perQuincenaCents).toBe(40_000);
  });

  it('progreso = ahorrado / target en [0,1]', () => {
    const p = calculateGoalPlan({
      targetCents: 100_000,
      savedCents: 25_000,
      from: new Date(2026, 5, 10),
      deadline: new Date(2026, 7, 31),
    });
    expect(p.progress).toBeCloseTo(0.25, 5);
  });
});

describe('rankGoalsByCutPriority — qué recortar primero ante déficit', () => {
  it('ordena prioridad baja primero, alta al final', () => {
    const ids = rankGoalsByCutPriority([
      { id: 'a', priority: 'high' },
      { id: 'b', priority: 'low' },
      { id: 'c', priority: 'medium' },
    ]);
    expect(ids).toEqual(['b', 'c', 'a']);
  });

  it('es estable dentro de la misma prioridad (respeta el orden de entrada)', () => {
    const ids = rankGoalsByCutPriority([
      { id: 'x', priority: 'low' },
      { id: 'y', priority: 'low' },
    ]);
    expect(ids).toEqual(['x', 'y']);
  });
});
