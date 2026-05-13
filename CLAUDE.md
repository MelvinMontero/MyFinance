# CLAUDE.md — MyFinance

> Este archivo es contexto persistente para Claude Code. Cuando abrás una nueva sesión de Claude Code en esta carpeta, este archivo se carga automáticamente.

## ¿Qué es MyFinance?

App móvil **Android** de finanzas personales **local-first**. Sin login, sin cloud, sin tracking — todos los datos viven en SQLite dentro del sandbox de la app.

- **Idioma de UI:** Español con tildes (arquitectura lista para multi-idioma).
- **Moneda default:** CRC (Costa Rica).
- **Usuario:** El dueño del proyecto (no se distribuye).

## Modelo mental: sobres (envelope budgeting)

Cada mes el ingreso se reparte automáticamente en **3 sobres**:

```
INGRESO DEL MES
    │
    ├──► 🏦 AHORRO         (X% configurable, default 20%)
    ├──► 📌 GASTOS FIJOS   (Σ fixed_expenses activos)
    └──► 💸 DINERO LIBRE   (resto — de aquí salen los gastos variables)
```

### Algoritmo (lo crítico):

```
ahorro          = ingreso_total_mes × savings_percent
gastos_fijos    = Σ(fixed_expenses activos del mes)
dinero_libre    = ingreso_total_mes − ahorro − gastos_fijos
```

**Casos borde a manejar siempre:**
- Si `dinero_libre < 0`: alerta clara + sugerir reducir % de ahorro o revisar fijos.
- Si llega ingreso extra mid-month: recalcular sobres sin romper lo ya gastado.
- Ingreso quincenal: 2 ocurrencias/mes; mensual: 1; one-time: solo su fecha.

### Tipos de movimiento

| Tipo | Ejemplo | Sobre afectado |
|------|---------|----------------|
| Ingreso recurrente | Sueldo quincenal | Alimenta los 3 sobres |
| Ingreso extra | Bono, freelance | Alimenta los 3 sobres |
| Gasto fijo | Renta, internet | Descuenta del sobre Fijos |
| Gasto variable | Café, cine | Descuenta del sobre Dinero Libre |
| Aporte a ahorro | Transferencia | Confirma uso del sobre Ahorro |

## Stack técnico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Expo SDK | 54.0.33 |
| Lenguaje | TypeScript | 5.9.x (strict + noUncheckedIndexedAccess) |
| Runtime | React / React Native | 19.1.0 / 0.81.5 |
| Navegación | Expo Router | 6 (file-based, `src/app/`) |
| Estilos | NativeWind | 4 (Tailwind 3.4 preset) |
| Estado | Zustand | 5 |
| Persistencia datos | expo-sqlite | async API (`openDatabaseAsync`) |
| Persistencia prefs | expo-secure-store | (MMKV diferido a Fase 7) |
| Formularios | react-hook-form + zod | |
| Gráficos | react-native-gifted-charts | (line, bar, pie, stack en una lib) |
| Fechas | date-fns | 4 |
| Iconos | lucide-react-native + react-native-svg | |
| i18n | i18next + expo-localization | |
| Testing | Jest 29 + jest-expo + @testing-library/react-native | |
| Linting | ESLint 9 flat + eslint-config-expo + Prettier | |

**NO usar:** Redux, Firebase, AsyncStorage para datos transaccionales, librerías de UI pesadas.

## Estructura

```
myfinance/
├── src/
│   ├── app/                          # Expo Router (file-based routing)
│   │   ├── _layout.tsx               # Root layout (gesture handler, safe area, status bar)
│   │   └── (tabs)/                   # Tab navigator
│   │       ├── _layout.tsx
│   │       └── index.tsx             # Dashboard / Home
│   ├── features/                     # Lógica por dominio
│   │   ├── incomes/
│   │   ├── fixed-expenses/
│   │   ├── variable-expenses/
│   │   ├── budgets/                  # Cálculo de sobres
│   │   ├── reports/                  # Agregaciones para gráficos
│   │   └── categories/
│   ├── shared/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── utils/
│   │   │   └── money.ts              # toCents, fromCents, formatCents, parseAmount
│   │   ├── theme/
│   │   └── db/
│   │       ├── client.ts             # singleton getDb()
│   │       ├── migrator.ts           # PRAGMA user_version + tx
│   │       ├── migrations.ts         # array versionado
│   │       ├── types.ts              # tipos TS del schema
│   │       ├── index.ts              # initDb(), getCategoryCount(), getSettings()
│   │       └── seeds/
│   │           ├── categories.ts     # 15 categorías iniciales
│   │           └── settings.ts       # fila id=1 con savings=20%, CRC
│   ├── locales/
│   └── types/
├── global.css                        # Tailwind directives
├── nativewind-env.d.ts
├── tailwind.config.js
├── babel.config.js                   # nativewind + react-native-worklets
├── metro.config.js                   # withNativeWind
├── eslint.config.js                  # flat config
├── .prettierrc
├── .npmrc                            # legacy-peer-deps=true
├── app.json                          # scheme: myfinance, Android-only
├── tsconfig.json                     # strict + paths @/* → src/*
├── package.json
├── CHANGELOG.md
└── CLAUDE.md (este archivo)
```

**Patrón:** las pantallas NO tocan SQLite directo — usan `repository.ts` por feature (a implementarse en Fase 2+).

## Cómo compilar y correr

