import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NetworkStatus, OFFLINE_ACTION_MESSAGE } from './network-status';

describe('NetworkStatus', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('expõe estado online inicial quando navigator.onLine é verdadeiro', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);

    const service = TestBed.inject(NetworkStatus);

    expect(service.isOnline()).toBe(true);
    expect(service.isOffline()).toBe(false);
    expect(OFFLINE_ACTION_MESSAGE).toBe(
      'Conecte-se à internet novamente para habilitar todas as funções do app UTFRide novamente',
    );
  });

  it('inicializa como offline quando navigator.onLine é falso', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    const service = TestBed.inject(NetworkStatus);

    expect(service.isOnline()).toBe(false);
    expect(service.isOffline()).toBe(true);
  });

  it('atualiza reativamente ao disparar eventos offline e online no window', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const service = TestBed.inject(NetworkStatus);

    window.dispatchEvent(new Event('offline'));
    expect(service.isOffline()).toBe(true);
    expect(service.isOnline()).toBe(false);

    window.dispatchEvent(new Event('online'));
    expect(service.isOnline()).toBe(true);
    expect(service.isOffline()).toBe(false);
  });

  it('remove os listeners de online e offline ao destruir o serviço', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    TestBed.inject(NetworkStatus);

    const addedEvents = addSpy.mock.calls.map(([eventName]) => eventName);
    expect(addedEvents).toContain('online');
    expect(addedEvents).toContain('offline');

    TestBed.resetTestingModule();

    const removedEvents = removeSpy.mock.calls.map(([eventName]) => eventName);
    expect(removedEvents).toContain('online');
    expect(removedEvents).toContain('offline');
  });
});
