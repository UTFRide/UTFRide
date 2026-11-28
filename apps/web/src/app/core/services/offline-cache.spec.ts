import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineCache } from './offline-cache';

describe('OfflineCache', () => {
  let cache: OfflineCache;

  beforeEach(() => {
    localStorage.clear();
    cache = TestBed.inject(OfflineCache);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('grava, lê e remove dados compartilhados em localStorage', () => {
    const cities = ['Curitiba', 'Ponta Grossa'];

    cache.set('locations', cities);
    expect(cache.get<string[]>('locations')).toEqual(cities);

    cache.remove('locations');
    expect(cache.get<string[]>('locations')).toBeNull();
  });

  it('isola dados privados por userId e impede vazamento entre contas', () => {
    cache.setUserItem('user-1', 'rides', [{ id: 'ride-1' }]);
    cache.setUserItem('user-2', 'rides', [{ id: 'ride-2' }]);

    expect(cache.getUserItem<{ id: string }[]>('user-1', 'rides')).toEqual([{ id: 'ride-1' }]);
    expect(cache.getUserItem<{ id: string }[]>('user-2', 'rides')).toEqual([{ id: 'ride-2' }]);
    expect(cache.getUserItem<{ id: string }[]>('user-3', 'rides')).toBeNull();

    cache.setUserItem('', 'rides', [{ id: 'leak' }]);
    expect(cache.getUserItem<{ id: string }[]>('', 'rides')).toBeNull();
  });

  it('clearUser remove apenas os dados do usuário informado preservando outros usuários e cache compartilhado', () => {
    cache.set('locations', ['Curitiba']);
    cache.setUserItem('user-1', 'profile', { name: 'Ana' });
    cache.setUserItem('user-1', 'rides', [{ id: 'ride-1' }]);
    cache.setUserItem('user-2', 'profile', { name: 'Bruno' });

    cache.clearUser('user-1');

    expect(cache.getUserItem('user-1', 'profile')).toBeNull();
    expect(cache.getUserItem('user-1', 'rides')).toBeNull();
    expect(cache.getUserItem('user-2', 'profile')).toEqual({ name: 'Bruno' });
    expect(cache.get<string[]>('locations')).toEqual(['Curitiba']);
  });

  it('clearAllUsers remove caches privados de todas as contas preservando caches compartilhados', () => {
    cache.set('locations', ['Curitiba']);
    cache.setUserItem('user-1', 'profile', { name: 'Ana' });
    cache.setUserItem('user-2', 'rides', [{ id: 'ride-2' }]);

    cache.clearAllUsers();

    expect(cache.getUserItem('user-1', 'profile')).toBeNull();
    expect(cache.getUserItem('user-2', 'rides')).toBeNull();
    expect(cache.get<string[]>('locations')).toEqual(['Curitiba']);
  });

  it('retorna null sem lançar erro quando o JSON salvo está corrompido', () => {
    cache.setUserItem('user-1', 'profile', { name: 'Ana' });
    const storedKey = localStorage.key(0);
    expect(storedKey).not.toBeNull();
    localStorage.setItem(storedKey!, '{json-invalido');

    expect(() => cache.getUserItem('user-1', 'profile')).not.toThrow();
    expect(cache.getUserItem('user-1', 'profile')).toBeNull();
  });

  it('não lança erro quando localStorage está indisponível ou falha na gravação', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(() => cache.set('locations', ['Curitiba'])).not.toThrow();
    expect(() => cache.setUserItem('user-1', 'profile', { name: 'Ana' })).not.toThrow();
    expect(cache.get('locations')).toBeNull();
    expect(cache.getUserItem('user-1', 'profile')).toBeNull();
    expect(() => cache.remove('locations')).not.toThrow();
    expect(() => cache.removeUserItem('user-1', 'profile')).not.toThrow();
    expect(() => cache.clearUser('user-1')).not.toThrow();
    expect(() => cache.clearAllUsers()).not.toThrow();
  });
});
