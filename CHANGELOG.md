# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) — fechas YYYY-MM-DD.

## [Unreleased]

## [0.6.0] - 2026-05-13 — Fase 5: Gastos extras + toggle Mensual/Quincenal

### Added — Toggle Mensual/Quincenal en Inicio
- **Segmented control** "Mensual / Quincenal" arriba del Hero (visible solo cuando hay ingresos).
- En modo **Quincenal**, todos los montos del dashboard se dividen por 2 (promedio por paycheck) — Hero, los 3 sobres, warnings. El conteo "X de Y pagados" NO cambia (es estado, no monto).
- Subtitles cambian "este mes" ↔ "por quincena" según el modo.
- Solo afecta display — la DB sigue almacenando totales mensuales.

### Added — Fase 5: Gastos variables (extras)
- **Tabla `variable_expenses`** ya existía desde Fase 1 (con `currency` agregado en migración v2). No requirió cambios de schema.
- **Repositorio** (`features/variable-expenses/repository.ts`):
  - CRUD: `createVariableExpense`, `listVariableExpenses({ period?, currency? })`, `getVariableExpense`, `updateVariableExpense`, `deleteVariableExpense`.
  - Stats: `getVariableExpenseTotal(period, currency?)`, `getVariableExpenseCount(period?)`.
  - IDs via `expo-crypto.randomUUID()`.
- **Schema zod** (`features/variable-expenses/schemas.ts`) — `amount > 0`, `currency` enum, `category_id` requerido, `occurred_at` ISO, `note` opcional.
- **UI components**:
  - `VariableExpenseForm` — paleta ámbar para diferenciar de income (verde) y fijos (azul). Currency selector + amount + categoría (lista vertical con icons + color del catálogo) + date picker (con `maximumDate=hoy` para evitar gastos futuros) + nota.
  - `VariableExpenseCard` — icon de categoría a la izquierda, nombre + monto + fecha + nota en una sola línea compacta.
- **Pantallas**:
  - `(tabs)/extras.tsx` — tab "Extras" con header de progreso ámbar mostrando total gastado del mes en la moneda activa, FlatList ordenada por fecha desc, FAB ámbar.
  - `variable-expense/new.tsx` — modal de creación, autofocus en monto, moneda default desde settings.
  - `variable-expense/[id].tsx` — modal de edición + delete.
- **Tab "Extras"** agregada (icono ShoppingBag). Total tabs: **5** (Inicio · Ingresos · Fijos · Extras · Ajustes).
- **FAB en Home** (ámbar, posición fija) que va directo a `/variable-expense/new` — el "gasto rápido" del spec.

### Dashboard "vivo"
- Como Fase 4 ya integraba `variableExpensesSpent` en `calculateBuckets`, **el sobre Dinero Libre cobra vida automáticamente**: la barra ámbar se llena, "Te quedan" decrementa, el warning de overspent se activa si te pasás.
- El subtítulo del sobre cambia: "Gastaste ₡X de tu dinero libre" cuando hay gastos del mes.

### Verificaciones
- `npx tsc --noEmit`: 0 errores.
- `npm test`: **59/59** tests.
- `npm run lint`: 0 warnings.
- `npx expo-doctor`: 17/17.

## [0.5.0] - 2026-05-13 — Fase 4: Cálculo de sobres + Dashboard

### Added — Función crítica con TDD
- **`features/budgets/calculate.ts`** — función pura `calculateBuckets({ incomeAmount, savingsPercent, fixedExpensesAmount, variableExpensesAmount })` que devuelve `{ income, savings, fixedExpenses, freeMoney, variableExpensesSpent, freeMoneyRemaining, isOverBudget, isOverspent }`.
  - `savings = round(income × savings_percent / 100)` — redondeado al centavo más cercano (half-up).
  - `freeMoney = income − savings − fixedExpenses` (puede ser negativo).
  - `freeMoneyRemaining = freeMoney − variableExpenses` (puede ser negativo).
  - `isOverBudget` true cuando ahorro + fijos superan al ingreso.
  - `isOverspent` true cuando los gastos variables exceden el dinero libre.
  - Validación estricta: inputs no negativos finitos, `savingsPercent ∈ [0, 100]`.
