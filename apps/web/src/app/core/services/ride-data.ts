import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, DestroyRef, inject, Injectable, Injector, Signal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  EMPTY,
  exhaustMap,
  map,
  merge,
  Observable,
  of,
  startWith,
  Subject,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Ride,
  RideDraft,
  RideDriverSummary,
  RideSearchFilters,
  RideStatus,
  RideWithDriver,
} from '../models/ride.model';
import { AuthData, AuthenticatedUser } from './auth-data';
import { ErrorNotice } from './error-notice';

export class RideUnauthorizedError extends Error {
  constructor() {
    super('Operação permitida apenas ao motorista autor com conta ativa.');
    this.name = 'RideUnauthorizedError';
  }
}

export type RideErrorResult = { connectionError: true } | { requestError: true };

export type PublishRideResult = { ride: Ride } | { unauthorized: true } | RideErrorResult;

export type UpdateRideResult =
  | { ride: Ride }
  | { unauthorized: true }
  | { invalidState: true }
  | { invalidData: true }
  | RideErrorResult;

export type DriverRidesResult = { rides: Ride[] } | { unauthorized: true } | RideErrorResult;

export type EditRideLoadResult = { ride: Ride } | { unauthorized: true } | RideErrorResult;

export type RideSearchResult =
  | { status: 'loading' }
  | { status: 'loaded'; rides: RideWithDriver[] }
  | { status: 'error' };

interface RideSearchQuery extends RideSearchFilters {
  passengerId: string;
}

const searchLoading = { status: 'loading' } as const;

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

