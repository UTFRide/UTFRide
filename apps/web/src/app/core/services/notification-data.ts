import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  catchError,
  forkJoin,
  map,
  Observable,
  of,
  startWith,
  Subject,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { Notification } from '../models/notification.model';
import { Ride } from '../models/ride.model';
import { AuthData, AuthenticatedUser } from './auth-data';
import { ErrorNotice } from './error-notice';
import { NetworkStatus } from './network-status';
import { OfflineCache } from './offline-cache';
import {
  mapNotificationRow,
  NotificationRow,
  SUPABASE_SINGLE_OBJECT_HEADERS,
  supabaseRestUrl,
} from './supabase-rest';

export type LoadNotificationsResult =
  | { notifications: Notification[] }
  | { unauthorized: true }
  | { connectionError: true }
  | { requestError: true };

const NOTIFICATIONS_CACHE_KEY = 'notifications';

@Injectable({ providedIn: 'root' })
export class NotificationData {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthData);
  private readonly notice = inject(ErrorNotice);
  private readonly network = inject(NetworkStatus);
  private readonly cache = inject(OfflineCache);
  private readonly loads = new Subject<void>();
  private readonly resets = new Subject<void>();
  private readonly notificationsState = signal<Notification[]>([]);
  private readonly lastLoadUserId = signal<string | null>(null);

  readonly notifications = computed<Notification[]>(() => this.notificationsState());

  readonly userNotifications = computed<Notification[]>(() => {
    const user = this.auth.currentUser();
    if (!user) {
      return [];
    }
    return this.notificationsState().filter((notification) =>
      this.isRecipient(notification, user),
    );
  });

  readonly loadResult = toSignal<LoadNotificationsResult | undefined>(
    this.resets.pipe(
      startWith(undefined),
      switchMap(() =>
        this.loads.pipe(
          switchMap(() => {
            const user = this.auth.currentUser();
            if (!user) {
              this.notificationsState.set([]);
              return of({ unauthorized: true as const });
            }

            if (this.network.isOffline()) {
              const cached = this.readCachedNotifications(user.id);
              if (cached !== null) {
                const filtered = cached.filter((notification) =>
                  this.isRecipient(notification, user),
                );
                this.notificationsState.set(filtered);
                return of({ notifications: filtered });
              }
              this.notificationsState.set([]);
              return of({ connectionError: true as const });
            }

            return this.http
              .get<NotificationRow[]>(supabaseRestUrl('notifications'), {
                params: { recipient_id: `eq.${user.id}` },
              })
              .pipe(
                map((items) =>
                  items
                    .map(mapNotificationRow)
                    .filter((notification) => this.isRecipient(notification, user)),
                ),
                tap((items) => {
                  this.notificationsState.set(items);
                  if (user.id === this.auth.currentUser()?.id) {
                    this.saveCachedNotifications(user.id, items);
                  }
                }),
                map((notifications) => ({ notifications })),
                catchError((error: unknown) => {
                  this.notificationsState.set([]);
                  return of(this.mapLoadError(error));
                }),
                startWith(undefined),
              );
          }),
          startWith(undefined),
        ),
      ),
    ),
  );

  readonly loadError = computed<string | null>(() => {
    const user = this.auth.currentUser();
    if (!user || this.lastLoadUserId() !== user.id) {
      return null;
    }
    const result = this.loadResult();
    if (!result) {
      return null;
    }
    if ('connectionError' in result) {
      return 'Falha de conexão ao carregar avisos. Verifique sua internet e tente novamente.';
    }
    if ('requestError' in result) {
      return 'Não foi possível carregar os avisos. Tente novamente.';
    }
    return null;
  });

  loadForCurrentUser(): void {
    this.notice.message.set('');
    this.notificationsState.set([]);
    const user = this.auth.currentUser();
    this.lastLoadUserId.set(user?.id ?? null);
    this.loads.next();
  }

  createCancellationNotifications$(
    ride: Ride,
    recipientIds: readonly string[],
  ): Observable<Notification[]> {
    const uniqueRecipients = [
      ...new Set(recipientIds.map((id) => id.trim()).filter((id) => id.length > 0)),
    ];
    if (uniqueRecipients.length === 0) {
      return of([]);
    }
    if (this.network.isOffline()) {
      return throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Offline' }));
    }

    const createdAt = new Date().toISOString();
    const message = `A carona ${ride.origin} → ${ride.destination} foi cancelada pelo motorista.`;

    return forkJoin(
      uniqueRecipients.map((recipientId) =>
        this.http
          .post<NotificationRow>(
            supabaseRestUrl('notifications'),
            {
              recipient_id: recipientId,
              ride_id: ride.id,
              message,
              created_at: createdAt,
            },
            { headers: SUPABASE_SINGLE_OBJECT_HEADERS },
          )
          .pipe(map(mapNotificationRow)),
      ),
    ).pipe(
      tap((created) => this.notificationsState.update((items) => [...items, ...created])),
    );
  }

  reset(): void {
    this.notificationsState.set([]);
    this.lastLoadUserId.set(null);
    this.resets.next();
  }

  private readCachedNotifications(userId: string): Notification[] | null {
    const cached = this.cache.getUserItem<unknown>(userId, NOTIFICATIONS_CACHE_KEY);
    return Array.isArray(cached) ? (cached as Notification[]) : null;
  }

  private saveCachedNotifications(userId: string, notifications: Notification[]): void {
    this.cache.setUserItem(userId, NOTIFICATIONS_CACHE_KEY, notifications);
  }

  private mapLoadError(error: unknown): LoadNotificationsResult {
    if (!(error instanceof HttpErrorResponse)) {
      this.notice.message.set('Falha inesperada. Tente novamente.');
      return { requestError: true };
    }
    if (error.status === 0) {
      this.notice.message.set('Falha de conexão. Verifique sua internet e tente novamente.');
      return { connectionError: true };
    }
    return { requestError: true };
  }

  private isRecipient(notification: Notification, user: AuthenticatedUser): boolean {
    const recipient = notification.recipientId.trim();
    if (recipient.length === 0) {
      return false;
    }
    return recipient === user.id.trim() || recipient === user.name.trim();
  }
}
