# Ciclo Quincenal Real + Metas de Ahorro — Plan de Implementación

> **Para trabajadores agénticos:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan sintaxis de checkbox (`- [ ]`) para tracking.

**Goal:** Convertir el toggle "Quincenal" cosmético en un ciclo quincenal real (qué gastos vencen en cada quincena y cuánto reservar del ingreso de ese pago) y agregar un módulo completo de Metas de ahorro con cálculo de cuota quincenal.

**Architecture:** App Expo/React Native local-first con SQLite versionado. Se agregan 2 migraciones (v4 metas, v5 colchón + notificaciones), un módulo puro `cycle/` (lógica de quincenas, TDD), un módulo `goals/` (calc + repository + UI), y se extiende el cálculo de sobres existente con un sobre "Metas" sin romper sus 19 tests. La UI suma una pestaña "Metas" y un Dashboard quincenal con cálculo real.

**Tech Stack:** Expo SDK 54, React Native 0.81, TypeScript strict (`noUncheckedIndexedAccess`), Expo Router 6, NativeWind 4, Zustand 5, expo-sqlite (async), react-hook-form + zod 4, date-fns 4, lucide-react-native, Jest 29 + jest-expo.

---

## Análisis de la base de código actual

El `CLAUDE.md` está **desactualizado** (dice "Fase 1"); el código real está en **v0.8.1 / Fase 7**. Estado verificado leyendo el árbol `src/`:

| Capa | Archivo clave | Estado |
|------|---------------|--------|
| Migrador DB | `src/shared/db/migrator.ts` | `PRAGMA user_version`, transaccional. **v3 aplicada.** |
| Schema | `src/shared/db/migrations.ts` | 8 tablas. Centavos `INTEGER`, fechas ISO `TEXT`, `currency` por fila. |
| Tipos | `src/shared/db/types.ts` | Refleja schema. `SqliteBoolean = 0 \| 1`. |
| Ingresos | `src/features/incomes/{repository,occurrences,schemas}.ts` | CRUD + `generateOccurrences()` (one_time/biweekly/monthly, clamp fin de mes) + override puntual + confirmar. |
| Gastos fijos | `src/features/fixed-expenses/repository.ts` | CRUD con `due_day` (1–31) + `fixed_expense_payments` por período `YYYY-MM`. |
| Sobres | `src/features/budgets/calculate.ts` | `calculateBuckets()` **PURO**, 19 tests. **Mensual.** |
| Presupuesto | `src/features/budgets/repository.ts` | `getBudgetForPeriod(period, currency, savingsPercent)` agrega totales del mes. |
| Variables | `src/features/variable-expenses/repository.ts` | CRUD (pantalla "Extras"). |
| Notificaciones | `src/features/notifications/scheduler.ts` | Avisa **3 días antes** + el día (9am) por `due_day`. |
| Backup | `src/features/backup/repository.ts` | Export/Import JSON manual (sin cifrar). |
| Settings store | `src/features/settings/store.ts` | Zustand, espejo de la tabla `settings`. |
| Navegación | `src/app/(tabs)/_layout.tsx` | 6 tabs: Inicio, Ingresos, Fijos, Extras, Reportes, Ajustes. |

**Hallazgo central:** el toggle "Mensual / Quincenal" del Dashboard ([`src/app/(tabs)/index.tsx`](src/app/(tabs)/index.tsx), función `BucketsBlock`, `halve = Math.round(cents/2)`) es **cosmético**: divide los montos mensuales entre 2. **No** identifica qué gastos vencen en la quincena en curso ni reserva el ingreso de ese pago contra esos gastos. Eso es el requerimiento 1. El módulo de **Metas** (req 2) **no existe**.

**Decisiones de alcance (confirmadas con el cliente):**
1. **Quincena = período real.** Q1 = días 1–14, Q2 = días 15–fin de mes (según el ejemplo del spec: pago del 15 cubre del 15 al 29). El mensual queda como vista resumen.
2. **Sin sincronización en la nube.** Se mantiene el backup/restore JSON manual existente (coherente con local-first sin login). No se agregan tareas de sync.
3. **Metas = nueva pestaña** (7ª, icono `Target`).

**Principio de no-regresión:** `calculateBuckets` se EXTIENDE con un parámetro opcional `goalsReserveAmount` (default 0). Con default 0 los 19 tests existentes pasan sin cambios. Las migraciones existentes (v1–v3) son **inmutables**: solo se suma v4 y v5.

---

## Propuesta de base de datos

Dos migraciones nuevas. **Nunca** modificar v1–v3.

### Migración v4 — Metas de ahorro

```sql
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CRC',
  start_date TEXT NOT NULL,          -- 'yyyy-MM-dd' inicio del ahorro
  deadline TEXT NOT NULL,            -- 'yyyy-MM-dd' fecha límite
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goal_contributions (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  contributed_at TEXT NOT NULL,      -- 'yyyy-MM-dd'
  quincena_key TEXT NOT NULL,        -- 'yyyy-MM-H' (H = 1 | 2)
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal ON goal_contributions(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_quincena ON goal_contributions(quincena_key);
```

### Migración v5 — Colchón financiero + notificaciones configurables

```sql
ALTER TABLE settings ADD COLUMN payday_offset_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE settings ADD COLUMN notify_days_before INTEGER NOT NULL DEFAULT 2;
```

- `payday_offset_days` (colchón, req 3.1): margen en días para que un gasto fijo no se marque "urgente"/no dispare alerta antes de recibir el ingreso.
- `notify_days_before` (req 3.4): días de anticipación de la alerta. Default **2** (el spec pide 2 días; hoy está hardcodeado en 3).

**Backup:** `EXPORT_TABLES` en `src/features/backup/repository.ts` debe incluir las 2 tablas nuevas para que el respaldo siga siendo completo (Tarea 12).

### Relación con tablas existentes

- **Income → quincena:** una ocurrencia (`income_occurrences.occurred_at`) cae en la quincena de su fecha. No requiere columna nueva.
- **Fixed expense → quincena:** `fixed_expenses.due_day` (1–31) determina la quincena: `due_day <= 14` → Q1, `due_day >= 15` → Q2. No requiere columna nueva.
- **Goal → reserva quincenal:** se **calcula** (no se persiste el monto sugerido); solo se persisten las contribuciones reales en `goal_contributions`.

---

## Estructura de archivos

**Crear:**
- `src/features/cycle/cycle.ts` — lógica pura de quincenas (tipos, bounds, conteo).
- `src/features/cycle/cycle.test.ts` — tests de la lógica de quincenas.
- `src/features/goals/calc.ts` — cálculo puro de cuota quincenal y progreso.
- `src/features/goals/calc.test.ts` — tests del cálculo de metas.
- `src/features/goals/repository.ts` — CRUD de metas + contribuciones + reserva agregada.
- `src/features/goals/schemas.ts` — zod del formulario de meta.
- `src/features/goals/GoalCard.tsx` — card de meta con barra de progreso.
- `src/features/budgets/quincena.ts` — repository del presupuesto quincenal real.
- `src/app/(tabs)/goals.tsx` — pestaña Metas (lista).
- `src/app/goal/new.tsx` — alta de meta.
- `src/app/goal/[id].tsx` — detalle/edición de meta + contribuir.

**Modificar:**
- `src/shared/db/migrations.ts` — push v4 y v5.
- `src/shared/db/types.ts` — tipos `Goal`, `GoalContribution`; campos nuevos en `Settings`.
- `src/shared/db/index.ts` — `UpdateSettingsInput` con campos nuevos.
- `src/features/settings/store.ts` — slices `payday_offset_days`, `notify_days_before`.
- `src/features/budgets/calculate.ts` — parámetro opcional `goalsReserveAmount` + campo `goalsReserve`.
- `src/features/notifications/scheduler.ts` — usar `notify_days_before`, colchón, recordatorio día de pago.
- `src/features/backup/repository.ts` — sumar `goals` y `goal_contributions` a `EXPORT_TABLES`.
- `src/app/(tabs)/_layout.tsx` — 7ª pestaña "Metas".
- `src/app/(tabs)/index.tsx` — Dashboard con cálculo quincenal real + sobre Metas.
- `CHANGELOG.md` — entrada v0.9.0.

---

## Convenciones del proyecto (leer antes de codear)

- **Centavos `INTEGER`** siempre. Usar `toCents`/`fromCents`/`formatCents` de `src/shared/utils/money.ts`. Nunca floats para montos.
- **Fechas ISO `TEXT`** (`yyyy-MM-dd`). Manipular con `date-fns` v4.
- **IDs:** `randomUUID()` de `expo-crypto` para registros del usuario.
- **Path alias `@/*` → `src/*`.** Importar `@/features/...`, no rutas relativas largas.
- **TS strict + `noUncheckedIndexedAccess`:** `arr[0]` es `T | undefined`. Cero `any`.
- **Funciones puras testables sin DB:** la lógica va en `calc.ts`/`cycle.ts`; el `repository.ts` agrega totales SQLite y delega.
- **Conventional Commits:** `feat:`, `fix:`, `test:`, `chore:`, `docs:`.
- **UI en español con tildes.** Identificadores en inglés.
- **Verificación por fase:** `npm run typecheck`, `npm test`, `npm run lint` deben pasar.

---

## FASE A — Base de datos y tipos

### Task 1: Migración v4 (metas)

**Files:**
- Modify: `src/shared/db/migrations.ts` (final del array `migrations`)
- Modify: `src/shared/db/types.ts`

- [ ] **Step 1: Agregar la migración v4 al array**

En `src/shared/db/migrations.ts`, después del objeto `version: 3` (antes del `];` que cierra el array), agregar:

