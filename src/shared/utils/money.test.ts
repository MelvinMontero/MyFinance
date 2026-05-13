import { formatCents, fromCents, parseAmount, toCents } from './money';

describe('toCents', () => {
  it('convierte pesos a centavos', () => {
    expect(toCents(10)).toBe(1000);
    expect(toCents(10.5)).toBe(1050);
    expect(toCents(123.45)).toBe(12345);
  });

  it('redondea half-up', () => {
    expect(toCents(10.005)).toBe(1001);
    expect(toCents(10.004)).toBe(1000);
  });

  it('maneja cero y negativos', () => {
    expect(toCents(0)).toBe(0);
    expect(toCents(-10.5)).toBe(-1050);
  });

  it('lanza error en NaN/Infinity', () => {
    expect(() => toCents(NaN)).toThrow();
    expect(() => toCents(Infinity)).toThrow();
  });
});

describe('fromCents', () => {
  it('convierte centavos a pesos', () => {
    expect(fromCents(1000)).toBe(10);
    expect(fromCents(1050)).toBe(10.5);
    expect(fromCents(12345)).toBe(123.45);
  });

  it('maneja cero y negativos', () => {
    expect(fromCents(0)).toBe(0);
    expect(fromCents(-1050)).toBe(-10.5);
  });

  it('lanza error en valores no finitos', () => {
    expect(() => fromCents(NaN)).toThrow();
  });
});

describe('formatCents', () => {
  it('formatea CRC con símbolo en es-CR', () => {
    const result = formatCents(123456, { currency: 'CRC', locale: 'es-CR' });
    expect(result).toContain('₡');
    // ICU para es-CR usa espacio (NBSP) como separador de miles. Aceptamos cualquier no-dígito.
    expect(result).toMatch(/1\D?234/);
    expect(result).toMatch(/56/);
  });

  it('formatea sin símbolo', () => {
    const result = formatCents(123456, { withSymbol: false, locale: 'es-CR' });
    expect(result).not.toContain('₡');
    expect(result).toMatch(/1\D?234/);
    expect(result).toMatch(/56/);
  });

  it('formatea cero', () => {
    const result = formatCents(0, { currency: 'CRC', locale: 'es-CR' });
    expect(result).toContain('0');
  });

  it('respeta maximumFractionDigits', () => {
    const result = formatCents(12345, {
      withSymbol: false,
      locale: 'en-US',
      maximumFractionDigits: 0,
    });
    expect(result).toMatch(/^123$/);
  });
});

describe('parseAmount', () => {
  it('parsea decimales con punto', () => {
    expect(parseAmount('1234.56')).toBe(1234.56);
  });

  it('parsea decimales con coma (estilo es-CR)', () => {
    expect(parseAmount('1234,56')).toBe(1234.56);
  });

  it('parsea con separadores de miles estilo es-CR (1.234,56)', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56);
  });

  it('parsea con separadores de miles estilo en-US (1,234.56)', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56);
  });

  it('ignora símbolos de moneda', () => {
    expect(parseAmount('₡1.234,56')).toBe(1234.56);
    expect(parseAmount('$1,234.56')).toBe(1234.56);
  });

  it('parsea enteros sin separadores', () => {
    expect(parseAmount('1234')).toBe(1234);
  });

  it('lanza error en entrada vacía o sin dígitos', () => {
    expect(() => parseAmount('')).toThrow();
    expect(() => parseAmount('   ')).toThrow();
    expect(() => parseAmount('abc')).toThrow();
  });
});

describe('roundtrip toCents → fromCents', () => {
  it('es lossless para 2 decimales', () => {
    const values = [0, 1, 10.5, 123.45, 9999.99, -50.25];
    for (const v of values) {
      expect(fromCents(toCents(v))).toBe(v);
    }
  });
});