```bash
# Desarrollo
npm run start            # arranca Metro bundler con QR
npm run android          # abre en emulador/dispositivo Android

# Calidad
npm run typecheck        # tsc --noEmit
npm run lint             # ESLint
npm run lint:fix         # auto-fix
npm run format           # Prettier
npm test                 # Jest una vez
npm run test:watch       # Jest watch mode
```

**Para correr en dispositivo Android:**
1. Instalar **Expo Go** desde Play Store.
2. `npm run start` y escanear el QR.
3. (Alternativa: emulador en Android Studio.)

## Estado actual — v0.1.0 (Fase 1)

✅ **Fase 1 completa — Setup + DB.** Ver [CHANGELOG.md](./CHANGELOG.md) para detalle.

- Expo SDK 54 + TS strict + Expo Router 6 + NativeWind 4.
- SQLite con migrador versionado y 8 tablas del schema final.
- Seeds idempotentes: 15 categorías + settings (savings_percent=20, CRC).
- Pantalla Home placeholder con estados loading/ready/error.
- Money utility cubierta con 19 tests (toCents, fromCents, formatCents, parseAmount).
- expo-doctor: 17/17 checks OK.

## Fases pendientes

- **Fase 2 — Ingresos**: CRUD + frecuencia (one_time, biweekly, monthly), proyección 12 meses, confirmar ocurrencias.
- **Fase 3 — Gastos fijos**: CRUD con día de pago + registro de pagos por período.
- **Fase 4 — Cálculo de sobres** (LA MÁS CRÍTICA — TDD obligatorio): `calculateBuckets(period)` + slider de % ahorro + Dashboard con 3 sobres.
- **Fase 5 — Gastos variables**: FAB de "+", swipe edit/delete, indicador "te quedan ₡X esta semana".
- **Fase 6 — Reportes**: Pestaña mensual (donut, barras, top categorías) + Anual (stacked bars, línea de tendencia, KPIs).
- **Fase 7 — Polish**: Tema claro/oscuro, biometría, backup JSON cifrado con PIN, onboarding, notificaciones.

## Decisiones de diseño importantes

1. **Centavos como INTEGER** — todo monto se guarda como `INTEGER` de centavos. Evita errores de coma flotante. Usar `toCents`/`fromCents` para convertir.
2. **Fechas ISO 8601 TEXT** — todas las fechas se guardan como `TEXT` ISO. Usar `date-fns` para manipular.
3. **IDs string** — `cat-income-salary` para seeds (slugs estables), UUID para registros del usuario (a partir de Fase 2 — usar `expo-crypto.randomUUID()`).
4. **`legacy-peer-deps=true`** en `.npmrc` — Expo SDK 54 pinea React 19.1.0 mientras NativeWind arrastra paquetes que esperan 19.2.x. Es inocuo en una app nativa (sin DOM).
5. **MMKV diferido** — la spec original pide MMKV pero no corre en Expo Go. Hasta Fase 7 usamos `expo-secure-store`.
6. **Android-only** — `app.json` no tiene bloque iOS ni web. Si en el futuro se quiere iOS, restaurar el bloque.
7. **Migraciones inmutables** — una vez publicada, JAMÁS modificar una migración existente. Sumar siempre `version + 1`.
8. **Seeds idempotentes** — `seedCategories` y `seedSettings` chequean si ya hay datos antes de insertar. Respetan ediciones del usuario.

## Estándares de código

- **TypeScript strict** + `noUncheckedIndexedAccess` (acceder a `arr[0]` da `T | undefined`).
- **Cero `any`** — usar `unknown` y refinar.
- **Path alias `@/*`** → `src/*` (en imports usar `@/shared/db` no `../../shared/db`).
- **Conventional Commits** — `feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`.
- **UI strings en español con tildes** — directo en código por ahora, vía i18n cuando arranquemos Fase multi-idioma.
- **Code en inglés** — comentarios pueden ser en español, identificadores en inglés.
- **Tests obligatorios para:** `shared/utils/*`, `features/*/repository.ts`, y especialmente la Fase 4 (cálculo de sobres — TDD).

## UI/UX (recordatorio para futuras pantallas)

- **Hero numbers**: los montos importantes deben ser GRANDES (mínimo `text-3xl`), legibles a 1 metro.
- **Color con intención**: verde solo para ingresos/saludable, rojo solo para alertas reales (sobregiro), neutros para el resto.
- **Spacing**: múltiplos de 4 (4, 8, 12, 16, 24, 32, 48, 64).
- **Empty states**: ilustración + CTA siempre.
- **Confirmación** en toda acción destructiva.
- **Accesibilidad**: `accessibilityLabel` en todo táctil, contraste AA mínimo.
- **Háptica sutil** al confirmar acciones (Expo Haptics).

## Cómo trabajar con Claude

- Lee este archivo entero antes de codear nada nuevo.
- Una fase a la vez. Al terminar una, detenerse y resumir.
- Si una decisión técnica no está aquí, proponer 2 opciones con pros/contras antes de elegir.
- Si algo aquí contradice una mejor práctica conocida, decirlo en vez de seguir ciegamente.
- Commits pequeños y descriptivos.
- Actualizar CHANGELOG.md al final de cada fase.
- **Fase 4** (cálculo de sobres): TDD obligatorio — tests primero.

## Referencias

- Expo docs: https://docs.expo.dev/
- Expo Router: https://docs.expo.dev/router/introduction/
- NativeWind v4: https://www.nativewind.dev/
- gifted-charts: https://gifted-charts.web.app/
- Inspiración: Goodbudget (sobres), EveryDollar (zero-based), PocketGuard ("in my pocket"), YNAB (forecasting).