```ts
  {
    version: 4,
    description: 'metas de ahorro (goals + goal_contributions)',
    sql: `
      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        target_cents INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'CRC',
        start_date TEXT NOT NULL,
        deadline TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS goal_contributions (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        amount_cents INTEGER NOT NULL,
        contributed_at TEXT NOT NULL,
        quincena_key TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal ON goal_contributions(goal_id);
      CREATE INDEX IF NOT EXISTS idx_goal_contributions_quincena ON goal_contributions(quincena_key);
    `,
  },
```

- [ ] **Step 2: Agregar tipos TS**

En `src/shared/db/types.ts`, al final del archivo:

```ts
export interface Goal {
  id: string;
  name: string;
  target_cents: number;
  currency: string;
  start_date: string; // 'yyyy-MM-dd'
  deadline: string; // 'yyyy-MM-dd'
  is_active: SqliteBoolean;
  created_at: string;
  updated_at: string;
}

export interface GoalContribution {
  id: string;
  goal_id: string;
  amount_cents: number;
  contributed_at: string; // 'yyyy-MM-dd'
  quincena_key: string; // 'yyyy-MM-H'
  created_at: string;
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `npm run typecheck`
Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add src/shared/db/migrations.ts src/shared/db/types.ts
git commit -m "feat(db): migración v4 — tablas goals y goal_contributions"
```

---

### Task 2: Migración v5 (colchón + notificaciones) y settings

**Files:**
- Modify: `src/shared/db/migrations.ts`
- Modify: `src/shared/db/types.ts:9-19` (interface `Settings`)
- Modify: `src/shared/db/index.ts:46-53` (`UpdateSettingsInput`) y la función `updateSettings`
- Modify: `src/features/settings/store.ts`

- [ ] **Step 1: Agregar la migración v5**

En `src/shared/db/migrations.ts`, después del objeto `version: 4`:

```ts
  {
    version: 5,
    description: 'colchón financiero (payday_offset_days) y notificaciones configurables',
    sql: `
      ALTER TABLE settings ADD COLUMN payday_offset_days INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE settings ADD COLUMN notify_days_before INTEGER NOT NULL DEFAULT 2;
    `,
  },
```

- [ ] **Step 2: Extender el tipo `Settings`**

En `src/shared/db/types.ts`, dentro de `interface Settings`, agregar antes de `created_at`:

```ts
  payday_offset_days: number;
  notify_days_before: number;
```

- [ ] **Step 3: Extender `UpdateSettingsInput` y `updateSettings`**

En `src/shared/db/index.ts`, en `interface UpdateSettingsInput` agregar:

```ts
  payday_offset_days?: number;
  notify_days_before?: number;
```

Y dentro de `updateSettings`, después del bloque `onboarding_completed`:

```ts
  if (patch.payday_offset_days !== undefined) {
    sets.push('payday_offset_days = ?');
    args.push(patch.payday_offset_days);
  }
  if (patch.notify_days_before !== undefined) {
    sets.push('notify_days_before = ?');
    args.push(patch.notify_days_before);
  }
```

- [ ] **Step 4: Extender el store de settings**

En `src/features/settings/store.ts`, agregar a `interface SettingsState` (después de `onboarding_completed: boolean;`):

```ts
  payday_offset_days: number;
  notify_days_before: number;
```

y a la lista de métodos:

```ts
  setPaydayOffsetDays: (days: number) => Promise<void>;
  setNotifyDaysBefore: (days: number) => Promise<void>;
```

En el `create<SettingsState>`, agregar a los valores default (después de `onboarding_completed: false,`):

```ts
  payday_offset_days: 0,
  notify_days_before: 2,
```

Dentro de `load`, en el `set({ ... })` cuando `row` existe, agregar:

```ts
        payday_offset_days: row.payday_offset_days,
        notify_days_before: row.notify_days_before,
```

Y agregar los dos setters (después de `setOnboardingCompleted`):

```ts
  setPaydayOffsetDays: async (days) => {
    const clamped = Math.max(0, Math.min(15, Math.round(days)));
    await updateSettings({ payday_offset_days: clamped });
    set({ payday_offset_days: clamped });
  },

  setNotifyDaysBefore: async (days) => {
    const clamped = Math.max(0, Math.min(14, Math.round(days)));
    await updateSettings({ notify_days_before: clamped });
    set({ notify_days_before: clamped });
  },
```

- [ ] **Step 5: Verificar typecheck**

Run: `npm run typecheck`
Expected: 0 errores.

- [ ] **Step 6: Commit**

```bash
git add src/shared/db/migrations.ts src/shared/db/types.ts src/shared/db/index.ts src/features/settings/store.ts
git commit -m "feat(db): migración v5 — colchón financiero y notificaciones configurables"
```

---

## FASE B — Lógica de quincenas (pura, TDD)

### Task 3: Módulo `cycle.ts` — bounds y key de quincena

**Files:**
- Create: `src/features/cycle/cycle.ts`
- Test: `src/features/cycle/cycle.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/features/cycle/cycle.test.ts`:

```ts
import { getQuincena, quincenaBounds, quincenaKey } from './cycle';

describe('getQuincena — clasifica una fecha', () => {
  it('día 1–14 es la primera quincena (half=1)', () => {
    const q = getQuincena('2026-06-10');
    expect(q.half).toBe(1);
    expect(q.period).toBe('2026-06');
    expect(q.startDate).toBe('2026-06-01');
    expect(q.endDate).toBe('2026-06-14');
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
```

- [ ] **Step 2: Correr el test para verque falla**

Run: `npm test -- cycle`
Expected: FAIL — "Cannot find module './cycle'".

- [ ] **Step 3: Implementar `cycle.ts`**

Crear `src/features/cycle/cycle.ts`:

```ts
import { format, getDaysInMonth, parseISO } from 'date-fns';

export type QuincenaHalf = 1 | 2;

export interface Quincena {
  /** 'yyyy-MM' del mes calendario. */
  period: string;
  /** 1 = días 1–14, 2 = días 15–fin de mes. */
  half: QuincenaHalf;
  /** 'yyyy-MM-dd' primer día de la quincena. */
  startDate: string;
  /** 'yyyy-MM-dd' último día de la quincena. */
  endDate: string;
}

/** Último día del mes de `period` ('yyyy-MM'), como número (28..31). */
function lastDayOfMonth(period: string): number {
  return getDaysInMonth(parseISO(`${period}-01`));
}

/** Devuelve los límites de una quincena dado el mes y la mitad. */
export function quincenaBounds(
  period: string,
  half: QuincenaHalf,
): { startDate: string; endDate: string } {
  if (half === 1) {
    return { startDate: `${period}-01`, endDate: `${period}-14` };
  }
  const last = String(lastDayOfMonth(period)).padStart(2, '0');
  return { startDate: `${period}-15`, endDate: `${period}-${last}` };
}

/** Clasifica una fecha ('yyyy-MM-dd' o Date) en su quincena. */
export function getQuincena(date: string | Date): Quincena {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const period = format(d, 'yyyy-MM');
  const half: QuincenaHalf = d.getDate() < 15 ? 1 : 2;
  const bounds = quincenaBounds(period, half);
  return { period, half, ...bounds };
}

/** 'yyyy-MM-H' — clave estable de una quincena. */
export function quincenaKey(q: Quincena): string {
  return `${q.period}-${q.half}`;
}
```

- [ ] **Step 4: Correr los tests**

Run: `npm test -- cycle`
Expected: PASS (todos los casos de Task 3).

- [ ] **Step 5: Commit**

```bash
git add src/features/cycle/cycle.ts src/features/cycle/cycle.test.ts
git commit -m "feat(cycle): clasificación y límites de quincenas (TDD)"
```

---

### Task 4: `cycle.ts` — conteo de quincenas restantes (para metas)

**Files:**
- Modify: `src/features/cycle/cycle.ts`
- Modify: `src/features/cycle/cycle.test.ts`

- [ ] **Step 1: Agregar tests que fallan**

Al final de `src/features/cycle/cycle.test.ts`:

```ts
import { countRemainingQuincenas } from './cycle';

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
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npm test -- cycle`
Expected: FAIL — "countRemainingQuincenas is not a function".

- [ ] **Step 3: Implementar la función**

Agregar al final de `src/features/cycle/cycle.ts`:

```ts
import { isAfter, startOfDay } from 'date-fns';

/**
 * Cuenta cuántas quincenas (pagos) quedan disponibles entre `from` y `deadline`.
 * Un "pago" es un anclaje de quincena: día 1 o día 15. Cuenta los anclajes
 * ESTRICTAMENTE posteriores a `from` y ≤ `deadline`. Esto representa los
 * sueldos que el usuario todavía va a recibir antes de la fecha límite.
 */
export function countRemainingQuincenas(from: Date, deadline: Date): number {
  const start = startOfDay(from);
  const end = startOfDay(deadline);
  if (isAfter(start, end)) return 0;

  let count = 0;
  let year = start.getFullYear();
  let month = start.getMonth();
  const CAP = 1200; // ~50 años — backstop

  for (let i = 0; i < CAP; i++) {
    for (const anchorDay of [1, 15]) {
      const anchor = new Date(year, month, anchorDay);
      if (isAfter(anchor, start) && !isAfter(anchor, end)) {
        count++;
      }
    }
    const monthStart = new Date(year, month, 1);
    if (isAfter(monthStart, end)) break;
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return count;
}
```

> Nota: `import { isAfter, startOfDay }` se puede fusionar con el import de date-fns ya existente arriba del archivo — dejarlo en una sola línea `import { format, getDaysInMonth, isAfter, parseISO, startOfDay } from 'date-fns';`.

- [ ] **Step 4: Correr los tests**

Run: `npm test -- cycle`
Expected: PASS (Task 3 + Task 4).

- [ ] **Step 5: Commit**

```bash
git add src/features/cycle/cycle.ts src/features/cycle/cycle.test.ts
git commit -m "feat(cycle): conteo de quincenas restantes para metas (TDD)"
```

---

## FASE C — Cálculo de sobres con Metas + presupuesto quincenal

### Task 5: Extender `calculateBuckets` con sobre Metas (sin romper tests existentes)

**Files:**
- Modify: `src/features/budgets/calculate.ts`
- Modify: `src/features/budgets/calculate.test.ts` (agregar casos nuevos)

- [ ] **Step 1: Agregar tests nuevos que fallan**

Al final de `src/features/budgets/calculate.test.ts`:

```ts
describe('calculateBuckets — sobre Metas (goalsReserveAmount)', () => {
  it('resta la reserva de metas del dinero libre', () => {
    // income=500k, ahorro 20%=100k, fijos=200k, metas=50k → libre=150k
    const r = calculateBuckets(
      buildInput({
        incomeAmount: 500_000,
        savingsPercent: 20,
        fixedExpensesAmount: 200_000,
        goalsReserveAmount: 50_000,
      }),
    );
    expect(r.savings).toBe(100_000);
    expect(r.goalsReserve).toBe(50_000);
    expect(r.freeMoney).toBe(150_000); // 500k - 100k - 200k - 50k
    expect(r.isOverBudget).toBe(false);
  });

  it('goalsReserve default 0 mantiene el cálculo histórico', () => {
    const r = calculateBuckets(
      buildInput({ incomeAmount: 100_000, savingsPercent: 20, fixedExpensesAmount: 30_000 }),
    );
    expect(r.goalsReserve).toBe(0);
    expect(r.freeMoney).toBe(50_000); // 100k - 20k - 30k - 0
  });

  it('over-budget cuando ahorro + fijos + metas superan el ingreso', () => {
    const r = calculateBuckets(
      buildInput({
        incomeAmount: 100_000,
        savingsPercent: 20,
        fixedExpensesAmount: 60_000,
        goalsReserveAmount: 40_000,
      }),
    );
    expect(r.freeMoney).toBe(-20_000); // 100 - 20 - 60 - 40
    expect(r.isOverBudget).toBe(true);
  });

  it('lanza si goalsReserveAmount es negativo', () => {
    expect(() => calculateBuckets(buildInput({ goalsReserveAmount: -1 }))).toThrow();
  });
});
```

- [ ] **Step 2: Correr para ver fallar solo los nuevos**

Run: `npm test -- calculate`
Expected: los 4 casos nuevos FALLAN ("goalsReserve undefined" / no resta); los 19 viejos siguen PASANDO.

- [ ] **Step 3: Extender `calculate.ts`**

En `src/features/budgets/calculate.ts`:

En `interface CalculateBucketsInput`, agregar al final (antes del `}`):

```ts
  /** Reserva sugerida para metas de ahorro este período, centavos ≥ 0. Default 0. */
  goalsReserveAmount?: number;
```

En `interface BucketBreakdown`, después de `savings`:

```ts
  /** Reservado para metas de ahorro de largo plazo. */
  goalsReserve: number;
```

Reemplazar el cuerpo de `calculateBuckets` por:

```ts
export function calculateBuckets(input: CalculateBucketsInput): BucketBreakdown {
  const {
    incomeAmount,
    savingsPercent,
    fixedExpensesAmount,
    variableExpensesAmount,
    goalsReserveAmount = 0,
  } = input;

  assertNonNegativeFinite(incomeAmount, 'incomeAmount');
  assertNonNegativeFinite(fixedExpensesAmount, 'fixedExpensesAmount');
  assertNonNegativeFinite(variableExpensesAmount, 'variableExpensesAmount');
  assertNonNegativeFinite(goalsReserveAmount, 'goalsReserveAmount');
  assertPercentInRange(savingsPercent);

  const savings = Math.round((incomeAmount * savingsPercent) / 100);
  const freeMoney = incomeAmount - savings - fixedExpensesAmount - goalsReserveAmount;
  const freeMoneyRemaining = freeMoney - variableExpensesAmount;

  return {
    income: incomeAmount,
    savings,
    goalsReserve: goalsReserveAmount,
    fixedExpenses: fixedExpensesAmount,
    freeMoney,
    variableExpensesSpent: variableExpensesAmount,
    freeMoneyRemaining,
    isOverBudget: freeMoney < 0,
    isOverspent: freeMoneyRemaining < 0,
  };
}
```

> El docstring de cabecera del archivo menciona la identidad `income = savings + free_money + fixed_expenses`. Actualizarlo a `income = savings + goalsReserve + fixedExpenses + freeMoney`.

- [ ] **Step 4: Correr todos los tests**

Run: `npm test -- calculate`
Expected: PASS (23 casos: 19 viejos + 4 nuevos).

- [ ] **Step 5: Commit**

```bash
git add src/features/budgets/calculate.ts src/features/budgets/calculate.test.ts
git commit -m "feat(budgets): sobre Metas en calculateBuckets (goalsReserve, backward-compatible)"
```

---

### Task 6: Repository de presupuesto quincenal real

**Files:**
- Create: `src/features/budgets/quincena.ts`

> Este repository es el corazón del requerimiento 1: dado una quincena, agrega ingresos cuyas ocurrencias caen en la ventana, gastos fijos cuyo `due_day` cae en la quincena, gastos variables del rango, y recibe la reserva de metas. No requiere tests de unidad propios (depende de SQLite); su lógica pura ya está cubierta por `calculate.test.ts` y `cycle.test.ts`. Se valida manualmente en la Tarea 9.

- [ ] **Step 1: Crear `quincena.ts`**

Crear `src/features/budgets/quincena.ts`:

```ts
import { getDb } from '@/shared/db';
import type { Quincena } from '@/features/cycle/cycle';

import { calculateBuckets, type BucketBreakdown } from './calculate';

export interface QuincenaBudget extends BucketBreakdown {
  quincena: Quincena;
  /** Códigos ISO de otras monedas con registros activos (no incluidas). */
  otherCurrenciesPresent: string[];
}

/**
 * Calcula los sobres de UNA quincena real (no dividir el mes entre 2).
 * - Ingresos: ocurrencias cuyo `occurred_at` cae en [startDate, endDate].
 * - Gastos fijos: vigentes en el mes Y con `due_day` dentro de la quincena
 *   (half 1 → due_day ≤ 14, half 2 → due_day ≥ 15).
 * - Gastos variables: los del rango de fechas de la quincena.
 * - Metas: `goalsReserveAmount` lo pasa el caller (suma de cuotas sugeridas).
 *
 * `savingsPercent` aplica sobre el ingreso de ESTA quincena.
 */
export async function getQuincenaBudget(
  quincena: Quincena,
  currency: string,
  savingsPercent: number,
  goalsReserveAmount: number,
): Promise<QuincenaBudget> {
  const db = await getDb();
  const { period, half, startDate, endDate } = quincena;

  const incomeRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(io.amount_cents), 0) AS total
       FROM income_occurrences io
       JOIN incomes i ON i.id = io.income_id
      WHERE io.occurred_at >= ? AND io.occurred_at <= ?
        AND i.currency = ?
        AND i.is_active = 1`,
    startDate,
    endDate,
    currency,
  );

  const dueCond = half === 1 ? 'due_day <= 14' : 'due_day >= 15';
  const fixedRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount_cents), 0) AS total
       FROM fixed_expenses
      WHERE is_active = 1
        AND currency = ?
        AND ${dueCond}
        AND substr(start_date, 1, 7) <= ?
        AND (end_date IS NULL OR substr(end_date, 1, 7) >= ?)`,
    currency,
    period,
    period,
  );

  const variableRow = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount_cents), 0) AS total
       FROM variable_expenses
      WHERE occurred_at >= ? AND occurred_at <= ?
        AND currency = ?`,
    startDate,
    endDate,
    currency,
  );

  const otherRows = await db.getAllAsync<{ currency: string }>(
    `SELECT DISTINCT currency FROM (
        SELECT currency FROM incomes        WHERE is_active = 1 AND currency != ?
        UNION
        SELECT currency FROM fixed_expenses WHERE is_active = 1 AND currency != ?
      )
      ORDER BY currency ASC`,
    currency,
    currency,
  );

  const breakdown = calculateBuckets({
    incomeAmount: incomeRow?.total ?? 0,
    savingsPercent,
    fixedExpensesAmount: fixedRow?.total ?? 0,
    variableExpensesAmount: variableRow?.total ?? 0,
    goalsReserveAmount,
  });

  return {
    ...breakdown,
    quincena,
    otherCurrenciesPresent: otherRows.map((r) => r.currency),
  };
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npm run typecheck`
Expected: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add src/features/budgets/quincena.ts
git commit -m "feat(budgets): presupuesto quincenal real (gastos por due_day en la quincena)"
```

