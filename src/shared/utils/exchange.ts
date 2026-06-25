/**
 * Conversión APROXIMADA de moneda usando una tasa ₡ por $1 (CRC por USD),
 * configurable en Ajustes. Solo CRC ↔ USD; otras monedas no se convierten.
 *
 * Trabaja en centavos enteros: la escala (×100) es la misma en ambas monedas,
 * así que multiplicar/dividir los centavos por la tasa da los centavos destino.
 */
export function convertCents(
  amountCents: number,
  from: string,
  to: string,
  crcPerUsd: number,
): number {
  if (from === to) return amountCents;
  if (from === 'USD' && to === 'CRC') return Math.round(amountCents * crcPerUsd);
  if (from === 'CRC' && to === 'USD') return Math.round(amountCents / crcPerUsd);
  return amountCents;
}
