import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, exhaustMap, map, of, startWith, Subject, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Ride, RideDraft } from '../models/ride.model';
import { AuthData } from './auth-data';
import { ErrorNotice } from './error-notice';

export type PublishRideResult =
  | { ride: Ride }
  | { unauthorized: true }
  | { connectionError: true }
  | { requestError: true };

@Injectable({ providedIn: 'root' })
export class RideData {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthData);
  private readonly notice = inject(ErrorNotice);
  private readonly publishSubmissions = new Subject<RideDraft>();
  private readonly publishResets = new Subject<void>();

  readonly publishResult = toSignal(
    this.publishResets.pipe(
      startWith(undefined),
      switchMap(() =>
        this.publishSubmissions.pipe(
          exhaustMap((draft) => {
            const driver = this.auth.currentUser();
            if (!driver || driver.isBlocked) {
              return of({ unauthorized: true as const });
            }

            const notes = draft.notes?.trim();
            const body = {
              driverId: driver.id,
              origin: draft.origin.trim(),
              destination: draft.destination.trim(),
              departureTime: draft.departureTime,
              totalSeats: draft.totalSeats,
              availableSeats: draft.totalSeats,
              pricePerSeat: draft.pricePerSeat,
              status: 'active' as const,
              createdAt: new Date().toISOString(),
              ...(notes ? { notes } : {}),
            };

            return this.http.post<Ride>(`${environment.apiUrl}/rides`, body).pipe(
              map((ride) => ({ ride })),
              catchError((error: unknown) => {
                if (!(error instanceof HttpErrorResponse)) {
                  this.notice.message.set('Falha inesperada. Tente novamente.');
                }
                return of(
                  error instanceof HttpErrorResponse && error.status === 0
                    ? { connectionError: true as const }
                    : { requestError: true as const },
                );
              }),
            );
          }),
          startWith(undefined),
        ),
      ),
    ),
  );

  publish(draft: RideDraft): void {
    this.notice.message.set('');
    this.publishSubmissions.next(draft);
  }

  resetPublish(): void {
    this.publishResets.next();
  }
}