---

## FASE D — Módulo de Metas

### Task 7: Cálculo puro de metas (TDD)

**Files:**
- Create: `src/features/goals/calc.ts`
- Test: `src/features/goals/calc.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/features/goals/calc.test.ts`:

```ts
import { calculateGoalPlan } from './calc';

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
    // from y deadline el mismo día (sin anclajes futuros) pero falta plata
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
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npm test -- goals/calc`
Expected: FAIL — "Cannot find module './calc'".

- [ ] **Step 3: Implementar `calc.ts`**

Crear `src/features/goals/calc.ts`:

```ts
import { isAfter, startOfDay } from 'date-fns';

import { countRemainingQuincenas } from '@/features/cycle/cycle';

export interface GoalPlanInput {
  targetCents: number;
  savedCents: number;
  /** Fecha desde la que se calcula (normalmente hoy). */
  from: Date;
  deadline: Date;
}

export interface GoalPlan {
  /** target − ahorrado, nunca negativo. */
  remainingCents: number;
  /** Quincenas (pagos) disponibles entre `from` y `deadline`. */
  remainingQuincenas: number;
  /** Cuánto retener por quincena para llegar a tiempo (redondeo hacia arriba). */
  perQuincenaCents: number;
  /** ahorrado / target, en [0, 1]. */
  progress: number;
  /** true cuando ya se alcanzó el objetivo. */
  isComplete: boolean;
  /** true cuando la deadline ya pasó y la meta no se cumplió. */
  isOverdue: boolean;
}

/**
 * Calcula el plan de ahorro de una meta. FUNCIÓN PURA.
 * Regla: cuota = ceil(restante / quincenas disponibles). Si no quedan
 * quincenas futuras pero la meta sigue abierta, sugiere el restante en
 * una sola cuota (mejor pedir todo ya que diluir en cero).
 */
export function calculateGoalPlan(input: GoalPlanInput): GoalPlan {
  const { targetCents, savedCents, from, deadline } = input;

  const remainingCents = Math.max(0, targetCents - savedCents);
  const progress = targetCents > 0 ? Math.min(1, savedCents / targetCents) : 1;
  const isComplete = remainingCents === 0;
  const isOverdue = !isComplete && isAfter(startOfDay(from), startOfDay(deadline));

  const remainingQuincenas = countRemainingQuincenas(from, deadline);

  let perQuincenaCents: number;
  if (isComplete) {
    perQuincenaCents = 0;
  } else if (remainingQuincenas <= 0) {
    perQuincenaCents = remainingCents; // sin pagos futuros → todo de una
  } else {
    perQuincenaCents = Math.ceil(remainingCents / remainingQuincenas);
  }

  return {
    remainingCents,
    remainingQuincenas,
    perQuincenaCents,
    progress,
    isComplete,
    isOverdue,
  };
}
```

