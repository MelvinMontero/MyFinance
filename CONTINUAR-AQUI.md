# 🚦 CONTINUAR AQUÍ — Estado del proyecto y cómo seguir

> **Leé este archivo primero** si abrís el repo en otra computadora o en un chat nuevo.
> Resume dónde quedó el progreso y cómo retomarlo sin perder contexto.
> Última actualización: **2026-06-01**.

---

## 1. ¿Qué es esto?

**MyFinance** — app móvil Android de finanzas personales, local-first (SQLite, sin login, sin nube). Stack: **Expo SDK 54 + React Native 0.81 + TypeScript strict + Expo Router 6 + NativeWind 4 + Zustand 5 + expo-sqlite**.

El contexto de dominio completo (modelo de sobres, convenciones, decisiones) está en [`CLAUDE.md`](./CLAUDE.md). **Ojo:** el `CLAUDE.md` dice "Fase 1" pero está desactualizado — el código real está en **v0.8.1 / Fase 7** (ver abajo).

---

## 2. Estado actual del CÓDIGO (lo que YA funciona — v0.8.1)

No tocar para entender; ya está implementado y probado:

- ✅ DB SQLite con migrador versionado (`PRAGMA user_version`) — **migración v3 aplicada**, 8 tablas.
- ✅ Ingresos: CRUD + proyección de ocurrencias (one_time / biweekly / monthly).
- ✅ Gastos fijos: CRUD con `due_day` + registro de pagos por período.
- ✅ Sobres (envelope budgeting): `calculateBuckets()` puro con 19 tests — **mensual**.
- ✅ Gastos variables (pantalla "Extras").
- ✅ Reportes (mensual + anual con gráficos).
- ✅ Polish Fase 7: onboarding, bloqueo biométrico, dark mode, notificaciones, backup JSON manual.
- ✅ 6 pestañas: Inicio, Ingresos, Fijos, Extras, Reportes, Ajustes.

---

## 3. Qué se hizo en ESTA sesión (planificación, sin tocar código de la app)

Se recibió un requerimiento del cliente para **ciclo quincenal real + módulo de metas de ahorro**. En esta sesión:

1. **Se analizó toda la base de código real** (no el `CLAUDE.md` desactualizado).
2. **Se escribió un plan de implementación completo y detallado** (TDD, tarea por tarea):
   👉 [`docs/plan/2026-06-01-quincenas-y-metas-de-ahorro.md`](./docs/plan/2026-06-01-quincenas-y-metas-de-ahorro.md)
3. **NO se modificó código de la app todavía.** El plan está listo para ejecutarse.

### Hallazgo clave del análisis
El toggle "Mensual / Quincenal" del Dashboard ([`src/app/(tabs)/index.tsx`](./src/app/(tabs)/index.tsx)) hoy es **cosmético**: solo divide los montos mensuales entre 2 (`Math.round(cents/2)`). **No** calcula qué gastos vencen en la quincena en curso. Ese es el corazón de lo que hay que implementar.

### Decisiones ya tomadas con el cliente (no volver a preguntar)
- **Quincena = período real.** Q1 = días 1–14, Q2 = días 15–fin de mes (el pago del 15 cubre del 15 al fin de mes). El mensual queda como vista resumen.
- **Sin sincronización en la nube.** Se mantiene el backup/restore JSON manual existente (coherente con local-first sin login).
- **Metas = nueva pestaña** (7ª, icono `Target`).

---

## 4. Qué falta hacer (resumen del plan)

El plan tiene **15 tareas en 7 fases** (~68 h estimadas). Resumen:

| Fase | Qué entrega |
|------|-------------|
| **A — DB y tipos** | Migración v4 (tablas `goals`, `goal_contributions`) y v5 (`payday_offset_days`, `notify_days_before`). |
| **B — Quincenas (TDD)** | Módulo puro `src/features/cycle/cycle.ts` (clasificar fecha en quincena, conteo de quincenas restantes). |
| **C — Sobres + presupuesto quincenal** | Extender `calculateBuckets` con sobre "Metas" (sin romper los 19 tests) + `src/features/budgets/quincena.ts` (cálculo real por quincena). |
| **D — Módulo Metas** | `goals/calc.ts` (cuota quincenal, TDD) + `goals/repository.ts` + `goals/schemas.ts`. |
| **E — Interfaz** | Dashboard quincenal real, pestaña Metas, alta/detalle de meta, colchón en Ajustes. |
| **F — Notificaciones** | Aviso configurable (2 días antes), colchón financiero, recordatorio día de pago. |
| **G — QA y cierre** | Suite completa, typecheck, lint, actualizar CHANGELOG y CLAUDE.md. |

> El detalle completo, con código y comandos para cada paso, está en el archivo del plan.

---

## 5. Cómo CONTINUAR en la otra computadora (paso a paso)

