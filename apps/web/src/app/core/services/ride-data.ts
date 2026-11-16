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

export type UpdateRideResult =
  | { ride: Ride }
  | { unauthorized: true }
  | { invalidState: true }
  | { invalidData: true }
  | RideErrorResult;

export type DriverRidesResult = { rides: Ride[] } | { unauthorized: true } | RideErrorResult;

@Injectable({ providedIn: 'root' })
export class RideData {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthData);
  private readonly notice = inject(ErrorNotice);
  private readonly publishSubmissions = new Subject<RideDraft>();
  private readonly publishResets = new Subject<void>();
  private readonly updateSubmissions = new Subject<{ ride: Ride; draft: RideDraft }>();
  private readonly updateResets = new Subject<void>();
  private readonly editRideLoads = new Subject<string>();
  private readonly driverRidesLoads = new Subject<void>();
  private readonly driverRidesResets = new Subject<void>();
  private readonly driverRidesState = signal<Ride[]>([]);
  private readonly editingRideState = signal<Ride | null>(null);

  readonly driverRides = computed(() => this.driverRidesState());
  readonly editingRide = computed(() => this.editingRideState());

  private readonly editRideLoader = toSignal(
    this.updateResets.pipe(
      startWith(undefined),
      switchMap(() =>
        this.editRideLoads.pipe(
          switchMap((rideId) => {
            const driver = this.auth.currentUser();
            if (!driver || driver.isBlocked) {
              this.editingRideState.set(null);
              return of(undefined);
            }

            return this.http.get<Ride>(`${environment.apiUrl}/rides/${rideId}`).pipe(
              tap((ride) => {
                if (ride.driverId === driver.id) {
                  this.editingRideState.set(ride);
                }
              }),
              catchError((error: unknown) => of(this.mapError(error))),
            );
          }),
          startWith(undefined),
        ),
      ),
    ),
  );

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

  readonly updateResult = toSignal<UpdateRideResult | undefined>(
    this.updateResets.pipe(
      startWith(undefined),
      switchMap(() =>
        this.updateSubmissions.pipe(
          exhaustMap(({ ride, draft }) => {
            const driver = this.auth.currentUser();
            if (!driver || driver.isBlocked || driver.id !== ride.driverId) {
              return of({ unauthorized: true as const });
            }

            if (
              ride.status === 'cancelled' ||
              ride.status === 'completed' ||
              new Date(ride.departureTime).getTime() <= Date.now()
            ) {
              return of({ invalidState: true as const });
            }

            if (
              !this.isValidDraft(draft) ||
              !this.isAllowedConfirmedPassengersUpdate(ride, draft)
            ) {
              return of({ invalidData: true as const });
            }

            const occupiedSeats = Math.max(0, ride.totalSeats - ride.availableSeats);
            const availableSeats = draft.totalSeats - occupiedSeats;
            const status: RideStatus = availableSeats > 0 ? 'active' : 'full';
            const notes = draft.notes?.trim();
            const body = {
              origin: draft.origin.trim(),
              destination: draft.destination.trim(),
              departureTime: draft.departureTime,
              totalSeats: draft.totalSeats,
              availableSeats,
              pricePerSeat: draft.pricePerSeat,
              status,
              ...(notes
                ? { notes }
                : draft.notes !== undefined && ride.notes !== undefined
                  ? { notes: '' }
                  : ride.notes !== undefined
                    ? { notes: ride.notes }
                    : {}),
            };

            return this.http.patch<Ride>(`${environment.apiUrl}/rides/${ride.id}`, body).pipe(
              tap((updated) => {
                this.driverRidesState.update((rides) =>
                  rides.map((item) => (item.id === updated.id ? updated : item)),
                );
                this.editingRideState.set(updated);
              }),
              map((updated) => ({ ride: updated })),
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

  startEditing(ride: Ride): void {
    this.editingRideState.set(ride);
    this.updateResets.next();
  }

  loadRideForEdit(rideId: string): void {
    this.notice.message.set('');
    this.editRideLoads.next(rideId);
  }

  clearEditing(): void {
    this.editingRideState.set(null);
    this.updateResets.next();
  }

  update(ride: Ride, draft: RideDraft): void {
    this.notice.message.set('');
    this.updateSubmissions.next({ ride, draft });
  }

  resetUpdate(): void {
    this.updateResets.next();
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

  canCancel(ride: Ride): boolean {
    return (
      (ride.status === 'active' || ride.status === 'full') &&
      new Date(ride.departureTime).getTime() > Date.now()
    );
  }

  cancel$(ride: Ride): Observable<Ride> {
    return this.http
      .patch<Ride>(`${environment.apiUrl}/rides/${ride.id}`, { status: 'cancelled' })
      .pipe(
        tap((updated) => {
          this.driverRidesState.update((rides) =>
            rides.map((item) => (item.id === updated.id ? updated : item)),
          );
          if (this.editingRideState()?.id === updated.id) {
            this.editingRideState.set(updated);
          }
        }),
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

  private isValidDraft(draft: RideDraft): boolean {
    if (draft.origin.trim().length === 0 || draft.destination.trim().length === 0) {
      return false;
    }
    if (!Number.isInteger(draft.totalSeats) || draft.totalSeats < 1 || draft.totalSeats > 4) {
      return false;
    }
    if (
      typeof draft.pricePerSeat !== 'number' ||
      Number.isNaN(draft.pricePerSeat) ||
      draft.pricePerSeat < 0
    ) {
      return false;
    }
    const departureMs = new Date(draft.departureTime).getTime();
    return !Number.isNaN(departureMs) && departureMs > Date.now();
  }

  private isAllowedConfirmedPassengersUpdate(ride: Ride, draft: RideDraft): boolean {
    const occupiedSeats = Math.max(0, ride.totalSeats - ride.availableSeats);
    if (occupiedSeats === 0) {
      return true;
    }

    if (
      draft.origin.trim() !== ride.origin.trim() ||
      draft.destination.trim() !== ride.destination.trim() ||
      new Date(draft.departureTime).getTime() !== new Date(ride.departureTime).getTime() ||
      draft.pricePerSeat !== ride.pricePerSeat ||
      draft.totalSeats < ride.totalSeats
    ) {
      return false;
    }

    if (draft.notes !== undefined && draft.notes.trim() !== (ride.notes ?? '').trim()) {
      return false;
    }

    return true;
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