function sameSearch(left: RideSearchQuery | null, right: RideSearchQuery | null): boolean {
  return (
    left?.passengerId === right?.passengerId &&
    left?.origin === right?.origin &&
    left?.destination === right?.destination &&
    left?.date === right?.date
  );
}

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
  private readonly editLoadResets = new Subject<void>();
  private readonly editLoadResults = new Subject<EditRideLoadResult>();
  private readonly driverRidesLoads = new Subject<void>();
  private readonly driverRidesResets = new Subject<void>();
  private readonly driverRidesState = signal<Ride[]>([]);
  private readonly editingRideState = signal<Ride | null>(null);

  readonly driverRides = computed(() => this.driverRidesState());
  readonly editingRide = computed(() => this.editingRideState());
  readonly canOffer = this.auth.canOffer;

  readonly editRideLoadResult = toSignal<EditRideLoadResult | undefined>(
    this.editLoadResets.pipe(
      startWith(undefined),
      switchMap(() =>
        merge(
          this.editRideLoads.pipe(
            switchMap((rideId) => {
              if (!this.canOperateAsDriver()) {
                this.editingRideState.set(null);
                return of({ unauthorized: true as const });
              }

              return this.http.get<Ride>(`${environment.apiUrl}/rides/${rideId}`).pipe(
                map((ride) => {
                  if (!this.canManageRide(ride)) {
                    this.editingRideState.set(null);
                    return { unauthorized: true as const };
                  }
                  this.editingRideState.set(ride);
                  return { ride };
                }),
                catchError((error: unknown) => {
                  this.editingRideState.set(null);
                  return of(this.mapError(error));
                }),
              );
            }),
          ),
          this.editLoadResults,
        ).pipe(startWith(undefined)),
      ),
    ),
  );

  readonly driverRidesResult = toSignal<DriverRidesResult | undefined>(
    this.driverRidesResets.pipe(
      startWith(undefined),
      switchMap(() =>
        this.driverRidesLoads.pipe(
          switchMap(() => {
            const driver = this.getAuthorizedDriver();
            if (!driver) {
              this.driverRidesState.set([]);
              return of({ unauthorized: true as const });
            }

            return this.http
              .get<Ride[]>(`${environment.apiUrl}/rides`, { params: { driverId: driver.id } })
              .pipe(
                map((rides) => rides.filter((ride) => ride.driverId === driver.id)),
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
            const driver = this.getAuthorizedDriver();
            if (!driver) {
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
            if (!this.canManageRide(ride)) {
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

  searchAvailableRides(filters: Signal<RideSearchFilters>, injector: Injector): Signal<RideSearchResult> {
    const destroyRef = injector.get(DestroyRef);
    const query = computed<RideSearchQuery | null>(() => {
      const passengerId = this.auth.currentUser()?.id;
      if (!passengerId) return null;

      const { origin, destination, date } = filters();
      return {
        passengerId,
        origin: normalizeSearchText(origin),
        destination: normalizeSearchText(destination),
        date,
      };
    });

    const emission = toSignal(
      toObservable(query, { injector }).pipe(
        debounceTime(250),
        distinctUntilChanged(sameSearch),
        switchMap((currentQuery) => {
          // O debounce emite o último valor quando toObservable encerra ao destruir a tela.
          const response: Observable<RideSearchResult> = currentQuery && !destroyRef.destroyed
            ? this.loadAvailableRides(currentQuery)
            : EMPTY;
          return response.pipe(
            startWith(searchLoading),
            map((result) => ({ query: currentQuery, result })),
          );
        }),
      ),
      { injector },
    );

    // Durante o debounce, só uma resposta dos filtros atuais pode aparecer na tela.
    return computed(() => {
      const latest = emission();
      return latest && sameSearch(latest.query, query()) ? latest.result : searchLoading;
    });
  }

  private loadAvailableRides(query: RideSearchQuery): Observable<RideSearchResult> {
    const { passengerId, origin, destination, date } = query;
    const where = {
      status: { eq: 'active' },
      availableSeats: { gt: 0 },
      driverId: { ne: passengerId },
      ...(origin ? { origin: { contains: origin } } : {}),
      ...(destination ? { destination: { contains: destination } } : {}),
    };
    const localDay = date ? new Date(`${date}T00:00:00`).toDateString() : '';

    return this.http
      .get<Ride[]>(`${environment.apiUrl}/rides`, { params: { _where: JSON.stringify(where) } })
      .pipe(
        map((rides) =>
          rides.filter(
            (ride) =>
              this.canAcceptNewRequests(ride) &&
              ride.driverId !== passengerId &&
              normalizeSearchText(ride.origin).includes(origin) &&
              normalizeSearchText(ride.destination).includes(destination) &&
              (!localDay || new Date(ride.departureTime).toDateString() === localDay),
          ),
        ),
        switchMap((rides) => this.enrichWithDrivers(rides)),
        map((rides) => ({ status: 'loaded' as const, rides })),
        catchError(() => of({ status: 'error' as const })),
      );
  }

  private enrichWithDrivers(rides: Ride[]): Observable<RideWithDriver[]> {
    if (!rides.length) return of([]);

    const ids = [...new Set(rides.map((ride) => ride.driverId))];
    return this.http
      .get<(RideDriverSummary & { id: string })[]>(`${environment.apiUrl}/driver-summaries`, {
        params: { id: ids },
      })
      .pipe(
        map((summaries) => {
          const drivers = new Map(
            summaries.map(({ id, name, ratingAverage }) => [id, { name, ratingAverage }]),
          );
          return rides.map((ride) => ({ ...ride, driver: drivers.get(ride.driverId) ?? null }));
        }),
      );
  }

  publish(draft: RideDraft): void {
    this.notice.message.set('');
    this.publishSubmissions.next(draft);
  }

  resetPublish(): void {
    this.publishResets.next();
  }

  canOperateAsDriver(): boolean {
    return this.auth.canOffer();
  }

  canManageRide(ride: Ride): boolean {
    const driver = this.getAuthorizedDriver();
    return driver !== null && driver.id === ride.driverId;
  }

  private getAuthorizedDriver(): AuthenticatedUser | null {
    const driver = this.auth.currentUser();
    return this.auth.canOffer() && driver ? driver : null;
  }

  startEditing(ride: Ride): boolean {
    if (!this.canManageRide(ride)) {
      this.editingRideState.set(null);
      this.updateResets.next();
      this.editLoadResults.next({ unauthorized: true as const });
      return false;
    }

    this.editLoadResets.next();
    this.editingRideState.set(ride);
    this.updateResets.next();
    return true;
  }

  loadRideForEdit(rideId: string): void {
    this.notice.message.set('');
    this.editLoadResets.next();
    this.editRideLoads.next(rideId);
  }

  clearEditing(): void {
    this.editingRideState.set(null);
    this.editLoadResets.next();
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
      this.canManageRide(ride) &&
      (ride.status === 'active' || ride.status === 'full') &&
      new Date(ride.departureTime).getTime() > Date.now()
    );
  }

  cancel$(ride: Ride): Observable<Ride> {
    if (!this.canManageRide(ride)) {
      return throwError(() => new RideUnauthorizedError());
    }

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
    if (!this.canManageRide(ride)) {
      return throwError(() => new RideUnauthorizedError());
    }

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