- **21 tests TDD** (`calculate.test.ts`) cubriendo: happy path, over-budget, overspent, ambos a la vez, rounding (incluyendo identidad income = savings + freeMoney + fixed sin pérdida de centavo), savings_percent fraccional (20.5%), validación de entradas inválidas, escenario del CLAUDE.md.
- **`features/budgets/repository.ts`** — `getBudgetForPeriod(period, currency, savingsPercent)`:
  - Agrega ingresos del período en la moneda (JOIN income_occurrences + incomes).
  - Agrega gastos fijos activos en la moneda vigentes en el período (filtra por start_date/end_date).
  - Lista monedas distintas con registros activos (para mostrar aviso "X no incluidos").
  - Delega los números a `calculateBuckets`.
- **Decisión: multi-moneda → cálculo por moneda seleccionada.** Sumar CRC + USD daría números sin sentido, así que los buckets se calculan solo para la moneda default. Records en otras monedas se muestran como nota informativa.

### Added — Dashboard nuevo
- **Pantalla Inicio rediseñada** (`src/app/(tabs)/index.tsx`):
  - **Header** con período en formato "Mayo de 2026".
  - **Hero card** verde con "Te quedan ₡X de ₡Y de dinero libre". Variante roja "−₡X · Sobre presupuesto" cuando `isOverBudget`. Empty state con CTA "Agregar ingreso" cuando no hay datos del mes.
  - **3 sobres**: Ahorro (emerald, PiggyBank), Gastos fijos (blue, Receipt), Dinero libre (amber, Wallet). Cada uno con icono en tile de color, título, monto grande y subtítulo.
  - **Barras de progreso**: Gastos fijos muestra "N de M pagados este mes" con barra azul; Dinero libre muestra "Quedan ₡X de ₡Y" con barra ámbar (vacía mientras no haya gastos variables — Fase 5).
  - **Warning over-budget**: card rojo con explicación cuando ahorro + fijos > ingreso.
  - **Warning overspent**: card ámbar cuando se excede el dinero libre.
  - **Nota multi-moneda**: lista las otras monedas con registros si las hay.
- **Componente `BucketCard`** (`features/budgets/BucketCard.tsx`) — reusable con props `Icon`, `title`, `amount`, `currency`, `color: 'emerald' | 'blue' | 'amber'`, `subtitle`, `progress?: { value, max, label }`. Mapas de clases estáticos para que Tailwind las detecte en build.

### Verificaciones
- `npx tsc --noEmit`: 0 errores.
- `npm test`: **59/59 tests** (19 occurrences + 19 money + **21 buckets nuevos**).
- `npm run lint`: 0 warnings.
- `npx expo-doctor`: 17/17.

### Próximo
- Fase 5: Gastos variables. Con eso `variableExpensesAmount` deja de ser 0 y la barra de progreso de Dinero libre toma vida.

## [0.4.0] - 2026-05-13 — Fase 3: Gastos fijos + moneda por registro

### Cambio de semántica: moneda por registro (no global)
- **Migración v2**: agrega columna `currency TEXT NOT NULL DEFAULT 'CRC'` a `incomes`, `fixed_expenses` y `variable_expenses`. Las filas existentes quedan en CRC automáticamente.
- **`IncomeForm` y `FixedExpenseForm`**: ahora incluyen un segmented control de moneda (CRC / USD) arriba del input de monto. El símbolo del input cambia en vivo según la moneda seleccionada.
- **Display reactivo**: `IncomeCard`, `OccurrencesList`, `OverrideAmountModal` y `FixedExpenseCard` formatean cada monto con la moneda de su fila (no la global).
- **Settings.currency** sigue existiendo pero su rol cambia: es la **moneda por defecto preseleccionada al crear** un nuevo ingreso/gasto. Cambiarla NO toca registros existentes. Pantalla Ajustes reescrita en consecuencia.
- Hook `useFormatCents` y `useCurrency` quedan disponibles para totales agregados futuros (Fase 4) — pero los componentes con row-context usan `formatCents(cents, { currency: row.currency })` directo.

