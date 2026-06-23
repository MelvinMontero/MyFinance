# Tarea 0 — Reconocimiento del repo y plan adaptado

> **Generado al ejecutar el "Plan de Implementación MyFinance" (versión ciega, escrita sin acceso al código).**
> Resultado: el plan ciego **no aplica tal cual**. El repo está mucho más avanzado de lo que asume y ya contiene un plan hecho a su medida para el mismo objetivo. Este documento reconcilia ambos y define el **plan adaptado** que sí se ejecutará.
> Decisión del dueño (2026-06-23): **adaptar el plan pegado a la arquitectura real** (no ejecutarlo literal). Entorno: **actualizará Node a ≥ 20.19.4** antes de correr tests.

---

## 0. Resumen ejecutivo

- El repo **no está en blanco**: está en **v0.8.1 / Fase 7** (Expo SDK 54, RN 0.81, TS strict, Expo Router 6, NativeWind 4, Zustand 5, expo-sqlite con migrador versionado).
- Ya existen: utilidades de dinero en centavos (con tests), capa SQLite versionada e inmutable, ingresos, gastos fijos, gastos variables, cálculo de sobres (`calculateBuckets`, 19 tests), reportes, notificaciones, backup JSON, dark mode, biometría, onboarding.
- Ejecutar el plan ciego literal **duplicaría** esos módulos y **rompería la DB** (ver §3).
- Ya hay un plan correcto en [`docs/plan/2026-06-01-quincenas-y-metas-de-ahorro.md`](plan/2026-06-01-quincenas-y-metas-de-ahorro.md) (15 tareas, 7 fases, TDD). Es la **columna vertebral** del plan adaptado.
- El plan pegado aporta 5 ideas que el plan del repo **no** cubre y que sí se injertan (ver §5): prioridad de metas, pantalla de desglose dedicada, amortización del gasto mensual, cuenta regresiva de metas, alerta de sobregasto al registrar gasto real.

---

## 1. Respuestas a las preguntas de la Tarea 0

1. **Expo SDK / RN:** Expo SDK **54.0.x**, React Native **0.81.5**, React 19.1.0, TypeScript 5.9 (strict + `noUncheckedIndexedAccess`).
2. **Router/navegación:** **Expo Router 6** file-based en `src/app/`. NO es React Navigation manual ni `src/screens/`. Tabs en `src/app/(tabs)/_layout.tsx` (6 pestañas: Inicio, Ingresos, Fijos, Extras, Reportes, Ajustes). Pantallas de detalle/alta en `src/app/<recurso>/new.tsx` y `[id].tsx`.
3. **Login / sesión:** **No hay login con usuarios**. Es **mono-usuario, local-first**. Hay un *bloqueo biométrico* opcional (`src/features/auth/`) pero NO un `userId`. → Las tablas nuevas **NO llevan `user_id`** (se omite, sin constante `LOCAL_USER`).
4. **Persistencia:** **expo-sqlite** (async), singleton `getDb()` en `src/shared/db/client.ts`, migrador `PRAGMA user_version` en `src/shared/db/migrator.ts`, migraciones en `src/shared/db/migrations.ts` (v1–v3 aplicadas). Prefs vía `expo-secure-store`. NO hay AsyncStorage/MMKV/Realm para datos transaccionales.
5. **Modelos/pantallas existentes de ingresos/gastos/metas:**
   - Ingresos: `src/features/incomes/{repository,occurrences,schemas}.ts` + UI (`incomes.tsx`, `income/new.tsx`, `income/[id].tsx`). CRUD + `generateOccurrences()` (one_time/biweekly/monthly).
   - Gastos fijos: `src/features/fixed-expenses/repository.ts` + UI. CRUD con `due_day` (1–31) + pagos por período `YYYY-MM`.
   - Gastos variables ("Extras"): `src/features/variable-expenses/repository.ts` + UI.
   - **Metas: NO existen.** (Es lo nuevo a construir.)
