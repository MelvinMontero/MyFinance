import { convertCents } from './exchange';

describe('convertCents — conversión aproximada CRC/USD', () => {
  it('USD → CRC multiplica por la tasa ($1 = 100 cents → ₡510 = 51000 cents)', () => {
    expect(convertCents(100, 'USD', 'CRC', 510)).toBe(51000);
  });

  it('CRC → USD divide por la tasa', () => {
    expect(convertCents(51000, 'CRC', 'USD', 510)).toBe(100);
  });

  it('misma moneda no convierte', () => {
    expect(convertCents(12345, 'CRC', 'CRC', 510)).toBe(12345);
    expect(convertCents(999, 'USD', 'USD', 510)).toBe(999);
  });

  it('redondea a centavos enteros', () => {
    expect(convertCents(100, 'USD', 'CRC', 510.5)).toBe(51050);
    expect(convertCents(101, 'USD', 'CRC', 510)).toBe(Math.round(101 * 510));
  });

  it('monedas no soportadas: devuelve el monto sin convertir', () => {
    expect(convertCents(100, 'EUR', 'CRC', 510)).toBe(100);
  });
});