### Added — Fase 3: Gastos fijos
- **Repositorio** (`features/fixed-expenses/repository.ts`):
  - CRUD: `createFixedExpense`, `listFixedExpenses`, `listFixedExpensesWithPayment`, `getFixedExpense`, `updateFixedExpense`, `deleteFixedExpense`. ID via `expo-crypto.randomUUID()`.
  - Pagos: `markAsPaid(id, period?)` idempotente, `unmarkAsPaid`, `listPaymentsForExpense`. Default period = `currentPeriod()` (yyyy-MM de hoy).
  - Stats: `getFixedExpenseCount`, `getPaymentSummary(period)` con JOIN para `{ total, paid }`.
  - `listFixedExpensesWithPayment(period)` hace LEFT JOIN entre `fixed_expenses` y `fixed_expense_payments` en una sola query — una fila por gasto con `payment_id`/`paid_at` adjunto.
- **Schemas zod** (`features/fixed-expenses/schemas.ts`) — `name` requerido, `amount > 0`, `currency` enum, `category_id` requerido, `due_day` 1-31, validación cruzada de fechas.
- **Repositorio de categorías** (`features/categories/repository.ts`) — `listCategories({ type })`, `getCategory(id)`. Permite filtrar por tipo (income / fixed_expense / variable_expense).
- **`CategoryIcon`** (`features/categories/CategoryIcon.tsx`) — render dinámico de iconos lucide con mapa hardcodeado para los 15 iconos seedeados (mejor tree-shaking que import dinámico).
- **UI components**:
  - `FixedExpenseForm` — moneda + monto + nombre + categoría (lista vertical con icono + color de la categoría) + día de pago (1-31 con keyboard numérico) + fechas. Reutiliza el patrón de IncomeForm.
  - `FixedExpenseCard` — checkbox de pago a la izquierda (verde brand cuando pagado, tachado en gris cuando lo está), icono de categoría, nombre + monto + día de vencimiento.
- **Pantallas**:
  - `(tabs)/fixed-expenses.tsx` — header con period actual + card de progreso ("X de Y pagados" — ámbar pendiente / verde "Mes al día!"), FlatList con `FixedExpenseCard`, FAB de "+", empty state.
  - `fixed-expense/new.tsx` — modal de creación, moneda default desde `settings.currency`.
  - `fixed-expense/[id].tsx` — modal de edición + historial de pagos (lista de períodos pagados con fecha y monto) + botón Eliminar.
- **Tab "Fijos"** agregada al bottom nav con icono `Receipt`. Total tabs: 4 (Inicio · Ingresos · Fijos · Ajustes).
- **Modal stack** registrado en `app/_layout.tsx` para `fixed-expense/new` y `fixed-expense/[id]`.
- **Home dashboard** ahora tiene 3 cards: Ingresos (verde), Gastos fijos (azul, con "X de Y pagados este mes" + estado), Catálogo (gris).

### Verificaciones
- `npx tsc --noEmit`: 0 errores.
- `npm test`: **38/38** (lógica pura de incomes no se tocó).
- `npm run lint`: 0 warnings.
- `npx expo-doctor`: 17/17.

## [0.3.0] - 2026-05-13 — Fase 2.5: Ajustes configurables

### Added
- **Tab Ajustes** (`(tabs)/settings.tsx`) con dos controles:
  - **Slider de % de ahorro** (`@react-native-community/slider` 5.0.1, step=1, 0–100) con feedback en vivo mientras arrastrás y persistencia al soltar.
  - **Selector de moneda** (CRC / USD) con segmented control y símbolo grande tipo "tile" en cada opción.