### 5.1. Requisito CRÍTICO de entorno — Node ≥ 20.19.4
> ⚠️ **Este proyecto NO corre con Node 18.** React Native 0.81 / Expo SDK 54 exigen **Node 20.19.4 o superior** (recomendado: Node 20 LTS o 22 LTS).
> Si `npm install` falla con `Cannot read properties of undefined (reading 'spec')` o ves warnings `EBADENGINE`, es que tu Node es muy viejo. Actualizá Node antes de seguir.
> (En la PC anterior, el Node de sistema era 18 y hubo que usar un Node 22 portátil.)

Verificá: `node -v` → debe decir v20.19.4+ o v22.x.

### 5.2. Setup
```bash
# desde la raíz del proyecto
npm install            # el .npmrc ya trae legacy-peer-deps=true
npm run typecheck      # debe dar 0 errores
npm test               # debe pasar (59 tests al día de hoy)
```

### 5.3. Correr la app en el teléfono
```bash
npm run start          # arranca Metro + QR  (correr SIEMPRE desde la raíz)
```
- Abrí **Expo Go** (Android) — debe estar actualizado a **SDK 54**.
- Escaneá el QR. El teléfono debe estar en la **misma Wi-Fi** que la PC.
- Si no conecta: ver "Problemas conocidos" abajo.

### 5.4. Ejecutar el plan (cuando vayas a codear)
El plan está pensado para ejecutarse **tarea por tarea con TDD**. Dos formas con Claude:
- **Subagent-driven** (recomendado): un subagente fresco por tarea, revisión entre tareas. Skill: `superpowers:subagent-driven-development`.
- **Inline**: ejecutar en la misma sesión por lotes con checkpoints. Skill: `superpowers:executing-plans`.

**Reglas del repo al codear** (de `CLAUDE.md`): montos en centavos `INTEGER`; fechas ISO `TEXT`; alias `@/*`; TS strict sin `any`; Conventional Commits; migraciones **inmutables** (solo sumar versión); tests obligatorios para `utils/`, `repository.ts` y cálculo de sobres.

---

## 6. Mensaje de arranque sugerido para el chat en la otra PC

> Pegá esto en el nuevo chat de Claude después de clonar el repo:

```
Estoy continuando el proyecto MyFinance. Lee CONTINUAR-AQUI.md y
docs/plan/2026-06-01-quincenas-y-metas-de-ahorro.md para tomar contexto.
El plan ya está aprobado y NO se ha implementado código todavía.
Quiero empezar a ejecutarlo con TDD, tarea por tarea (Fase A, Task 1).
Usa la skill subagent-driven-development. Antes, verifica que mi Node sea
>= 20.19.4 y corre npm install + npm run typecheck + npm test.
```

---

## 7. Problemas conocidos / gotchas

- **Node viejo** → ver 5.1. Es el problema #1.
- **El teléfono no conecta por Wi-Fi (LAN):** suele ser el **Firewall de Windows** bloqueando el puerto 8081, o el router con "aislamiento de clientes". Opciones:
  - Al correr `npm start`, si Windows muestra "Firewall bloqueó…", marcá **Redes privadas → Permitir acceso**.
  - O abrí el puerto (PowerShell como **administrador**):
    `New-NetFirewallRule -DisplayName "Expo Metro 8081" -Direction Inbound -Protocol TCP -LocalPort 8081 -Action Allow -Profile Any`
  - O usá **modo túnel**: `npx expo start --tunnel` (no depende de la red; instala `@expo/ngrok` la primera vez).
  - O **USB**: teléfono con Depuración USB + `adb reverse tcp:8081 tcp:8081` (a prueba de redes/firewall).
- **El servidor "deja de cargar":** asegurate de que la ventana de `npm start` siga **abierta**; si la cerrás, Metro muere.
- **Versiones de paquetes** (`expo install --check`) puede sugerir alinear algunas (`expo`, `expo-router`, etc.) — son avisos menores, no bloquean.

---

## 8. Mapa rápido de archivos relevantes

| Archivo | Rol |
|---------|-----|
| `CONTINUAR-AQUI.md` | **Este archivo** — estado y cómo seguir. |
| `docs/plan/2026-06-01-quincenas-y-metas-de-ahorro.md` | **El plan completo** a ejecutar. |
| `CLAUDE.md` | Contexto de dominio y convenciones (estado "Fase 1" desactualizado). |
| `CHANGELOG.md` | Historial real de fases (v0.8.1 = Fase 7). |
| `src/features/budgets/calculate.ts` | Cálculo de sobres (mensual) — se extiende en Fase C. |
| `src/app/(tabs)/index.tsx` | Dashboard con el toggle quincenal cosmético — se reescribe en Fase E. |
| `src/features/incomes/occurrences.ts` | Generación de ocurrencias de ingresos (referencia para quincenas). |
| `src/shared/db/migrations.ts` | Migraciones — sumar v4 y v5 acá. |
