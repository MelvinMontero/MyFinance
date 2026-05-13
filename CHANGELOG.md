# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) — fechas YYYY-MM-DD.

## [Unreleased]

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
