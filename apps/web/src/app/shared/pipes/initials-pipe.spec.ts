import { describe, expect, it } from 'vitest';
import { InitialsPipe } from './initials-pipe';

describe('InitialsPipe', () => {
  const pipe = new InitialsPipe();

  it('extrai a primeira e a última inicial em maiúsculas para nomes compostos', () => {
    expect(pipe.transform('Mariana Silva')).toBe('MS');
    expect(pipe.transform('  Pedro   Henrique   Santos  ')).toBe('PS');
    expect(pipe.transform('ana beatriz')).toBe('AB');
  });

  it('retorna as duas primeiras letras em maiúsculas para nome simples', () => {
    expect(pipe.transform('Carlos')).toBe('CA');
    expect(pipe.transform('a')).toBe('A');
  });

  it('retorna fallback AL para valores vazios, nulos ou indefinidos', () => {
    expect(pipe.transform('')).toBe('AL');
    expect(pipe.transform('   ')).toBe('AL');
    expect(pipe.transform(null)).toBe('AL');
    expect(pipe.transform(undefined)).toBe('AL');
  });
});