- [ ] **Step 4: Correr los tests**

Run: `npm test -- goals/calc`
Expected: PASS (7 casos).

- [ ] **Step 5: Commit**

```bash
git add src/features/goals/calc.ts src/features/goals/calc.test.ts
git commit -m "feat(goals): cálculo puro de cuota quincenal y progreso (TDD)"
```

---

### Task 8: Repository de metas + schema zod

**Files:**
- Create: `src/features/goals/repository.ts`
- Create: `src/features/goals/schemas.ts`

- [ ] **Step 1: Crear el schema zod**

Crear `src/features/goals/schemas.ts`:

```ts
import { z } from 'zod';

import { SUPPORTED_CURRENCIES } from '@/shared/utils/currency';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const goalFormSchema = z
  .object({
    name: z.string().trim().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres'),
    amount: z
      .number({ message: 'El monto objetivo es requerido' })
      .positive('El monto debe ser mayor que cero')
      .finite(),
    currency: z.enum(SUPPORTED_CURRENCIES, { message: 'Moneda inválida' }),
    start_date: z.string().regex(ISO_DATE, 'Fecha inválida (formato yyyy-MM-dd)'),
    deadline: z.string().regex(ISO_DATE, 'Fecha inválida (formato yyyy-MM-dd)'),
  })
  .refine((data) => data.deadline >= data.start_date, {
    message: 'La fecha límite no puede ser anterior a la fecha de inicio',
    path: ['deadline'],
  });

export type GoalFormValues = z.infer<typeof goalFormSchema>;
```

> Verificar que `SUPPORTED_CURRENCIES` se exporta desde `src/shared/utils/currency.ts` (lo usa también `fixed-expenses/schemas.ts`). Si su tipo no encaja con `z.enum`, replicar exactamente el patrón ya usado en `fixed-expenses/schemas.ts:18`.

- [ ] **Step 2: Crear el repository**

Crear `src/features/goals/repository.ts`:

```ts
import { format } from 'date-fns';
import { randomUUID } from 'expo-crypto';

import { getQuincena, quincenaKey } from '@/features/cycle/cycle';
import { getDb } from '@/shared/db';
import type { Goal, GoalContribution, SqliteBoolean } from '@/shared/db/types';

import { calculateGoalPlan, type GoalPlan } from './calc';

export interface NewGoalInput {
  name: string;
  target_cents: number;
  currency: string;
  start_date: string; // 'yyyy-MM-dd'
  deadline: string; // 'yyyy-MM-dd'
}

export interface UpdateGoalInput {
  name?: string;
  target_cents?: number;
  currency?: string;
  start_date?: string;
  deadline?: string;
  is_active?: boolean;
}

/** Meta + total ahorrado + plan calculado a `now`. */
export interface GoalWithPlan extends Goal {
  saved_cents: number;
  plan: GoalPlan;
}

export async function createGoal(input: NewGoalInput): Promise<Goal> {
  const db = await getDb();
  const now = new Date().toISOString();
  const goal: Goal = {
    id: randomUUID(),
    name: input.name,
    target_cents: input.target_cents,
    currency: input.currency,
    start_date: input.start_date,
    deadline: input.deadline,
    is_active: 1 as SqliteBoolean,
    created_at: now,
    updated_at: now,
  };
  await db.runAsync(
    `INSERT INTO goals (id, name, target_cents, currency, start_date, deadline, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    goal.id,
    goal.name,
    goal.target_cents,
    goal.currency,
    goal.start_date,
    goal.deadline,
    goal.is_active,
    goal.created_at,
    goal.updated_at,
  );
  return goal;
}

export async function getGoal(id: string): Promise<Goal | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Goal>('SELECT * FROM goals WHERE id = ?', id);
  return row ?? null;
}

export async function getSavedCents(goalId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(amount_cents), 0) AS total FROM goal_contributions WHERE goal_id = ?',
    goalId,
  );
  return row?.total ?? 0;
}

/** Lista metas (activas por defecto) con su total ahorrado y plan calculado. */
export async function listGoalsWithPlan(
  opts: { active?: boolean; now?: Date } = {},
): Promise<GoalWithPlan[]> {
  const db = await getDb();
  const now = opts.now ?? new Date();
  const active = opts.active ?? true;
  const goals = await db.getAllAsync<Goal>(
    'SELECT * FROM goals WHERE is_active = ? ORDER BY deadline ASC',
    active ? 1 : 0,
  );
  const result: GoalWithPlan[] = [];
  for (const goal of goals) {
    const saved = await getSavedCents(goal.id);
    const plan = calculateGoalPlan({
      targetCents: goal.target_cents,
      savedCents: saved,
      from: now,
      deadline: new Date(`${goal.deadline}T00:00:00`),
    });
    result.push({ ...goal, saved_cents: saved, plan });
  }
  return result;
}

export async function updateGoal(id: string, patch: UpdateGoalInput): Promise<void> {
  const db = await getDb();
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  if (patch.name !== undefined) {
    sets.push('name = ?');
    args.push(patch.name);
  }
  if (patch.target_cents !== undefined) {
    sets.push('target_cents = ?');
    args.push(patch.target_cents);
  }
  if (patch.currency !== undefined) {
    sets.push('currency = ?');
    args.push(patch.currency);
  }
  if (patch.start_date !== undefined) {
    sets.push('start_date = ?');
    args.push(patch.start_date);
  }
  if (patch.deadline !== undefined) {
    sets.push('deadline = ?');
    args.push(patch.deadline);
  }
  if (patch.is_active !== undefined) {
    sets.push('is_active = ?');
    args.push(patch.is_active ? 1 : 0);
  }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  args.push(new Date().toISOString());
  args.push(id);
  await db.runAsync(`UPDATE goals SET ${sets.join(', ')} WHERE id = ?`, ...args);
}

/** CASCADE elimina las contribuciones. */
export async function deleteGoal(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM goals WHERE id = ?', id);
}

