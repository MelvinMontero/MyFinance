/**
 * Helpers de dinero.
 *
 * Regla de oro: todos los montos viven en la DB como ENTEROS de centavos
 * (Math.round, no truncado). Convertir a número decimal SOLO para mostrar.
 * Esto evita errores de coma flotante en sumas (0.1 + 0.2 !== 0.3).
 */

const DEFAULT_LOCALE = 'es-CR';
const DEFAULT_CURRENCY = 'CRC';

/** Convierte un monto decimal (₡123.45) a centavos enteros (12345). */
export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new Error(`Monto inválido: ${amount}`);
  }
  return Math.round(amount * 100);
}

/** Convierte centavos enteros (12345) a monto decimal (123.45). */
export function fromCents(cents: number): number {
  if (!Number.isFinite(cents)) {
    throw new Error(`Centavos inválidos: ${cents}`);
  }
  return cents / 100;
}

export interface FormatOptions {
  currency?: string;
  locale?: string;
  withSymbol?: boolean;
  maximumFractionDigits?: number;
}

/**
 * Formatea centavos como string legible.
 * Por defecto usa es-CR + CRC con símbolo (₡).
 */
export function formatCents(cents: number, options: FormatOptions = {}): string {
  const {
    currency = DEFAULT_CURRENCY,
    locale = DEFAULT_LOCALE,
    withSymbol = true,
    maximumFractionDigits = 2,
  } = options;

  const value = fromCents(cents);

  if (!withSymbol) {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits,
    }).format(value);
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

/**
 * Parsea un string de entrada del usuario a número decimal.
 * Tolera ambos separadores (es-CR usa coma decimal, en-US usa punto)
 * y separadores de miles. Útil para inputs sin máscara.
 *
 * Punto SIN coma es ambiguo ("1.500"): en es-CR el punto es separador de
 * miles. Regla: si cada grupo tras un punto tiene exactamente 3 dígitos y el
 * grupo inicial es 1–3 dígitos sin cero a la izquierda, se trata como MILES.
 *
 * Ejemplos:
 *   "1.234,56"  → 1234.56  (es-CR)
 *   "1,234.56"  → 1234.56  (en-US)
 *   "1.500"     → 1500     (miles es-CR — NO 1.5)
 *   "1.234.567" → 1234567  (miles es-CR)
 *   "1.50"      → 1.5      (grupo de 2 → decimal)
 *   "0.500"     → 0.5      (cero inicial → decimal)
 *   "1234"      → 1234
 *   "₡1.234,56" → 1234.56  (ignora símbolos)
 */
export function parseAmount(input: string): number {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new Error('Entrada vacía');
  }

  const cleaned = input.replace(/[^\d,.-]/g, '');
  if (cleaned.length === 0) {
    throw new Error(`Entrada sin dígitos: ${input}`);
  }

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalized: string;
  if (lastComma === -1 && lastDot === -1) {
    normalized = cleaned;
  } else if (lastComma > lastDot) {
    // coma es decimal, puntos son miles
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastComma !== -1) {
    // hay coma antes del punto → comas son miles, punto es decimal (en-US)
    normalized = cleaned.replace(/,/g, '');
  } else {
    // SOLO puntos: desambiguar miles es-CR vs decimal.
    const [head, ...groups] = cleaned.split('.');
    const headDigits = head?.replace('-', '') ?? '';
    const isThousands =
      groups.length > 0 &&
      headDigits.length >= 1 &&
      headDigits.length <= 3 &&
      !headDigits.startsWith('0') &&
      groups.every((g) => g.length === 3);
    normalized = isThousands ? cleaned.replace(/\./g, '') : cleaned;
  }

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Entrada inválida: ${input}`);
  }
  return parsed;
}