- **Store global de settings** (`features/settings/store.ts`) — Zustand. Carga inicial idempotente desde DB, actions `setSavingsPercent`, `setCurrency`, `setTheme` que persisten + actualizan estado.
- **Hook `useFormatCents`** (`shared/hooks/useFormatCents.ts`) — devuelve un formateador atado a la moneda actual del store; los componentes que lo usan re-renderean al cambiar moneda. Hook `useCurrency()` como atajo.
- **Helpers de moneda** (`shared/utils/currency.ts`) — catálogo `SUPPORTED_CURRENCIES`, `currencySymbol(code)`, `currencyName(code)`, type guard `isSupportedCurrency`.
- **`updateSettings(patch)`** en `shared/db/index.ts` — UPDATE parcial transaccional.

### Cambios mínimos en componentes existentes
- `IncomeCard`, `OccurrencesList`, `OverrideAmountModal`: 2 líneas cada uno — `import { formatCents }` → `useFormatCents()`. Output idéntico cuando moneda=CRC, cambia a $ al elegir USD.
- `IncomeForm`: símbolo prefijo del input ahora viene de `currencySymbol(currency)`. Label "Monto" → "Monto en CRC" / "Monto en USD".
- `OverrideAmountModal`: ídem prefijo dinámico.
- Home dashboard: muestra `savings_percent` y `currency` del store (reactivos), no del estado local. Cambios en Ajustes se ven al volver a la tab Inicio sin recargar.

### Limitaciones consciente
- Cambiar moneda **NO convierte** los montos guardados. Un ingreso de ₡450.000 en CRC pasaría a verse como $450,000 si cambiás a USD. Hay una nota visible en la pantalla de Ajustes advirtiéndolo.
- Si en el futuro necesitás trackear ingresos mezclados en CRC y USD a la vez, hay que agregar `currency` por fila en `incomes` y `variable_expenses` (schema change → migración v2).

### Verificaciones
- `npx tsc --noEmit`: 0 errores.
- `npm test`: **38/38** (sin cambios — la lógica pura no se tocó).
- `npm run lint`: 0 warnings.
- `npx expo-doctor`: 17/17.

## [0.2.0] - 2026-05-13 — Fase 2: Ingresos

### Added
- **Generador de ocurrencias** (`features/incomes/occurrences.ts`) — función pura que proyecta ocurrencias para `one_time`, `biweekly` y `monthly` con ventana configurable (default 12 meses) y manejo correcto del clamp día 31 → último día del mes (sin drift en meses siguientes). **19 tests** cubriendo todos los casos borde: año bisiesto, end_date inclusive, end_date < start_date, regreso al día original tras clamp, etc.
- **Repositorio de ingresos** (`features/incomes/repository.ts`) — CRUD completo con transacciones: `createIncome` (inserta income + proyecta ocurrencias atómicamente), `listIncomes`, `getIncome`, `updateIncome`, `deleteIncome` (CASCADE elimina ocurrencias), `listOccurrences`, `setOccurrenceConfirmed`, `overrideOccurrenceAmount`. IDs generados con `expo-crypto.randomUUID()`.
- **Schemas zod** (`features/incomes/schemas.ts`) — validación de form (monto positivo, end_date ≥ start_date) y override de ocurrencia.
- **UI components**:
  - `IncomeForm` — react-hook-form + zod, con segmented control de frecuencia (Una vez / Quincenal / Mensual), date pickers nativos Android (`DateTimePickerAndroid`), input de monto con símbolo ₡, validación inline.
  - `IncomeCard` — tarjeta de listado con fuente, monto, frecuencia y rango de fechas.
  - `OccurrencesList` — fila por ocurrencia con checkbox de confirmación (verde brand) y monto tappable.
  - `OverrideAmountModal` — modal para sobre-escribir el monto de una ocurrencia individual con opción "Volver al monto base".
