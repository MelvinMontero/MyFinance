/**
 * Catálogo de monedas soportadas por la app.
 * Para añadir más, sumá la entrada en SUPPORTED_CURRENCIES + símbolo + nombre.
 */

export const SUPPORTED_CURRENCIES = ['CRC', 'USD'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

const SYMBOLS: Record<SupportedCurrency, string> = {
  CRC: '₡',
  USD: '$',
};

const NAMES: Record<SupportedCurrency, string> = {
  CRC: 'Colones (CRC)',
  USD: 'Dólares (USD)',
};

export function currencySymbol(currency: string): string {
  return (SYMBOLS as Record<string, string>)[currency] ?? currency;
}

export function currencyName(currency: string): string {
  return (NAMES as Record<string, string>)[currency] ?? currency;
}

export function isSupportedCurrency(c: string): c is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(c);
}
