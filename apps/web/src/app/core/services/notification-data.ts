import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { forkJoin, Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Notification } from '../models/notification.model';
import { Ride } from '../models/ride.model';

@Injectable({ providedIn: 'root' })
export class NotificationData {
  private readonly http = inject(HttpClient);
  private readonly notificationsState = signal<Notification[]>([]);

  readonly notifications = computed(() => this.notificationsState());

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

    const createdAt = new Date().toISOString();
    const message = `A carona ${ride.origin} → ${ride.destination} foi cancelada pelo motorista.`;

    return forkJoin(
      uniqueRecipients.map((recipientId) =>
        this.http.post<Notification>(`${environment.apiUrl}/notifications`, {
          recipientId,
          rideId: ride.id,
          message,
          createdAt,
        }),
      ),
    ).pipe(
      tap((created) => this.notificationsState.update((items) => [...items, ...created])),
    );
  }

  reset(): void {
    this.notificationsState.set([]);
  }
}