- **Pantallas (Expo Router)**:
  - `(tabs)/incomes.tsx` — listado con FAB flotante (verde brand, sombra elevada), empty state con CTA, refresh automático en focus.
  - `income/new.tsx` — modal de creación, mensaje contextual + aviso post-guardado con conteo de ocurrencias proyectadas.
  - `income/[id].tsx` — modal de edición con form + listado de ocurrencias + botón Eliminar (rojo, con confirmación de impacto). Modal de override en cada ocurrencia.
- **Tab Ingresos** agregada al bottom nav (icon `Wallet`).
- **Home dashboard** ahora muestra `N ingresos activos · N ocurrencias proyectadas`, refrescados en focus.

### Dependencias
- `expo-crypto` (~16.0.7) — para `randomUUID()` cross-platform.
- `@react-native-community/datetimepicker` — date picker nativo Android (plugin agregado a `app.json`).

### Cambios
- `app.json`: removido `experiments.typedRoutes: true`. El generator producía un type space ruidoso (incluía archivos de `features/` como rutas y omitía `/income/new`). Re-activable en Fase 7 cuando el routing esté estable.

### Verificaciones
- `npx tsc --noEmit`: 0 errores.
- `npm test`: **38/38 tests** (19 money + 19 occurrences).
- `npm run lint`: 0 warnings.
- `npx expo-doctor`: 17/17 checks.

## [0.1.0] - 2026-05-13 — Fase 1: Setup + DB

### Added
- Proyecto Expo SDK 54 con TypeScript strict (`noUncheckedIndexedAccess`, `noImplicitOverride`).
- Expo Router 6 (file-based, `src/app/`) con tab navigator.
- NativeWind 4 + Tailwind 3.4 (paleta `brand` inicial, sistema de spacing por múltiplos de 4).
- Cliente SQLite singleton (`expo-sqlite` async API) con WAL y foreign keys habilitados.
- Migrador versionado vía `PRAGMA user_version`, transacciones por migración.
- Migración inicial (v1) con las 8 tablas del spec: `settings`, `categories`, `incomes`, `income_occurrences`, `fixed_expenses`, `fixed_expense_payments`, `variable_expenses`, `monthly_snapshots` + índices.
- Seeds idempotentes: fila `settings` (savings_percent=20, CRC, theme=system) y 15 categorías iniciales (4 ingresos, 5 fijos, 6 variables) con IDs slug estables.
- Pantalla Home placeholder con estados `loading | ready | error` mostrando "DB inicializada — N categorías cargadas".
- Utilidad `money.ts` con `toCents`, `fromCents`, `formatCents`, `parseAmount` + suite completa de tests Jest.
- ESLint flat config (`eslint-config-expo` v55) + Prettier + `prettier-plugin-tailwindcss`.
- Jest con preset `jest-expo` y `transformIgnorePatterns` para nativewind/svg.
- Path alias `@/*` → `src/*`.
- Scripts npm: `start`, `android`, `lint`, `lint:fix`, `format`, `typecheck`, `test`, `test:watch`.

### Configurado
- `.npmrc` con `legacy-peer-deps=true` (Expo SDK 54 pinea React 19.1.0 mientras nativewind arrastra paquetes que esperan 19.2.x — conflicto inocuo en apps nativas).
- `app.json` con `scheme: myfinance`, `experiments.typedRoutes: true`, package Android `com.melvin.myfinance`. Bloque `ios` y `web` removidos (Android-only).

### Notas técnicas
- MMKV diferido a Fase 7 — usaremos `expo-secure-store` para preferencias mientras tanto (MMKV no corre en Expo Go).
- Generación de IDs aleatorios para nuevos registros se añade en Fase 2 (probablemente vía `expo-crypto` `randomUUID()`).
