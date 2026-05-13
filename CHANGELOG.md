# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) — fechas YYYY-MM-DD.

## [Unreleased]

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