6. **Estado global:** **Zustand 5**. Ej.: `src/features/settings/store.ts`. → NO instalar Zustand de nuevo.
7. **Moneda:** centavos `INTEGER` en DB; `src/shared/utils/money.ts` (`toCents`, `fromCents`, `formatCents`, `parseAmount`) + `src/shared/utils/currency.ts` (monedas soportadas) + hook `useFormatCents`. Multi-moneda **por fila** (`currency` en incomes/fixed_expenses/variable_expenses).
8. **Tests (Jest):** **Sí.** jest-expo ya configurado, `npm test`. Tests existentes: `money.test.ts`, `budgets/calculate.test.ts` (19), `incomes/occurrences.test.ts`.
9. **expo-notifications:** **Ya instalado y en uso.** `src/features/notifications/scheduler.ts` (avisa 3 días antes + el día, 9am, por `due_day`; canal `fixed-expenses`; `ALERT_DAYS_BEFORE = [3, 0]` hardcodeado).
10. **`scripts/`:** carpeta presente a nivel raíz (utilidades de arranque tipo `.bat`/logs); no contiene lógica de la app.

---

## 2. Decisiones de ruta y patrón (reconciliación con el plan ciego)

| El plan ciego dice… | Realidad del repo | Decisión |
|---|---|---|
| `src/screens/…` / nav manual | Expo Router en `src/app/` | Usar `src/app/(tabs)/…` y `src/app/<recurso>/…` |
| `src/lib/money.ts` | `src/shared/utils/money.ts` (con tests) | **Reutilizar.** No crear `src/lib/`. `formatCRC` → `formatCents`. `splitEvenly` no existe: crearla solo si hace falta, dentro de `shared/utils/money.ts`. |
| `src/lib/fortnight.ts` (paydays 15/fin) | — | Reemplazado por `src/features/cycle/cycle.ts` (modelo Q1/Q2, ver §4). |
| `src/db/{schema,database}.ts` + `CREATE TABLE IF NOT EXISTS` | Migrador versionado inmutable en `src/shared/db/` | **Reutilizar migrador.** Añadir migraciones **v4 y v5**. Jamás tocar v1–v3. |
| `src/db/repositories/{incomes,expenses,goals}.ts` | `src/features/<dominio>/repository.ts` | Solo crear `src/features/goals/repository.ts`. Ingresos/gastos ya existen. |
| `src/state/financeStore.ts` (Zustand nuevo) | Zustand ya en uso | Reutilizar el patrón; extender stores existentes. |
| `src/notifications/scheduler.ts` | `src/features/notifications/scheduler.ts` | **Extender el existente.** No crear carpeta paralela. |
| IDs `INTEGER AUTOINCREMENT` | IDs `TEXT` (UUID `expo-crypto`) | Usar `randomUUID()` TEXT. |
| Tabla `actual_expenses` | `variable_expenses` ya existe | Reutilizar `variable_expenses` como "gasto real". |
| Tabla `provisions` | `goal_contributions` (plan v4) | Para metas, usar `goal_contributions`. Las provisiones de gasto son **calculadas**, no se persisten. |

**Convenciones del repo (obligatorias al codear):** centavos `INTEGER`; fechas ISO `TEXT` `yyyy-MM-dd`; alias `@/*` → `src/*`; TS strict sin `any`; lógica pura en `calc.ts`/`cycle.ts` (testeable sin DB), `repository.ts` agrega SQLite; Conventional Commits; UI en español con tildes, identificadores en inglés; migraciones inmutables.

---

## 3. Por qué el plan ciego rompería la DB (evidencia)

La tabla `incomes` ya existe con este esquema (migración v1): `id TEXT PRIMARY KEY, amount_cents, source, frequency('one_time'|'biweekly'|'monthly'), start_date, end_date, is_active, note, currency, created_at, updated_at`.

