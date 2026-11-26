import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { computed, DestroyRef, inject, Injectable, Injector, Signal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  EMPTY,
  exhaustMap,
  filter,
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
import { HANDLE_SESSION_EXPIRATION_ONLY } from '../interceptors/error-interceptor';
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
import {
  DriverSummaryRow,
  isInvalidUuidError,
  mapRideRow,
  RideRow,
  SUPABASE_SINGLE_OBJECT_HEADERS,
  supabaseRestUrl,
  supabaseRpcUrl,
} from './supabase-rest';

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

export interface PassengerLoadError {
  status: 'error';
  connectionError?: true;
}

export type RideSearchResult =
  | { status: 'loading' }
  | { status: 'loaded'; rides: RideWithDriver[] }
  | PassengerLoadError;

export type RideDetailResult =
  | { status: 'loading' }
  | { status: 'loaded'; ride: RideWithDriver }
  | { status: 'not-found' }
  | PassengerLoadError;

interface RideSearchQuery extends RideSearchFilters {
  passenger: AuthenticatedUser;
  attempt: number;
}

const searchLoading = { status: 'loading' } as const;
const detailLoading = { status: 'loading' } as const;

export function passengerLoadError(error: unknown): PassengerLoadError {
  return error instanceof HttpErrorResponse && error.status === 0
    ? { status: 'error', connectionError: true }
    : { status: 'error' };
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

function sameSearch(left: RideSearchQuery | null, right: RideSearchQuery | null): boolean {
  return (
    left?.passenger === right?.passenger &&
    left?.attempt === right?.attempt &&
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

              return this.http
                .get<RideRow[]>(supabaseRestUrl('rides'), { params: { id: `eq.${rideId}` } })
                .pipe(
                  map((rows) => {
                    const row = rows[0];
                    if (!row) {
                      this.editingRideState.set(null);
                      return { requestError: true as const };
                    }
                    const ride = mapRideRow(row);
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
              .get<RideRow[]>(supabaseRestUrl('rides'), { params: { driver_id: `eq.${driver.id}` } })
              .pipe(
                map((rows) => rows.map(mapRideRow).filter((ride) => ride.driverId === driver.id)),
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
              driver_id: driver.id,
              origin: draft.origin.trim(),
              destination: draft.destination.trim(),
              departure_time: draft.departureTime,
              total_seats: draft.totalSeats,
              available_seats: draft.totalSeats,
              price_per_seat: draft.pricePerSeat,
              status: 'active' as const,
              created_at: new Date().toISOString(),
              ...(notes ? { notes } : {}),
            };

            return this.http
              .post<RideRow>(supabaseRestUrl('rides'), body, {
                headers: SUPABASE_SINGLE_OBJECT_HEADERS,
              })
              .pipe(
                map((row) => ({ ride: mapRideRow(row) })),
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
              departure_time: draft.departureTime,
              total_seats: draft.totalSeats,
              available_seats: availableSeats,
              price_per_seat: draft.pricePerSeat,
              status,
              ...(notes
                ? { notes }
                : draft.notes !== undefined && ride.notes !== undefined
                  ? { notes: '' }
                  : ride.notes !== undefined
                    ? { notes: ride.notes }
                    : {}),
            };

            return this.http
              .patch<RideRow>(supabaseRestUrl('rides'), body, {
                params: { id: `eq.${ride.id}` },
                headers: SUPABASE_SINGLE_OBJECT_HEADERS,
              })
              .pipe(
                map(mapRideRow),
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

  searchAvailableRides(
    filters: Signal<RideSearchFilters>,
    injector: Injector,
    retry?: Signal<number>,
  ): Signal<RideSearchResult> {
    const destroyRef = injector.get(DestroyRef);
    const query = computed<RideSearchQuery | null>(() => {
      const passenger = this.auth.currentUser();
      if (!passenger) return null;

      const { origin, destination, date } = filters();
      return {
        passenger,
        attempt: retry?.() ?? 0,
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

  loadRideDetail(
    rideId: Signal<string>,
    injector: Injector,
    retry?: Signal<number>,
  ): Signal<RideDetailResult> {
    const selection = computed(() => {
      const passenger = this.auth.currentUser();
      return passenger ? { id: rideId(), passenger, attempt: retry?.() } : null;
    });
    const emission = toSignal(
      toObservable(selection, { injector }).pipe(
        switchMap((current) => {
          if (!current || current !== selection()) return EMPTY;

          return this.readPassengerRide(current.id).pipe(
            switchMap((offer): Observable<RideDetailResult> => {
              // A sessão pode mudar antes que toObservable cancele a leitura anterior.
              if (current !== selection()) return EMPTY;
              if (!offer) return of({ status: 'not-found' });

              return this.enrichWithDrivers([offer.ride]).pipe(
                map(([ride]) => ({ status: 'loaded', ride })),
              );
            }),
            catchError((error: unknown) => of(passengerLoadError(error))),
            filter(() => current === selection()),
            startWith(detailLoading),
            map((result) => ({ selection: current, result })),
          );
        }),
      ),
      { injector },
    );

    return computed(() => {
      const latest = emission();
      return latest?.selection === selection() ? latest.result : detailLoading;
    });
  }

  readPassengerRide(rideId: string): Observable<{ ride: Ride } | null> {
    return this.http
      .get<RideRow[]>(supabaseRestUrl('rides'), {
        params: { id: `eq.${rideId}` },
        context: new HttpContext().set(HANDLE_SESSION_EXPIRATION_ONLY, true),
      })
      .pipe(
        map((rows) => (rows[0] ? { ride: mapRideRow(rows[0]) } : null)),
        catchError((error: unknown) =>
          error instanceof HttpErrorResponse && (error.status === 404 || isInvalidUuidError(error))
            ? of(null)
            : throwError(() => error),
        ),
      );
  }

  private loadAvailableRides(query: RideSearchQuery): Observable<RideSearchResult> {
    const { passenger, origin, destination, date } = query;
    const params: Record<string, string> = {
      status: 'eq.active',
      available_seats: 'gt.0',
      driver_id: `neq.${passenger.id}`,
      ...(origin ? { origin: `ilike.*${origin}*` } : {}),
      ...(destination ? { destination: `ilike.*${destination}*` } : {}),
    };
    const localDay = date ? new Date(`${date}T00:00:00`).toDateString() : '';

    return this.http
      .get<RideRow[]>(supabaseRestUrl('rides'), {
        params,
        context: new HttpContext().set(HANDLE_SESSION_EXPIRATION_ONLY, true),
      })
      .pipe(
        map((rows) =>
          rows
            .map(mapRideRow)
            .filter(
              (ride) =>
                this.canAcceptNewRequests(ride) &&
                ride.driverId !== passenger.id &&
                normalizeSearchText(ride.origin).includes(origin) &&
                normalizeSearchText(ride.destination).includes(destination) &&
                (!localDay || new Date(ride.departureTime).toDateString() === localDay),
            ),
        ),
        switchMap((rides) =>
          passenger === this.auth.currentUser() ? this.enrichWithDrivers(rides) : EMPTY,
        ),
        map((rides) => ({ status: 'loaded' as const, rides })),
        catchError((error: unknown) => of(passengerLoadError(error))),
      );
  }

  private enrichWithDrivers(rides: Ride[]): Observable<RideWithDriver[]> {
    if (!rides.length) return of([]);

    const ids = [...new Set(rides.map((ride) => ride.driverId))];
    return this.http
      .post<DriverSummaryRow[]>(
        supabaseRpcUrl('get_driver_summaries'),
        { p_driver_ids: ids },
        { context: new HttpContext().set(HANDLE_SESSION_EXPIRATION_ONLY, true) },
      )
      .pipe(
        map((summaries) => {
          const drivers = new Map<string, RideDriverSummary>(
            summaries.map(({ id, name, rating_average }) => [
              id,
              { name, ratingAverage: Number(rating_average ?? 0) },
            ]),
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
      .patch<RideRow>(
        supabaseRestUrl('rides'),
        { status: 'cancelled' },
        { params: { id: `eq.${ride.id}` }, headers: SUPABASE_SINGLE_OBJECT_HEADERS },
      )
      .pipe(
        map(mapRideRow),
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
      .patch<RideRow>(
        supabaseRestUrl('rides'),
        { available_seats: availableSeats, status },
        { params: { id: `eq.${ride.id}` }, headers: SUPABASE_SINGLE_OBJECT_HEADERS },
      )
      .pipe(
        map(mapRideRow),
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