/** Registra una contribución a una meta, etiquetada con la quincena actual. */
export async function addContribution(
  goalId: string,
  amountCents: number,
  when: Date = new Date(),
): Promise<GoalContribution> {
  const db = await getDb();
  const now = new Date().toISOString();
  const q = getQuincena(when);
  const contribution: GoalContribution = {
    id: randomUUID(),
    goal_id: goalId,
    amount_cents: amountCents,
    contributed_at: format(when, 'yyyy-MM-dd'),
    quincena_key: quincenaKey(q),
    created_at: now,
  };
  await db.runAsync(
    `INSERT INTO goal_contributions (id, goal_id, amount_cents, contributed_at, quincena_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    contribution.id,
    contribution.goal_id,
    contribution.amount_cents,
    contribution.contributed_at,
    contribution.quincena_key,
    contribution.created_at,
  );
  return contribution;
}

export async function listContributions(goalId: string): Promise<GoalContribution[]> {
  const db = await getDb();
  return db.getAllAsync<GoalContribution>(
    'SELECT * FROM goal_contributions WHERE goal_id = ? ORDER BY contributed_at DESC',
    goalId,
  );
}

/**
 * Suma de cuotas quincenales sugeridas de TODAS las metas activas en una
 * moneda. Es la "reserva de metas" que el Dashboard pasa a getQuincenaBudget.
 */
export async function getGoalsReserveForCurrency(
  currency: string,
  now: Date = new Date(),
): Promise<number> {
  const goals = await listGoalsWithPlan({ active: true, now });
  return goals
    .filter((g) => g.currency === currency && !g.plan.isComplete)
    .reduce((sum, g) => sum + g.plan.perQuincenaCents, 0);
}

export async function getGoalCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM goals WHERE is_active = 1',
  );
  return row?.count ?? 0;
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `npm run typecheck`
Expected: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add src/features/goals/repository.ts src/features/goals/schemas.ts
git commit -m "feat(goals): repository (CRUD + contribuciones + reserva agregada) y schema zod"
```

---

## FASE E — Interfaz de usuario

### Task 9: Dashboard quincenal real (reemplazar el toggle cosmético)

**Files:**
- Modify: `src/app/(tabs)/index.tsx`

> Cambio clave del req 1. Hoy `BucketsBlock` divide los montos del mes entre 2. Se reemplaza por: cuando `viewMode === 'biweekly'`, cargar `getQuincenaBudget` de la quincena actual (cálculo real) en vez de `halve(...)`. Se agrega el sobre **Metas**.

- [ ] **Step 1: Cargar quincena y reserva de metas en el efecto principal**

En `src/app/(tabs)/index.tsx`, añadir imports:

```ts
import { getQuincena } from '@/features/cycle/cycle';
import { getQuincenaBudget, type QuincenaBudget } from '@/features/budgets/quincena';
import { getGoalsReserveForCurrency } from '@/features/goals/repository';
import { PiggyBank, Target } from 'lucide-react-native'; // Target nuevo; PiggyBank ya estaba
```

Agregar estado debajo de `const [budget, setBudget] = useState<BudgetForPeriod | null>(null);`:

```ts
  const [quincenaBudget, setQuincenaBudget] = useState<QuincenaBudget | null>(null);
```

Dentro del `useFocusEffect`, después de obtener `b` y `summary`, calcular también la quincena real:

```ts
          const q = getQuincena(new Date());
          const goalsReserve = await getGoalsReserveForCurrency(liveCurrency);
          const qb = await getQuincenaBudget(q, liveCurrency, liveSavingsPercent, goalsReserve);
          if (cancelled) return;
          setQuincenaBudget(qb);
```

- [ ] **Step 2: Pasar el presupuesto quincenal a `BucketsBlock`**

Cambiar la llamada `<BucketsBlock ... />` para pasar el nuevo prop:

```tsx
          <BucketsBlock
            budget={budget}
            quincenaBudget={quincenaBudget}
            currency={liveCurrency}
            savingsPercent={liveSavingsPercent}
            paymentSummary={paymentSummary}
          />
```

- [ ] **Step 3: Reescribir `BucketsBlock` para usar datos reales por quincena**

Reemplazar la firma y el cuerpo de `BucketsBlock`. El monto mostrado ahora sale de `monthly` (prop `budget`) o de `quincena` (prop `quincenaBudget`) según `viewMode` — **sin** dividir entre 2:

```tsx
function BucketsBlock({
  budget,
  quincenaBudget,
  currency,
  savingsPercent,
  paymentSummary,
}: {
  budget: BudgetForPeriod;
  quincenaBudget: QuincenaBudget | null;
  currency: string;
  savingsPercent: number;
  paymentSummary: { paid: number; total: number };
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');

  // Fuente de datos según el modo. En quincenal usamos el cálculo REAL.
  const active: BudgetForPeriod | QuincenaBudget =
    viewMode === 'biweekly' && quincenaBudget ? quincenaBudget : budget;
  const periodSuffix = viewMode === 'biweekly' ? 'esta quincena' : 'este mes';

  const subtitleFreeMoney = active.isOverspent
    ? `Gastaste ${formatCents(active.variableExpensesSpent, { currency })} de tu dinero libre`
    : active.variableExpensesSpent > 0
      ? `Gastaste ${formatCents(active.variableExpensesSpent, { currency })} ${periodSuffix}`
      : 'Lo que podés gastar en gustos y extras';

  return (
    <>
      {/* TOGGLE Mensual / Quincenal — mismo markup que antes, solo cambia la data */}
      <View className="mt-4 flex-row self-start rounded-2xl bg-gray-200 dark:bg-gray-700 p-1">
        <Pressable
          onPress={() => setViewMode('monthly')}
          accessibilityRole="button"
          accessibilityState={{ selected: viewMode === 'monthly' }}
          className={viewMode === 'monthly' ? 'rounded-xl bg-white dark:bg-gray-900 px-5 py-2' : 'rounded-xl px-5 py-2'}
        >
          <Text className={viewMode === 'monthly' ? 'text-sm font-bold text-gray-900 dark:text-gray-100' : 'text-sm font-medium text-gray-600 dark:text-gray-400'}>
            Mensual
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setViewMode('biweekly')}
          accessibilityRole="button"
          accessibilityState={{ selected: viewMode === 'biweekly' }}
          className={viewMode === 'biweekly' ? 'rounded-xl bg-white dark:bg-gray-900 px-5 py-2' : 'rounded-xl px-5 py-2'}
        >
          <Text className={viewMode === 'biweekly' ? 'text-sm font-bold text-gray-900 dark:text-gray-100' : 'text-sm font-medium text-gray-600 dark:text-gray-400'}>
            Quincenal
          </Text>
        </Pressable>
      </View>

      {/* HERO */}
      {active.isOverBudget ? (
        <View className="mt-6 rounded-3xl bg-red-50 dark:bg-red-950 p-6">
          <Text className="text-sm font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">Sobre presupuesto</Text>
          <Text className="mt-2 text-5xl font-bold text-red-700 dark:text-red-300">
            −{formatCents(Math.abs(active.freeMoney), { currency })}
          </Text>
          <Text className="mt-1 text-sm text-red-800 dark:text-red-200">
            Te faltan {formatCents(Math.abs(active.freeMoney), { currency })} para cubrir ahorro + metas + fijos.
          </Text>
        </View>
      ) : (
        <View className="mt-6 rounded-3xl bg-emerald-50 dark:bg-emerald-950 p-6">
          <Text className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Te quedan</Text>
          <Text className="mt-2 text-5xl font-bold text-emerald-900 dark:text-emerald-100">
            {formatCents(active.freeMoneyRemaining, { currency })}
          </Text>
          <Text className="mt-1 text-base text-emerald-800 dark:text-emerald-200">
            de {formatCents(active.freeMoney, { currency })} de dinero libre {periodSuffix}
          </Text>
        </View>
      )}

      {/* SOBRES */}
      <View className="mt-6 gap-3">
        <BucketCard
          Icon={PiggyBank}
          title="Ahorro"
          amount={active.savings}
          currency={currency}
          color="emerald"
          subtitle={`Meta — ${savingsPercent}% del ingreso ${periodSuffix}`}
        />
        {active.goalsReserve > 0 && (
          <BucketCard
            Icon={Target}
            title="Metas de ahorro"
            amount={active.goalsReserve}
            currency={currency}
            color="emerald"
            subtitle={`Reservado para tus metas ${periodSuffix}`}
          />
        )}
        <BucketCard
          Icon={Receipt}
          title="Gastos fijos"
          amount={active.fixedExpenses}
          currency={currency}
          color="blue"
          subtitle={viewMode === 'biweekly' ? 'Lo que vence en esta quincena' : 'Renta, servicios, suscripciones'}
          progress={{
            value: paymentSummary.paid,
            max: paymentSummary.total,
            label:
              paymentSummary.total === 0
                ? 'Sin gastos fijos vigentes este mes'
                : paymentSummary.paid === paymentSummary.total
                  ? `¡${paymentSummary.total} de ${paymentSummary.total} pagados este mes!`
                  : `${paymentSummary.paid} de ${paymentSummary.total} pagados este mes`,
          }}
        />
        <BucketCard
          Icon={Wallet}
          title="Dinero libre"
          amount={active.freeMoney}
          currency={currency}
          color="amber"
          subtitle={subtitleFreeMoney}
          progress={
            active.freeMoney > 0
              ? {
                  value: active.variableExpensesSpent,
                  max: active.freeMoney,
                  label:
                    active.variableExpensesSpent === 0
                      ? `Quedan ${formatCents(active.freeMoneyRemaining, { currency })}`
                      : `Quedan ${formatCents(active.freeMoneyRemaining, { currency })} de ${formatCents(active.freeMoney, { currency })}`,
                }
              : undefined
          }
        />
      </View>
    </>
  );
}
```

> Se elimina por completo el helper `halve`. La advertencia de "Sobre presupuesto" / "Te pasaste" en el cuerpo principal del Home seguía usando `budget` (mensual) — dejarla como está (refleja el panorama del mes); el HERO ya refleja el modo activo.

- [ ] **Step 4: Verificar typecheck**

Run: `npm run typecheck`
Expected: 0 errores.

- [ ] **Step 5: Correr la app y validar manualmente**

Run: `npm run android` (con un dispositivo/emulador). Crear un ingreso quincenal el día 15 y un gasto fijo con `due_day = 20`. Cambiar el toggle a "Quincenal".
Expected: el sobre "Gastos fijos" en modo Quincenal muestra SOLO el gasto del día 20 (no la mitad del total mensual). Crear una meta (tras Task 10) hace aparecer el sobre "Metas de ahorro".

- [ ] **Step 6: Commit**

```bash
git add src/app/(tabs)/index.tsx
git commit -m "feat(dashboard): cálculo quincenal real + sobre Metas (reemplaza el toggle cosmético)"
```

---

### Task 10: Card de meta + pestaña Metas

**Files:**
- Create: `src/features/goals/GoalCard.tsx`
- Create: `src/app/(tabs)/goals.tsx`
- Modify: `src/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Crear `GoalCard.tsx`**

Crear `src/features/goals/GoalCard.tsx`:

```tsx
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Pressable, Text, View } from 'react-native';

import { formatCents } from '@/shared/utils/money';

import type { GoalWithPlan } from './repository';

export function GoalCard({ goal, onPress }: { goal: GoalWithPlan; onPress: () => void }) {
  const pct = Math.round(goal.plan.progress * 100);
  const deadlineLabel = format(new Date(`${goal.deadline}T00:00:00`), "d 'de' MMMM yyyy", {
    locale: es,
  });

  const statusColor = goal.plan.isComplete
    ? 'text-emerald-600 dark:text-emerald-400'
    : goal.plan.isOverdue
      ? 'text-red-600 dark:text-red-400'
      : 'text-gray-500 dark:text-gray-400';

  const statusText = goal.plan.isComplete
    ? '¡Meta cumplida! 🎉'
    : goal.plan.isOverdue
      ? `Atrasada · faltan ${formatCents(goal.plan.remainingCents, { currency: goal.currency })}`
      : `${formatCents(goal.plan.perQuincenaCents, { currency: goal.currency })} por quincena · ${goal.plan.remainingQuincenas} pagos`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Meta ${goal.name}`}
      className="rounded-2xl bg-white dark:bg-gray-900 p-4 active:opacity-80"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold text-gray-900 dark:text-gray-100">{goal.name}</Text>
        <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300">{pct}%</Text>
      </View>

      {/* Barra de progreso */}
      <View className="mt-3 h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <View
          className={goal.plan.isComplete ? 'h-3 rounded-full bg-emerald-500' : 'h-3 rounded-full bg-emerald-400'}
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </View>

      <View className="mt-3 flex-row items-baseline justify-between">
        <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {formatCents(goal.saved_cents, { currency: goal.currency })}
          <Text className="text-sm font-normal text-gray-500 dark:text-gray-400">
            {' '}
            / {formatCents(goal.target_cents, { currency: goal.currency })}
          </Text>
        </Text>
        <Text className="text-xs text-gray-500 dark:text-gray-400">{deadlineLabel}</Text>
      </View>

      <Text className={`mt-2 text-sm font-medium ${statusColor}`}>{statusText}</Text>
    </Pressable>
  );
}
```

- [ ] **Step 2: Crear la pestaña `goals.tsx`**

Crear `src/app/(tabs)/goals.tsx`:

```tsx
import { useFocusEffect, useRouter } from 'expo-router';
import { Plus, Target } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoalCard } from '@/features/goals/GoalCard';
import { listGoalsWithPlan, type GoalWithPlan } from '@/features/goals/repository';

export default function GoalsScreen() {
  const router = useRouter();
  const [goals, setGoals] = useState<GoalWithPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setGoals(await listGoalsWithPlan({ active: true }));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950" edges={['top']}>
      <View className="px-6 pb-4 pt-4">
        <Text className="text-3xl font-bold text-gray-900 dark:text-gray-100">Metas</Text>
        <Text className="mt-1 text-base text-gray-500 dark:text-gray-400">
          Tu plan de ahorro quincenal
        </Text>
      </View>

      <FlatList
        data={goals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100, gap: 12 }}
        renderItem={({ item }) => (
          <GoalCard goal={item} onPress={() => router.push(`/goal/${item.id}`)} />
        )}
        ListEmptyComponent={
          loading ? null : (
            <View className="mt-4 items-center rounded-3xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-6 py-12">
              <Target size={48} color="#cbd5e1" strokeWidth={1.5} />
              <Text className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-300">
                Sin metas todavía
              </Text>
              <Text className="mt-1 text-center text-sm text-gray-500 dark:text-gray-400">
                Definí un objetivo (viaje, fondo de emergencia) y te calculamos cuánto guardar cada quincena.
              </Text>
              <Pressable
                onPress={() => router.push('/goal/new')}
                accessibilityRole="button"
                className="mt-5 rounded-2xl bg-emerald-600 px-5 py-3 active:bg-emerald-700"
              >
                <Text className="text-sm font-bold text-white">Crear meta</Text>
              </Pressable>
            </View>
          )
        }
      />

      <Pressable
        onPress={() => router.push('/goal/new')}
        accessibilityLabel="Crear nueva meta"
        accessibilityRole="button"
        className="absolute bottom-6 right-6 h-16 w-16 items-center justify-center rounded-full bg-emerald-600 active:bg-emerald-700"
        style={{ elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }}
      >
        <Plus size={28} color="#fff" strokeWidth={2.5} />
      </Pressable>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Registrar la pestaña en `_layout.tsx`**

En `src/app/(tabs)/_layout.tsx`, agregar `Target` al import de lucide:

```ts
import {
  BarChart3,
  Home,
  Receipt,
  Settings as SettingsIcon,
  ShoppingBag,
  Target,
  Wallet,
} from 'lucide-react-native';
```

Insertar la pestaña Metas **después** del bloque `<Tabs.Screen name="fixed-expenses" ... />` y antes de `extras`:

```tsx
      <Tabs.Screen
        name="goals"
        options={{
          title: 'Metas',
          tabBarIcon: ({ color, size }) => <Target color={color} size={size} />,
        }}
      />
```

- [ ] **Step 4: Verificar typecheck**

Run: `npm run typecheck`
Expected: 0 errores.

- [ ] **Step 5: Commit**

```bash
git add src/features/goals/GoalCard.tsx src/app/(tabs)/goals.tsx src/app/(tabs)/_layout.tsx
git commit -m "feat(goals): pestaña Metas con lista, progreso y empty state"
```

---

### Task 11: Pantallas de alta y detalle de meta

**Files:**
- Create: `src/app/goal/new.tsx`
- Create: `src/app/goal/[id].tsx`

> Seguir el patrón exacto de `src/app/income/new.tsx` / `src/app/fixed-expense/new.tsx` (react-hook-form + zodResolver + DateTimePicker). Leer uno de esos antes de escribir para copiar el layout de inputs, el header del Stack y el manejo de `currency`. Aquí va el contenido funcional mínimo completo.

- [ ] **Step 1: Crear `src/app/goal/new.tsx`**

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createGoal } from '@/features/goals/repository';
import { goalFormSchema, type GoalFormValues } from '@/features/goals/schemas';
import { useSettings } from '@/features/settings/store';
import { toCents } from '@/shared/utils/money';

export default function NewGoalScreen() {
  const router = useRouter();
  const currency = useSettings((s) => s.currency);
  const today = format(new Date(), 'yyyy-MM-dd');

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: { name: '', amount: undefined, currency, start_date: today, deadline: today },
  });

  const onSubmit = async (values: GoalFormValues) => {
    await createGoal({
      name: values.name,
      target_cents: toCents(values.amount),
      currency: values.currency,
      start_date: values.start_date,
      deadline: values.deadline,
    });
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">Nueva meta</Text>

        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, value } }) => (
            <View>
              <Text className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Nombre</Text>
              <TextInput
                value={value}
                onChangeText={onChange}
                placeholder="Viaje, fondo de emergencia…"
                className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 text-base text-gray-900 dark:text-gray-100"
              />
              {errors.name && <Text className="mt-1 text-xs text-red-600">{errors.name.message}</Text>}
            </View>
          )}
        />

        <Controller
          control={control}
          name="amount"
          render={({ field: { onChange, value } }) => (
            <View>
              <Text className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Monto objetivo</Text>
              <TextInput
                value={value != null ? String(value) : ''}
                onChangeText={(t) => onChange(t === '' ? undefined : Number(t.replace(',', '.')))}
                keyboardType="numeric"
                placeholder="1000"
                className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 text-base text-gray-900 dark:text-gray-100"
              />
              {errors.amount && <Text className="mt-1 text-xs text-red-600">{errors.amount.message}</Text>}
            </View>
          )}
        />

        {/* Fechas: reutilizar el componente de fecha del proyecto (ver income/new.tsx,
            @react-native-community/datetimepicker). Aquí, inputs ISO directos para
            mantener el ejemplo autocontenido; al implementar, usar el DatePicker real. */}
        <Controller
          control={control}
          name="deadline"
          render={({ field: { onChange, value } }) => (
            <View>
              <Text className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Fecha límite (yyyy-MM-dd)</Text>
              <TextInput
                value={value}
                onChangeText={onChange}
                placeholder="2026-08-31"
                autoCapitalize="none"
                className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 text-base text-gray-900 dark:text-gray-100"
              />
              {errors.deadline && <Text className="mt-1 text-xs text-red-600">{errors.deadline.message}</Text>}
            </View>
          )}
        />

        <Pressable
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          accessibilityRole="button"
          className="mt-4 rounded-2xl bg-emerald-600 px-6 py-4 active:bg-emerald-700"
        >
          <Text className="text-center text-base font-bold text-white">Guardar meta</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
```

> Al implementar, sustituir los `TextInput` de fecha por el DatePicker usado en `income/new.tsx` para consistencia de UX. El `Alert` import queda disponible para confirmaciones si se agregan.

- [ ] **Step 2: Crear `src/app/goal/[id].tsx`**

```tsx
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addContribution,
  deleteGoal,
  getGoal,
  getSavedCents,
  listContributions,
} from '@/features/goals/repository';
import { calculateGoalPlan } from '@/features/goals/calc';
import type { Goal, GoalContribution } from '@/shared/db/types';
import { formatCents, toCents } from '@/shared/utils/money';

export default function GoalDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [saved, setSaved] = useState(0);
  const [contributions, setContributions] = useState<GoalContribution[]>([]);
  const [amountText, setAmountText] = useState('');

  const reload = useCallback(async () => {
    if (!id) return;
    const [g, s, c] = await Promise.all([getGoal(id), getSavedCents(id), listContributions(id)]);
    setGoal(g);
    setSaved(s);
    setContributions(c);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  if (!goal) return null;

  const plan = calculateGoalPlan({
    targetCents: goal.target_cents,
    savedCents: saved,
    from: new Date(),
    deadline: new Date(`${goal.deadline}T00:00:00`),
  });

  const onContribute = async () => {
    const value = Number(amountText.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('Monto inválido', 'Ingresá un número mayor que cero.');
      return;
    }
    await addContribution(goal.id, toCents(value));
    setAmountText('');
    await reload();
  };

  const onDelete = () => {
    Alert.alert('Eliminar meta', `¿Eliminar "${goal.name}" y todas sus contribuciones?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await deleteGoal(goal.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">{goal.name}</Text>

        <View className="rounded-2xl bg-emerald-50 dark:bg-emerald-950 p-5">
          <Text className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Cuota por quincena
          </Text>
          <Text className="mt-1 text-4xl font-bold text-emerald-900 dark:text-emerald-100">
            {formatCents(plan.perQuincenaCents, { currency: goal.currency })}
          </Text>
          <Text className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
            {plan.isComplete
              ? '¡Meta cumplida!'
              : plan.isOverdue
                ? 'Fecha límite vencida — ajustá la meta'
                : `${plan.remainingQuincenas} pagos para llegar al ${goal.deadline}`}
          </Text>
        </View>

        <Text className="text-base text-gray-700 dark:text-gray-300">
          Ahorrado: {formatCents(saved, { currency: goal.currency })} de{' '}
          {formatCents(goal.target_cents, { currency: goal.currency })} ({Math.round(plan.progress * 100)}%)
        </Text>

        {/* Registrar contribución */}
        <View>
          <Text className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Aportar a esta meta</Text>
          <View className="flex-row gap-2">
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="numeric"
              placeholder="Monto"
              className="flex-1 rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-3 text-base text-gray-900 dark:text-gray-100"
            />
            <Pressable onPress={onContribute} accessibilityRole="button" className="rounded-xl bg-emerald-600 px-5 justify-center active:bg-emerald-700">
              <Text className="font-bold text-white">Aportar</Text>
            </Pressable>
          </View>
        </View>

        {/* Historial */}
        <Text className="mt-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Historial ({contributions.length})
        </Text>
        {contributions.map((c) => (
          <View key={c.id} className="flex-row justify-between border-b border-gray-100 dark:border-gray-800 py-2">
            <Text className="text-sm text-gray-700 dark:text-gray-300">{c.contributed_at}</Text>
            <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {formatCents(c.amount_cents, { currency: goal.currency })}
            </Text>
          </View>
        ))}

        <Pressable onPress={onDelete} accessibilityRole="button" className="mt-6 rounded-2xl border border-red-300 dark:border-red-800 px-6 py-3 active:bg-red-50 dark:active:bg-red-950">
          <Text className="text-center text-base font-semibold text-red-600 dark:text-red-400">Eliminar meta</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `npm run typecheck`
Expected: 0 errores.

- [ ] **Step 4: Validar manualmente**

Run: `npm run android`. Crear meta de ₡100.000 con deadline a ~2.5 meses. 
Expected: la cuota por quincena ≈ ₡20.000; al aportar, sube el ahorrado y baja la cuota; el historial lista la contribución; el sobre "Metas" aparece en el Dashboard quincenal.

- [ ] **Step 5: Commit**

```bash
git add src/app/goal/new.tsx src/app/goal/[id].tsx
git commit -m "feat(goals): pantallas de alta, detalle, aporte e historial de metas"
```

---

### Task 12: Colchón financiero en Ajustes + backup completo

**Files:**
- Modify: `src/app/(tabs)/settings.tsx`
- Modify: `src/features/backup/repository.ts:25-34` (`EXPORT_TABLES`)

- [ ] **Step 1: Incluir las tablas nuevas en el backup**

En `src/features/backup/repository.ts`, en `EXPORT_TABLES`, agregar `'goals'` y `'goal_contributions'` después de `'variable_expenses'` y **antes** de `'monthly_snapshots'` (el orden importa: `goals` antes que `goal_contributions` por la FK):

```ts
const EXPORT_TABLES = [
  'settings',
  'categories',
  'incomes',
  'income_occurrences',
  'fixed_expenses',
  'fixed_expense_payments',
  'variable_expenses',
  'goals',
  'goal_contributions',
  'monthly_snapshots',
];
```

> El borrado en import usa `[...EXPORT_TABLES].reverse()`, así que `goal_contributions` se borra antes que `goals` — correcto para la FK.

- [ ] **Step 2: Agregar control de colchón en Ajustes**

En `src/app/(tabs)/settings.tsx`, leer el archivo y replicar el patrón de un setting numérico existente (p. ej. el slider de `savings_percent` o el toggle de notificaciones). Agregar un control para `payday_offset_days` usando el store:

```tsx
// imports (si no están):
import { useSettings } from '@/features/settings/store';

// dentro del componente:
const paydayOffset = useSettings((s) => s.payday_offset_days);
const setPaydayOffset = useSettings((s) => s.setPaydayOffsetDays);

// en el JSX, una sección nueva:
<View className="mt-6 rounded-2xl bg-white dark:bg-gray-900 p-4">
  <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
    Colchón financiero
  </Text>
  <Text className="mt-1 text-sm text-gray-500 dark:text-gray-400">
    Días de margen si el salario se atrasa. Las alertas de gastos no se adelantan a tu pago.
  </Text>
  <View className="mt-3 flex-row items-center gap-2">
    {[0, 1, 2, 3, 5].map((d) => (
      <Pressable
        key={d}
        onPress={() => void setPaydayOffset(d)}
        accessibilityRole="button"
        accessibilityState={{ selected: paydayOffset === d }}
        className={
          paydayOffset === d
            ? 'rounded-xl bg-emerald-600 px-4 py-2'
            : 'rounded-xl bg-gray-200 dark:bg-gray-700 px-4 py-2'
        }
      >
        <Text className={paydayOffset === d ? 'font-bold text-white' : 'text-gray-700 dark:text-gray-300'}>
          {d}d
        </Text>
      </Pressable>
    ))}
  </View>
</View>
```

> Si `Pressable` no está importado en `settings.tsx`, agregarlo al import de `react-native`.

- [ ] **Step 3: Verificar typecheck y lint**

Run: `npm run typecheck && npm run lint`
Expected: 0 errores, 0 warnings.

- [ ] **Step 4: Commit**

```bash
git add src/app/(tabs)/settings.tsx src/features/backup/repository.ts
git commit -m "feat(settings): colchón financiero + backup incluye metas"
```

---

## FASE F — Notificaciones (colchón + día de pago + 2 días)

### Task 13: Notificaciones configurables y recordatorio de día de pago

**Files:**
- Modify: `src/features/notifications/scheduler.ts`

> Req 3.4: alerta **2 días antes** (configurable) + recordatorio el **día de pago** (1 y 15) para ingresar el salario. Req 3.1: el colchón (`payday_offset_days`) corre la alerta del gasto fijo para que no caiga antes del ingreso.

- [ ] **Step 1: Aceptar parámetros de configuración**

En `src/features/notifications/scheduler.ts`, reemplazar la constante hardcodeada y la firma de `rescheduleFixedExpenseNotifications`:

Eliminar:

```ts
const ALERT_DAYS_BEFORE = [3, 0];
```

Cambiar la firma y el cálculo de `daysBefore`:

```ts
export interface NotificationConfig {
  /** Días de anticipación de la alerta (default 2). */
  notifyDaysBefore: number;
  /** Colchón: corre la alerta N días más tarde para no adelantarse al pago. */
  paydayOffsetDays: number;
}

export async function rescheduleFixedExpenseNotifications(
  currency: string,
  config: NotificationConfig = { notifyDaysBefore: 2, paydayOffsetDays: 0 },
): Promise<number> {
  await ensureChannel();
  await cancelAllScheduled();

  const expenses = await listFixedExpenses({ active: true });
  const inCurrency = expenses.filter((e) => e.currency === currency);

  let scheduled = 0;
  const now = new Date();

  // Alertas por gasto fijo: una "X días antes" y otra el día mismo.
  // El colchón resta días de anticipación efectiva (no avisa tan temprano).
  const effectiveBefore = Math.max(0, config.notifyDaysBefore - config.paydayOffsetDays);
  const alertOffsets = [effectiveBefore, 0];

  for (const exp of inCurrency) {
    const next = nextDueDate(now, exp.due_day);
    for (const daysBefore of alertOffsets) {
      const fireAt = set(addDays(next, -daysBefore), { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 });
      if (fireAt.getTime() <= now.getTime()) continue;

      const title = daysBefore === 0 ? `Hoy se vence ${exp.name}` : `Faltan ${daysBefore} días: ${exp.name}`;
      const body = `${formatCents(exp.amount_cents, { currency: exp.currency })} · día ${exp.due_day}`;

      await Notifications.scheduleNotificationAsync({
        content: { title, body, data: { fixed_expense_id: exp.id } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId: CHANNEL_ID },
      });
      scheduled++;
    }
  }

  // Recordatorios de día de pago (1 y 15) — ingresar salario y aplicar distribución.
  scheduled += await schedulePaydayReminders(now);

  return scheduled;
}

/** Programa el próximo recordatorio del día 1 y del día 15 a las 9am. */
async function schedulePaydayReminders(now: Date): Promise<number> {
  let count = 0;
  for (const payDay of [1, 15]) {
    const fireAt = nextDayOfMonthAt9(now, payDay);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Día de pago 💰',
        body: 'Registrá tu salario y revisá la distribución sugerida de esta quincena.',
        data: { kind: 'payday' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt, channelId: CHANNEL_ID },
    });
    count++;
  }
  return count;
}

/** Próxima ocurrencia del día `day` del mes a las 9am, estrictamente futura. */
function nextDayOfMonthAt9(from: Date, day: number): Date {
  const candidate = set(new Date(from.getFullYear(), from.getMonth(), day), {
    hours: 9, minutes: 0, seconds: 0, milliseconds: 0,
  });
  if (candidate.getTime() > from.getTime()) return candidate;
  return set(new Date(from.getFullYear(), from.getMonth() + 1, day), {
    hours: 9, minutes: 0, seconds: 0, milliseconds: 0,
  });
}
```

- [ ] **Step 2: Pasar la config desde el caller**

Buscar las llamadas a `rescheduleFixedExpenseNotifications` (en `src/app/(tabs)/settings.tsx` y/o un boot effect):

Run: `npm test -- --listTests >/dev/null 2>&1; grep -rn "rescheduleFixedExpenseNotifications" src`

En cada llamada, pasar la config desde el store de settings:

```ts
import { useSettings } from '@/features/settings/store';
// ...
const { notify_days_before, payday_offset_days } = useSettings.getState();
await rescheduleFixedExpenseNotifications(currency, {
  notifyDaysBefore: notify_days_before,
  paydayOffsetDays: payday_offset_days,
});
```

- [ ] **Step 3: Verificar typecheck y lint**

Run: `npm run typecheck && npm run lint`
Expected: 0 errores, 0 warnings.

- [ ] **Step 4: Commit**

```bash
git add src/features/notifications/scheduler.ts src/app/(tabs)/settings.tsx
git commit -m "feat(notifications): aviso configurable (2 días), colchón y recordatorio de día de pago"
```

---

## FASE G — QA y cierre

### Task 14: Suite completa, lint y doctor

**Files:** (ninguno nuevo — verificación)

- [ ] **Step 1: Correr toda la suite de tests**

Run: `npm test`
Expected: PASS — los 59 tests previos + los nuevos de `cycle` (≈11), `goals/calc` (7) y `calculate` (+4). Total ≈ 81.

- [ ] **Step 2: Typecheck y lint completos**

Run: `npm run typecheck && npm run lint`
Expected: 0 errores, 0 warnings.

- [ ] **Step 3: expo-doctor**

Run: `npx expo-doctor`
Expected: 17/17 checks OK.

- [ ] **Step 4: Prueba de migración limpia**

Borrar la app del emulador y reinstalar (`npm run android`) para correr migraciones v1→v5 desde cero.
Expected: la app arranca sin error de SQLite; las pestañas Metas e Inicio cargan; crear meta + ingreso + gasto fijo funciona end-to-end.

- [ ] **Step 5: Prueba de backup round-trip**

Exportar backup desde Ajustes con una meta y contribuciones creadas; importar el mismo archivo.
Expected: las metas y contribuciones se restauran (no se pierden); el import no falla por FK.

---

### Task 15: Actualizar CHANGELOG y CLAUDE.md

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `CLAUDE.md` (sección "Estado actual" y schema)

- [ ] **Step 1: Entrada de CHANGELOG**

En `CHANGELOG.md`, bajo `## [Unreleased]` (o crear `## [0.9.0] - 2026-06-XX`):

```markdown
## [0.9.0] - 2026-06-XX — Ciclo quincenal real + Metas de ahorro

### Added
- **Ciclo quincenal real**: el toggle "Quincenal" del Dashboard ahora calcula qué gastos fijos vencen en la quincena en curso (Q1: días 1–14, Q2: 15–fin de mes) y cuánto reservar del ingreso de ese pago. Antes solo dividía el mes entre 2.
- **Módulo de Metas de ahorro** (nueva pestaña): crear meta (objetivo + fecha límite), cálculo automático de cuota por quincena, registro de aportes, historial e indicador de progreso/atraso.
- **Sobre "Metas"** en el Dashboard: descuenta la reserva de metas del dinero libre.
- **Colchón financiero** (Ajustes): margen de días si el salario se atrasa.
- **Recordatorio de día de pago** (1 y 15) y alerta de gasto fijo configurable (default 2 días antes).
- Migraciones v4 (goals, goal_contributions) y v5 (payday_offset_days, notify_days_before).
- Backup JSON ahora incluye metas y contribuciones.

### Tests
- `cycle.test.ts`, `goals/calc.test.ts` nuevos; `calculate.test.ts` +4 casos del sobre Metas.
```

- [ ] **Step 2: Actualizar CLAUDE.md**

Corregir la sección "Estado actual" (decía Fase 1; ahora Fase 8 / v0.9.0), agregar `goals` y `goal_contributions` al árbol de schema, y documentar que el modelo quincenal es real. Agregar `cycle/` y `goals/` a la estructura de `features/`.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md CLAUDE.md
git commit -m "docs: changelog v0.9.0 y actualización de CLAUDE.md"
```

---

## Cronograma de desarrollo (estimación de horas)

Estimación para un desarrollador familiarizado con React Native/Expo pero nuevo en este código. Incluye lectura de archivos vecinos, ajuste de UI y pruebas en dispositivo.

| Fase | Tareas | Backend / DB | Lógica de cálculo | Interfaz (UI) | Pruebas | Subtotal |
|------|--------|:---:|:---:|:---:|:---:|:---:|
| **A — DB y tipos** | 1, 2 | 4 h | — | — | 1 h | **5 h** |
| **B — Quincenas (TDD)** | 3, 4 | — | 5 h | — | 3 h (incluido en TDD) | **5 h** |
| **C — Sobres + presupuesto quincenal** | 5, 6 | 3 h | 4 h | — | 2 h | **9 h** |
| **D — Módulo Metas** | 7, 8 | 5 h | 4 h | — | 3 h | **12 h** |
| **E — Interfaz** | 9, 10, 11, 12 | — | — | 18 h | 4 h (manual) | **22 h** |
| **F — Notificaciones** | 13 | 4 h | 1 h | 2 h | 2 h | **9 h** |
| **G — QA y cierre** | 14, 15 | — | — | — | 6 h | **6 h** |
| **Totales por columna** | | **16 h** | **14 h** | **22 h** | **16 h** | **68 h** |

**Resumen por categoría solicitada:**
- **Backend / Base de datos:** ~16 h (migraciones, tipos, repositorios, store, backup).
- **Lógica de cálculo:** ~14 h (cycle, calc de metas, extensión de buckets, presupuesto quincenal — todo TDD).
- **Interfaz de usuario:** ~22 h (Dashboard quincenal, pestaña Metas, alta/detalle de meta, colchón en Ajustes).
- **Pruebas:** ~16 h (unitarias TDD + validación manual en dispositivo + migración limpia + backup round-trip).

**Total estimado: ~68 horas** (≈ 9 jornadas). Buffer recomendado +15% por integración y pulido de UX (DatePickers, dark mode en pantallas nuevas, hápticas): **~78 h**.

**Fuera de alcance (confirmado con el cliente):** sincronización en la nube / backend con cuentas. Se mantiene el backup/restore JSON manual existente para el cambio de dispositivo.

---

## Self-Review (cobertura del spec)

| Requerimiento del spec | Cubierto por |
|------------------------|--------------|
| 1. Gastos con fecha de vencimiento | Ya existe (`fixed_expenses.due_day`); se usa en Task 6 para asignar a quincena. |
| 1. Asignación automática de ingresos por quincena | Task 6 (`getQuincenaBudget`) + Task 9 (Dashboard real). |
| 1. Identificar gastos del 15 al 29 según el pago | Task 3 (`getQuincena`, Q2 = 15→fin) + Task 6 (`due_day >= 15`). |
| 2. Crear metas (objetivo, monto, fecha) | Task 8 (repository) + Task 11 (alta). |
| 2. Cálculo de ahorro quincenal | Task 4 (`countRemainingQuincenas`) + Task 7 (`calculateGoalPlan`). |
| 2. Descuento automático sugerido + saldo libre | Task 5 (`goalsReserve`) + Task 9 (sobre Metas en Dashboard). |
| 3.1 Colchón financiero | Task 2 (`payday_offset_days`) + Task 12 (UI) + Task 13 (notificaciones). |
| 3.2 Sobres virtuales | Task 9 (4 sobres: Ahorro, Metas, Fijos, Libre). |
| 3.3 Historial de cumplimiento de metas | Task 7 (`progress`, `isOverdue`) + Task 10 (`GoalCard`) + Task 11 (historial). |
| 3.4 Notificaciones push (2 días antes + día de pago) | Task 13. |
| 3.5 Sincronización en la nube | **Fuera de alcance** (decisión del cliente): backup JSON manual existente. |
| Entregable: análisis de base de código | Sección "Análisis" de este documento. |
| Entregable: propuesta de base de datos | Sección "Propuesta de base de datos" (v4, v5). |
| Entregable: cronograma | Sección "Cronograma de desarrollo". |

**Consistencia de tipos verificada:** `Quincena`/`QuincenaHalf` (cycle) → usados en `quincena.ts` y `goals/repository.ts`; `GoalPlan` (calc) → consumido por `GoalWithPlan`; `goalsReserveAmount`/`goalsReserve` (calculate) → producido por `getGoalsReserveForCurrency` y consumido por el Dashboard. Sin nombres divergentes entre tareas.