El plan ciego intenta `CREATE TABLE IF NOT EXISTS incomes (id INTEGER AUTOINCREMENT, label, type, frequency('fixed'|'extra'), …)`. Como la tabla ya existe, el `CREATE … IF NOT EXISTS` **no hace nada**, y luego los `INSERT INTO incomes (label, type, …)` **fallan en runtime** porque esas columnas no existen. Lo mismo aplica a la divergencia de modelo de `expenses` vs `fixed_expenses`/`variable_expenses`. Conclusión: **no crear tablas nuevas que colisionen**; extender el esquema vía migraciones v4/v5.

---

## 4. Conflicto de regla de negocio (a resolver explícitamente)

Los dos planes traen "decisiones confirmadas con el dueño" **contradictorias** en dos puntos. Como el dueño eligió *adaptar el plan pegado*, el **comportamiento** sigue al plan pegado y la **arquitectura** al repo. Quedan así:

### 4.1 Reparto del gasto mensual
- **Plan pegado (elegido):** un gasto mensual se **amortiza** entre TODAS las quincenas que faltan hasta su fecha de cobro → `provisión = monto / quincenas_restantes`. (Ahorrás de a poco para el cobro.)
- **Plan del repo:** asigna el monto **completo** a la quincena en que cae (`due_day ≤ 14` → Q1, `≥ 15` → Q2).
- **Resolución:** implementar el modelo de **amortización** del plan pegado en una función pura nueva (`expenseProvision`), construida sobre `cycle.ts`. El presupuesto quincenal (`quincena.ts`) usará la provisión amortizada, no la asignación a quincena.
  > ⚠️ Esto difiere del plan del repo (Task 6). Si el dueño en realidad prefiere "asignar a la quincena del cobro" (más simple, sin acumular), avisar — es un cambio de una función.

### 4.2 Modelo de quincena
- Ambos modelos son **compatibles**: pagos llegan el **15** (cubre Q2 = 15–fin) y a **fin de mes** (cubre Q1 = 1–14 del mes siguiente). Se adopta el modelo del repo: `Q1 = días 1–14`, `Q2 = días 15–fin de mes`, key `yyyy-MM-H`. El "calendario de paydays 15/fin" del plan pegado se deriva de ahí; no se necesita `fortnight.ts` aparte.

---

## 5. Lo que el plan pegado AÑADE sobre el plan del repo (a injertar)

| # | Aporte del plan pegado | Estado en plan del repo | Adaptación |
|---|---|---|---|
| 1 | **Prioridad de meta** (alta/media/baja) + sugerir recortes ante déficit | Ausente | Añadir columna `priority` a `goals` (migración v4); orden y "metas ajustables" en `goals/calc.ts` y UI. |
| 2 | **Pantalla de desglose** "¿cuánto aparto este cobro?" | Cubierto parcial por Dashboard quincenal | Reusar el Dashboard quincenal; añadir vista/ sección de desglose por ítem (`ProvisionRow`). |
| 3 | **Amortizar gasto mensual** entre quincenas restantes | Plan del repo asigna a quincena | Función pura `expenseProvision` (ver §4.1). |
| 4 | **Cuenta regresiva de metas** (30/15/7/1 días) | Solo avisos de gasto + día de pago | Añadir `buildGoalCountdown` al scheduler existente. |
| 5 | **Alerta de sobregasto** al registrar gasto real + notif inmediata | `isOverspent` ya existe en `calculateBuckets`/quincena | Reusar `variable_expenses`; al registrar, evaluar el período y disparar notif inmediata si `isOverspent`. |

---

## 6. Modelo de datos adaptado (migraciones nuevas)

**Migración v4 — Metas (con prioridad):**
```sql
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  target_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CRC',
  start_date TEXT NOT NULL,
  deadline TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
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
```
> Diferencia con el plan del repo: se añade `priority` (requisito del plan pegado).

**Migración v5 — Colchón + notificaciones configurables** (igual que el plan del repo):
```sql
ALTER TABLE settings ADD COLUMN payday_offset_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE settings ADD COLUMN notify_days_before INTEGER NOT NULL DEFAULT 2;
```
Backup: añadir `goals` y `goal_contributions` a `EXPORT_TABLES` en `src/features/backup/repository.ts`.

