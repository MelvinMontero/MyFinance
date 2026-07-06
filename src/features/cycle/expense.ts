/**
 * Utilidades de fechas de cobro. FUNCIÓN PURA.
 *
 * Nota histórica: aquí vivía la amortización de gastos entre quincenas
 * (expenseProvision/monthlyExpenseProvision). Esa regla fue DEROGADA el
 * 2026-07-06: los gastos fijos ahora se reparten 50/50 entre las dos
 * quincenas del mes (ver features/budgets/quincena.ts).
 */
import { getDaysInMonth, startOfDay } from 'date-fns';

/**
 * Próxima ocurrencia de un día del mes (1–31) en o después de `from`.
 * Si el mes no tiene ese día (ej. 31 en febrero), clampa al último día.
 */
export function nextMonthlyDue(from: Date, dueDay: number): Date {
  const y = from.getFullYear();
  const m = from.getMonth();
  const dimThis = getDaysInMonth(new Date(y, m, 1));
  const candidate = new Date(y, m, Math.min(dueDay, dimThis));
  if (candidate >= startOfDay(from)) return candidate;
  const dimNext = getDaysInMonth(new Date(y, m + 1, 1));
  return new Date(y, m + 1, Math.min(dueDay, dimNext));
}
