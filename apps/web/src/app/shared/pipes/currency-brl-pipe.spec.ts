import { describe, expect, it } from 'vitest';
import { CurrencyBrlPipe } from './currency-brl-pipe';

describe('CurrencyBrlPipe', () => {
  const pipe = new CurrencyBrlPipe();

  it('formata zero e valores decimais em reais brasileiros (BRL)', () => {
    expect(pipe.transform(0)).toBe('R$ 0,00');
    expect(pipe.transform(8)).toBe('R$ 8,00');
    expect(pipe.transform(8.5)).toBe('R$ 8,50');
    expect(pipe.transform(1234.5)).toBe('R$ 1.234,50');
  });

  it('retorna string vazia para valores nulos ou indefinidos', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});