---

## 7. Plan adaptado — tareas (orden TDD, rutas reales)

Backbone = plan del repo; se marcan **[+PEGADO]** los injertos del plan pegado.

- **A1.** Migración v4 (goals + goal_contributions, **con `priority`** [+PEGADO]) + tipos en `db/types.ts`. → `typecheck`.
- **A2.** Migración v5 (colchón + notif) + `Settings`, `UpdateSettingsInput`, `settings/store.ts`. → `typecheck`.
- **B3.** `features/cycle/cycle.ts`: `getQuincena`, `quincenaBounds`, `quincenaKey` (TDD).
- **B4.** `cycle.ts`: `countRemainingQuincenas` (TDD).
- **B4b.** [+PEGADO] `features/cycle/expense.ts` (o en `cycle.ts`): `expenseProvision(amount, dueDate, from)` = amortización del gasto mensual/puntual entre quincenas restantes (TDD). Ver §4.1.
- **C5.** Extender `calculateBuckets` con `goalsReserveAmount`/`goalsReserve` (sin romper los 19 tests) (TDD).
- **C6.** `features/budgets/quincena.ts`: presupuesto quincenal real. Usa `expenseProvision` para fijos mensuales (amortizado) [+PEGADO].
- **D7.** `features/goals/calc.ts`: `calculateGoalPlan` (cuota = ceil(restante/quincenas)) + helper de **orden por prioridad y metas ajustables ante déficit** [+PEGADO] (TDD).
- **D8.** `features/goals/{repository,schemas}.ts` (schema incluye `priority`).
- **E9.** Dashboard quincenal real + **sección/pantalla de desglose** con `ProvisionRow` [+PEGADO]; banner de déficit con orden por prioridad.
- **E10.** Pestaña "Metas" (7ª, icono `Target`): lista (`(tabs)/goals.tsx`), alta (`goal/new.tsx`), detalle/contribuir (`goal/[id].tsx`), barra de progreso. Colchón en Ajustes.
- **F11.** Notificaciones: hacer `notify_days_before` configurable, recordatorio día de pago, **cuenta regresiva de metas (30/15/7/1)** [+PEGADO], colchón.
- **F12.** [+PEGADO] Sobregasto: al registrar gasto variable, evaluar período (`getQuincenaBudget`) y disparar notif inmediata + banner si `isOverspent`.
- **G13.** Backup incluye tablas nuevas. Suite completa verde: `typecheck`, `test`, `lint`. CHANGELOG v0.9.0. Actualizar CLAUDE.md.

---

## 8. Decisiones de entorno y testing

- **Node:** el proyecto exige **≥ 20.19.4** (RN 0.81 / Expo SDK 54). La máquina actual tiene **v18.20.4** (sin nvm/portable). **Bloqueo para el flujo TDD** (`npm test`, `typecheck`, Expo). El dueño actualizará Node y avisará antes de implementar.
- **SQLite en tests:** la lógica de negocio va en módulos **puros** (`cycle.ts`, `calc.ts`, `calculate.ts`, `expense.ts`) → testeable sin SQLite (como ya hace el repo). Los `repository.ts` se validan manualmente en dispositivo (Tarea G13), siguiendo el patrón existente del repo.
- **No-regresión:** los 19 tests de `calculateBuckets` deben seguir verdes (extensión con default 0).

---

## 9. Qué NO hacer

- No crear `src/lib/`, `src/db/`, `src/screens/`, `src/state/`, `src/notifications/` (carpetas del plan ciego). Usar las reales.
- No crear tablas `incomes`/`expenses`/`actual_expenses`/`provisions` nuevas (colisionan o duplican).
- No reinstalar Zustand ni expo-notifications.
- No modificar migraciones v1–v3.
- No reescribir login/navegación base.
