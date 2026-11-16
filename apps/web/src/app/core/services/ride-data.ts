import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, exhaustMap, map, Observable, of, startWith, Subject, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Ride, RideDraft, RideStatus } from '../models/ride.model';
import { AuthData } from './auth-data';
import { ErrorNotice } from './error-notice';

export type RideErrorResult = { connectionError: true } | { requestError: true };

export type PublishRideResult = { ride: Ride } | { unauthorized: true } | RideErrorResult;

export type DriverRidesResult = { rides: Ride[] } | { unauthorized: true } | RideErrorResult;

@Injectable({ providedIn: 'root' })
export class RideData {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthData);
  private readonly notice = inject(ErrorNotice);
  private readonly publishSubmissions = new Subject<RideDraft>();
  private readonly publishResets = new Subject<void>();
  private readonly driverRidesLoads = new Subject<void>();
  private readonly driverRidesResets = new Subject<void>();
  private readonly driverRidesState = signal<Ride[]>([]);

  readonly driverRides = computed(() => this.driverRidesState());

  readonly driverRidesResult = toSignal<DriverRidesResult | undefined>(
    this.driverRidesResets.pipe(
      startWith(undefined),
      switchMap(() =>
        this.driverRidesLoads.pipe(
          switchMap(() => {
            const driver = this.auth.currentUser();
            if (!driver) {
              this.driverRidesState.set([]);
              return of({ unauthorized: true as const });
            }

            return this.http
              .get<Ride[]>(`${environment.apiUrl}/rides`, { params: { driverId: driver.id } })
              .pipe(
                tap((rides) => this.driverRidesState.set(rides)),
                map((rides) => ({ rides })),
                catchError((error: unknown) => of(this.mapError(error))),
              );
          }),
          startWith(undefined),
        ),
      ),
    ),
  );

  readonly publishResult = toSignal<PublishRideResult | undefined>(
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
              catchError((error: unknown) => of(this.mapError(error))),
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

  loadDriverRides(): void {
    this.notice.message.set('');
    this.driverRidesLoads.next();
  }

  resetDriverRides(): void {
    this.driverRidesState.set([]);
    this.driverRidesResets.next();
  }

  canAcceptNewRequests(ride: Ride): boolean {
    return (
      ride.status === 'active' &&
      ride.availableSeats > 0 &&
      new Date(ride.departureTime).getTime() > Date.now()
    );
  }

  occupySeat$(ride: Ride): Observable<Ride> {
    const availableSeats = Math.max(0, ride.availableSeats - 1);
    const status: RideStatus = availableSeats === 0 ? 'full' : 'active';
    return this.http
      .patch<Ride>(`${environment.apiUrl}/rides/${ride.id}`, { availableSeats, status })
      .pipe(
        tap((updated) =>
          this.driverRidesState.update((rides) =>
            rides.map((item) => (item.id === updated.id ? updated : item)),
          ),
        ),
      );
  }

  private mapError(error: unknown): RideErrorResult {
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
}
