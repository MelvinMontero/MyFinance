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

  it('trata punto + grupo de 3 dígitos como MILES es-CR (bug "1.500" → ₡1,50)', () => {
    expect(parseAmount('1.500')).toBe(1500);
    expect(parseAmount('12.500')).toBe(12500);
    expect(parseAmount('180.000')).toBe(180000);
    expect(parseAmount('1.234.567')).toBe(1234567);
    expect(parseAmount('₡1.500')).toBe(1500);
  });

  it('punto con grupo distinto de 3 dígitos sigue siendo decimal', () => {
    expect(parseAmount('1.5')).toBe(1.5);
    expect(parseAmount('1.50')).toBe(1.5);
    expect(parseAmount('10.25')).toBe(10.25);
  });

  it('cero inicial fuerza decimal aunque el grupo tenga 3 dígitos', () => {
    expect(parseAmount('0.500')).toBe(0.5);
  });

  it('grupo inicial de más de 3 dígitos sigue siendo decimal', () => {
    expect(parseAmount('1234.567')).toBe(1234.567);
  });

  it('miles con coma decimal no se ven afectados', () => {
    expect(parseAmount('1.500,50')).toBe(1500.5);
  });

  it('maneja negativos con miles', () => {
    expect(parseAmount('-1.500')).toBe(-1500);
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
