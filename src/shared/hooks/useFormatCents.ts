import { useCallback } from 'react';

import { useSettings } from '@/features/settings/store';
import { formatCents as rawFormatCents, type FormatOptions } from '@/shared/utils/money';

/**
 * Hook que devuelve un formateador de centavos atado a la moneda actual
 * de los settings. Los componentes que lo usan re-renderean al cambiar la moneda.
 */
export function useFormatCents() {
  const currency = useSettings((s) => s.currency);
  return useCallback(
    (cents: number, options: Omit<FormatOptions, 'currency'> = {}) =>
      rawFormatCents(cents, { ...options, currency }),
    [currency],
  );
}

/** Atajo para acceder al código ISO de la moneda activa. */
export function useCurrency(): string {
  return useSettings((s) => s.currency);
}
