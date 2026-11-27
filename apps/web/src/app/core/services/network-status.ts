import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';

export const OFFLINE_ACTION_MESSAGE =
  'Conecte-se à internet novamente para habilitar todas as funções do app UTFRide novamente';

function readNavigatorOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

@Injectable({ providedIn: 'root' })
export class NetworkStatus {
  private readonly destroyRef = inject(DestroyRef);
  private readonly onlineState = signal(readNavigatorOnline());

  readonly isOnline = computed(() => this.onlineState());
  readonly isOffline = computed(() => !this.onlineState());

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    const handleOnline = (): void => this.onlineState.set(true);
    const handleOffline = (): void => this.onlineState.set(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    });
  }
}
