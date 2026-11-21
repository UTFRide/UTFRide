import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, Injector, Signal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  catchError,
  defer,
  EMPTY,
  exhaustMap,
  filter,
  finalize,
  forkJoin,
  map,
  Observable,
  of,
  shareReplay,
  startWith,
  Subject,
  switchMap,
  tap,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { HANDLE_SESSION_EXPIRATION_ONLY } from '../interceptors/error-interceptor';
import { Notification } from '../models/notification.model';
import { Ride, RideDriverSummary } from '../models/ride.model';
import { RideRequest } from '../models/ride-request.model';
import { AuthData, AuthenticatedUser, PassengerAccessRestriction } from './auth-data';
import { ErrorNotice } from './error-notice';
import { NotificationData } from './notification-data';
import {
  passengerLoadError,
  PassengerLoadError,
  RideData,
  RideErrorResult,
  RideUnauthorizedError,
} from './ride-data';

export type RideRequestDecisionResult =
  | { request: RideRequest; ride: Ride }
  | { unauthorized: true }
  | { invalidState: true }
  | { noAvailableSeats: true }
  | RideErrorResult;

export type RideRequestBlockReason = 'own-ride' | 'full' | 'cancelled' | 'completed' | 'departed';

type PassengerAccessFailure =
  | { status: 'unauthenticated' }
  | { status: 'restricted'; reason: PassengerAccessRestriction };

type PassengerOperationFailure =
  | PassengerAccessFailure
  | { status: 'connection-error' | 'request-error' };

type PassengerRequestRecoveryResult =
  | { status: 'duplicate'; request: RideRequest; ride: Ride }
  | { status: 'recovered'; request: RideRequest | null; ride: Ride }
  | { status: 'ride-not-found' }
  | { status: 'ride-refresh-error'; connectionError?: true }
  | { status: 'duplicate-check-error'; connectionError?: true }
  | PassengerAccessFailure;

export type CreateRideRequestResult =
  | { status: 'created'; request: RideRequest; ride: Ride }
  | { status: 'unavailable'; reason: RideRequestBlockReason; ride: Ride }
  | PassengerRequestRecoveryResult
  | PassengerOperationFailure;

export type CancelPassengerRequestResult =
  | { status: 'cancelled'; request: RideRequest }
  | { status: 'not-owned' | 'invalid-state' }
  | PassengerOperationFailure;

type PassengerCancellationStatus = CancelPassengerRequestResult['status'] | 'cancelling';

export type LoadRideRequestsResult =
  | { requests: RideRequest[] }
  | { unauthorized: true }
  | RideErrorResult;

export type PassengerRequestResult = (
  | { status: 'loading' }
  | { status: 'ride-not-found' }
  | { status: 'loaded'; request: RideRequest | null }
  | (PassengerLoadError & { rideRefreshError?: true })
) & { revalidatedRide?: Ride };

export interface PassengerTripSummary extends Pick<RideRequest, 'id' | 'status'> {
  ride: Pick<Ride, 'origin' | 'destination' | 'departureTime' | 'pricePerSeat' | 'status'> | null;
  driver: RideDriverSummary | null;
  whatsapp?: string;
}

type PassengerTripsResult =
  | { status: 'loading' }
  | { status: 'loaded'; trips: PassengerTripSummary[] }
  | PassengerLoadError;

export type CancelRideResult =
  | { ride: Ride; cancelledRequests: RideRequest[]; notifications: Notification[] }
  | { unauthorized: true }
  | { invalidState: true }
  | RideErrorResult;

const passengerRequestLoading = { status: 'loading' } as const;
const passengerRequestError = { status: 'error' } as const;
const unauthenticated = { status: 'unauthenticated' } as const;

export function isActiveRideRequest(request: RideRequest | null): boolean {
  return request?.status === 'pending' || request?.status === 'accepted';
}

@Injectable({ providedIn: 'root' })
export class RideRequestData {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthData);
  private readonly rideData = inject(RideData);
  private readonly notificationData = inject(NotificationData);
  private readonly notice = inject(ErrorNotice);

  private readonly loadRideIds = new Subject<string>();
  private readonly decisionSubmissions = new Subject<{
    type: 'accept' | 'reject';
    request: RideRequest;
    ride: Ride;
  }>();
  private readonly passengerCreations = new WeakMap<
    AuthenticatedUser,
    Map<string, Observable<CreateRideRequestResult>>
  >();
  private readonly passengerRequestRecoveries = new WeakMap<AuthenticatedUser, Set<string>>();
  private readonly passengerCancellations = new WeakMap<
    AuthenticatedUser,
    Map<string, Observable<CancelPassengerRequestResult>>
  >();
  private readonly passengerCancellationSubmissions = new Subject<string>();
  private readonly passengerTripsRefresh = new Subject<AuthenticatedUser>();
  private readonly cancelSubmissions = new Subject<Ride>();
  private readonly resets = new Subject<void>();
  private readonly requestsState = signal<RideRequest[]>([]);

  readonly requests = computed(() => this.requestsState());

  private readonly passengerCancellationResult = toSignal(
    this.passengerCancellationSubmissions.pipe(
      switchMap((id) => {
        const passenger = this.auth.currentUser();
        if (!passenger) return EMPTY;

        return this.cancelPassengerRequest(id).pipe(
          map((result): PassengerCancellationStatus => result.status),
          startWith('cancelling' as const),
          filter(() => passenger === this.auth.currentUser()),
          map((status) => ({ id, passenger, status })),
        );
      }),
    ),
  );

  readonly passengerCancellation = computed(() => {
    const result = this.passengerCancellationResult();
    return result?.passenger === this.auth.currentUser() ? result : undefined;
  });

  readonly loadResult = toSignal<LoadRideRequestsResult | undefined>(
    this.resets.pipe(
      startWith(undefined),
      switchMap(() =>
        this.loadRideIds.pipe(
          switchMap((rideId) => {
            if (!this.rideData.canOperateAsDriver()) {
              this.requestsState.set([]);
              return of({ unauthorized: true as const });
            }

            const knownRide = this.rideData.driverRides().find((item) => item.id === rideId);
            if (knownRide) {
              if (!this.rideData.canManageRide(knownRide)) {
                this.requestsState.set([]);
                return of({ unauthorized: true as const });
              }
              return this.fetchRequestsForRide(rideId);
            }

            return this.http.get<Ride>(`${environment.apiUrl}/rides/${rideId}`).pipe(
              switchMap((ride) => {
                if (!this.rideData.canManageRide(ride)) {
                  this.requestsState.set([]);
                  return of({ unauthorized: true as const });
                }
                return this.fetchRequestsForRide(rideId);
              }),
              catchError((error: unknown) => {
                this.requestsState.set([]);
                return of(this.mapError(error));
              }),
            );
          }),
          startWith(undefined),
        ),
      ),
    ),
  );

  readonly decisionResult = toSignal<RideRequestDecisionResult | undefined>(
    this.resets.pipe(
      startWith(undefined),
      switchMap(() =>
        this.decisionSubmissions.pipe(
          exhaustMap(({ type, request, ride }) => {
            if (!this.rideData.canManageRide(ride)) {
              return of({ unauthorized: true as const });
            }

            if (
              request.rideId !== ride.id ||
              request.status !== 'pending' ||
              ride.status === 'cancelled' ||
              ride.status === 'completed' ||
              new Date(ride.departureTime).getTime() <= Date.now()
            ) {
              return of({ invalidState: true as const });
            }

            if (type === 'accept') {
              if (!this.rideData.canAcceptNewRequests(ride)) {
                return of({ noAvailableSeats: true as const });
              }

              return this.http
                .patch<RideRequest>(`${environment.apiUrl}/ride_requests/${request.id}`, {
                  status: 'accepted',
                })
                .pipe(
                  switchMap((updatedRequest) =>
                    this.rideData.occupySeat$(ride).pipe(
                      map((updatedRide) => ({ request: updatedRequest, ride: updatedRide })),
                    ),
                  ),
                  tap(({ request: updatedRequest }) =>
                    this.requestsState.update((items) =>
                      items.map((item) => (item.id === updatedRequest.id ? updatedRequest : item)),
                    ),
                  ),
                  catchError((error: unknown) =>
                    error instanceof RideUnauthorizedError
                      ? of({ unauthorized: true as const })
                      : of(this.mapError(error)),
                  ),
                );
            }

            return this.http
              .patch<RideRequest>(`${environment.apiUrl}/ride_requests/${request.id}`, {
                status: 'rejected',
              })
              .pipe(
                tap((updatedRequest) =>
                  this.requestsState.update((items) =>
                    items.map((item) => (item.id === updatedRequest.id ? updatedRequest : item)),
                  ),
                ),
                map((updatedRequest) => ({ request: updatedRequest, ride })),
                catchError((error: unknown) => of(this.mapError(error))),
              );
          }),
          startWith(undefined),
        ),
      ),
    ),
  );

  readonly cancelResult = toSignal<CancelRideResult | undefined>(
    this.resets.pipe(
      startWith(undefined),
      switchMap(() =>
        this.cancelSubmissions.pipe(
          exhaustMap((ride) => {
            if (!this.rideData.canManageRide(ride)) {
              return of({ unauthorized: true as const });
            }

            if (!this.rideData.canCancel(ride)) {
              return of({ invalidState: true as const });
            }

            return this.rideData.cancel$(ride).pipe(
              switchMap((cancelledRide) =>
                this.http
                  .get<RideRequest[]>(`${environment.apiUrl}/ride_requests`, {
                    params: { rideId: ride.id },
                  })
                  .pipe(
                    switchMap((requests) =>
                      this.cancelPendingAndNotify(cancelledRide, requests),
                    ),
                  ),
              ),
              catchError((error: unknown) =>
                error instanceof RideUnauthorizedError
                  ? of({ unauthorized: true as const })
                  : of(this.mapError(error)),
              ),
            );
          }),
          startWith(undefined),
        ),
      ),
    ),
  );

  loadForRide(rideId: string): void {
    this.notice.message.set('');
    this.loadRideIds.next(rideId);
  }

  loadPassengerTrips(injector: Injector): Signal<PassengerTripsResult> {
    const emission = toSignal(
      toObservable(this.auth.currentUser, { injector }).pipe(
        switchMap((passenger) => {
          if (!passenger) return of(null);

          return this.passengerTripsRefresh.pipe(
            filter((refreshedPassenger) => refreshedPassenger === passenger),
            startWith(passenger),
            switchMap(() =>
              this.http
                .get<PassengerTripSummary[]>(`${environment.apiUrl}/passenger-trip-summaries`, {
                  params: { passengerId: passenger.id },
                  context: new HttpContext().set(HANDLE_SESSION_EXPIRATION_ONLY, true),
                })
                .pipe(
                  map((trips): PassengerTripsResult => ({ status: 'loaded', trips })),
                  catchError((error: unknown) => of(passengerLoadError(error))),
                  startWith({ status: 'loading' } as const),
                  map((result) => ({ passenger, result })),
                ),
            ),
          );
        }),
      ),
      { injector },
    );

    return computed(() => {
      const passenger = this.auth.currentUser();
      if (!passenger) return { status: 'error' };

      const latest = emission();
      return latest?.passenger === passenger ? latest.result : { status: 'loading' };
    });
  }

  refreshPassengerTrips(): void {
    const passenger = this.auth.currentUser();
    if (passenger) this.passengerTripsRefresh.next(passenger);
  }

  loadPassengerRequest(
    rideId: Signal<string>,
    injector: Injector,
    retry?: Signal<number>,
  ): Signal<PassengerRequestResult> {
    const query = computed(() => {
      const passenger = this.auth.currentUser();
      return passenger ? { rideId: rideId(), passenger, attempt: retry?.() } : null;
    });
    const emission = toSignal(
      toObservable(query, { injector }).pipe(
        switchMap((selection) => {
          if (!selection || selection !== query()) return EMPTY;

          const { rideId, passenger } = selection;
          const isCurrent = () => selection === query();
          const read = defer((): Observable<PassengerRequestResult> => {
            if (!isCurrent()) return EMPTY;
            if (this.passengerRequestRecoveries.get(passenger)?.has(rideId)) {
              return this.recoverPassengerRequest(rideId, passenger, isCurrent).pipe(
                filter(isCurrent),
                tap((result) => this.finishPassengerRequestRecovery(rideId, passenger, result)),
                map((result) => this.passengerRequestReadResult(result)),
              );
            }
            return this.fetchPassengerRequest(rideId, passenger.id).pipe(
              map((request): PassengerRequestResult => ({ status: 'loaded', request })),
              catchError((error: unknown) => of(passengerLoadError(error))),
            );
          });
          const creation = this.passengerCreations.get(passenger)?.get(rideId);
          const current = creation
            ? creation.pipe(
                switchMap((result) => {
                  if (!isCurrent()) return EMPTY;
                  if (
                    'request' in result ||
                    result.status === 'ride-not-found' ||
                    result.status === 'ride-refresh-error'
                  ) {
                    this.finishPassengerRequestRecovery(rideId, passenger, result);
                    return of(this.passengerRequestReadResult(result));
                  }
                  if (result.status === 'unavailable') {
                    return read.pipe(
                      startWith(passengerRequestLoading),
                      map((request) => ({ ...request, revalidatedRide: result.ride })),
                    );
                  }
                  return result.status === 'unauthenticated' ? EMPTY : read;
                }),
              )
            : read;
          return current.pipe(
            startWith(passengerRequestLoading),
            filter(isCurrent),
            map((result) => ({ selection, result })),
          );
        }),
      ),
      { injector },
    );

    return computed(() => {
      const selection = query();
      if (!selection) return passengerRequestError;

      const latest = emission();
      return latest?.selection === selection ? latest.result : passengerRequestLoading;
    });
  }

  accept(request: RideRequest, ride: Ride): void {
    this.notice.message.set('');
    this.decisionSubmissions.next({ type: 'accept', request, ride });
  }

  reject(request: RideRequest, ride: Ride): void {
    this.notice.message.set('');
    this.decisionSubmissions.next({ type: 'reject', request, ride });
  }

  requestBlockReason(ride: Ride): RideRequestBlockReason | null {
    if (ride.driverId === this.auth.currentUser()?.id) return 'own-ride';
    if (ride.status === 'cancelled' || ride.status === 'completed') return ride.status;
    if (ride.status === 'full' || ride.availableSeats <= 0) return 'full';
    return this.rideData.canAcceptNewRequests(ride) ? null : 'departed';
  }

  createRequest(
    rideId: string,
    isCurrent: () => boolean = () => true,
  ): Observable<CreateRideRequestResult> {
    const passenger = this.auth.currentUser();
    return defer(() => {
      if (!passenger) return of(unauthenticated);
      const failure = this.passengerAccessFailure(passenger);
      if (failure) return of(failure);

      const creations =
        this.passengerCreations.get(passenger) ?? new Map<string, Observable<CreateRideRequestResult>>();
      this.passengerCreations.set(passenger, creations);
      let creation = creations.get(rideId);
      if (!creation) {
        creation = this.submitPassengerRequest(rideId, passenger).pipe(
          finalize(() => creations.delete(rideId)),
          // Uma confirmação em andamento pode terminar enquanto o passageiro navega.
          shareReplay({ bufferSize: 1, refCount: false }),
        );
        creations.set(rideId, creation);
      }

      return creation.pipe(
        tap((result) => {
          if (isCurrent()) this.finishPassengerRequestRecovery(rideId, passenger, result);
        }),
      );
    });
  }

  cancelPassengerRequest(requestId: string): Observable<CancelPassengerRequestResult> {
    const passenger = this.auth.currentUser();
    return defer(() => {
      if (!passenger) return of(unauthenticated);
      const failure = this.passengerAccessFailure(passenger);
      if (failure) return of(failure);

      const cancellations =
        this.passengerCancellations.get(passenger) ??
        new Map<string, Observable<CancelPassengerRequestResult>>();
      this.passengerCancellations.set(passenger, cancellations);
      const inProgress = cancellations.get(requestId);
      if (inProgress) return inProgress;

      const cancellation = this.patchPendingPassengerRequest(requestId, passenger).pipe(
        tap(({ status }) => {
          if (status === 'cancelled' || status === 'invalid-state' || status === 'not-owned') {
            this.passengerTripsRefresh.next(passenger);
          }
        }),
        finalize(() => cancellations.delete(requestId)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      cancellations.set(requestId, cancellation);
      return cancellation;
    });
  }

  cancelPassengerTrip(requestId: string): void {
    if (this.passengerCancellation()?.status === 'cancelling') return;
    this.passengerCancellationSubmissions.next(requestId);
  }

  cancelRide(ride: Ride): void {
    this.notice.message.set('');
    this.cancelSubmissions.next(ride);
  }

  reset(): void {
    this.requestsState.set([]);
    this.resets.next();
  }

  private patchPendingPassengerRequest(
    requestId: string,
    passenger: AuthenticatedUser,
  ): Observable<CancelPassengerRequestResult> {
    const context = new HttpContext().set(HANDLE_SESSION_EXPIRATION_ONLY, true);
    const url = `${environment.apiUrl}/ride_requests/${encodeURIComponent(requestId)}`;
    return this.http.get<RideRequest>(url, { context }).pipe(
      switchMap((request): Observable<CancelPassengerRequestResult> => {
        const failure = this.passengerAccessFailure(passenger);
        if (failure) return of(failure);
        if (request.id !== requestId) return of({ status: 'request-error' });
        if (request.passengerId !== passenger.id) return of({ status: 'not-owned' });
        if (request.status !== 'pending') return of({ status: 'invalid-state' });

        return this.http
          .patch<RideRequest>(
            url,
            { status: 'cancelled' },
            { context, params: { passengerId: passenger.id } },
          )
          .pipe(
            map((updated): CancelPassengerRequestResult => {
              const failure = this.passengerAccessFailure(passenger);
              if (failure) return failure;
              return updated?.id === requestId &&
                updated.passengerId === passenger.id &&
                updated.status === 'cancelled'
                ? { status: 'cancelled', request: updated }
                : { status: 'request-error' };
            }),
            catchError((error: unknown): Observable<CancelPassengerRequestResult> => {
              const failure = this.passengerAccessFailure(passenger);
              if (failure) return of(failure);
              if (error instanceof HttpErrorResponse) {
                if (error.status === 409) return of({ status: 'invalid-state' });
                if (error.status === 403) return of({ status: 'not-owned' });
              }
              return of(this.passengerOperationError(error, passenger));
            }),
          );
      }),
      catchError((error: unknown) => of(this.passengerOperationError(error, passenger))),
    );
  }

  private submitPassengerRequest(
    rideId: string,
    passenger: AuthenticatedUser,
  ): Observable<CreateRideRequestResult> {
    if (this.passengerRequestRecoveries.get(passenger)?.has(rideId)) {
      return this.recoverPassengerRequest(rideId, passenger);
    }

    return this.fetchPassengerRequest(rideId, passenger.id).pipe(
      switchMap((previous) => {
        const failure = this.passengerAccessFailure(passenger);
        if (failure) return of(failure);
        if (!isActiveRideRequest(previous)) return this.submitNewPassengerRequest(rideId, passenger);

        this.rememberPassengerRequestRecovery(rideId, passenger);
        return this.readRideAfterRequest(rideId, passenger, previous);
      }),
      catchError((error: unknown) => of(this.passengerOperationError(error, passenger))),
    );
  }

  private submitNewPassengerRequest(
    rideId: string,
    passenger: AuthenticatedUser,
  ): Observable<CreateRideRequestResult> {
    return this.rideData.readPassengerRide(rideId).pipe(
      switchMap((offer): Observable<CreateRideRequestResult> => {
        const failure = this.passengerAccessFailure(passenger);
        if (failure) return of(failure);
        if (!offer) return of({ status: 'ride-not-found' });
        const { ride } = offer;
        if (ride.id !== rideId) return of({ status: 'request-error' });

        const reason = this.requestBlockReason(ride);
        if (reason) return of({ status: 'unavailable', reason, ride });
        return this.postPassengerRequest(ride, passenger);
      }),
    );
  }

  private postPassengerRequest(
    ride: Ride,
    passenger: AuthenticatedUser,
  ): Observable<CreateRideRequestResult> {
    const body = {
      rideId: ride.id,
      passengerId: passenger.id,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    };
    return this.http
      .post<RideRequest>(`${environment.apiUrl}/ride_requests`, body, {
        context: new HttpContext().set(HANDLE_SESSION_EXPIRATION_ONLY, true),
      })
      .pipe(
        map((request): CreateRideRequestResult =>
          this.passengerAccessFailure(passenger) ?? { status: 'created', ride, request },
        ),
        catchError((error: unknown) => {
          const failure = this.passengerAccessFailure(passenger);
          if (failure) return of(failure);
          if (
            error instanceof HttpErrorResponse &&
            error.status === 409 &&
            error.error?.code === 'active-ride-request'
          ) {
            this.rememberPassengerRequestRecovery(ride.id, passenger);
            return this.recoverPassengerRequest(ride.id, passenger);
          }
          return of(this.passengerOperationError(error, passenger));
        }),
      );
  }

  private rememberPassengerRequestRecovery(rideId: string, passenger: AuthenticatedUser): void {
    const recoveries = this.passengerRequestRecoveries.get(passenger) ?? new Set<string>();
    recoveries.add(rideId);
    this.passengerRequestRecoveries.set(passenger, recoveries);
  }

  private finishPassengerRequestRecovery(
    rideId: string,
    passenger: AuthenticatedUser,
    result: CreateRideRequestResult,
  ): void {
    if (
      passenger === this.auth.currentUser() &&
      (result.status === 'duplicate' ||
        result.status === 'recovered' ||
        result.status === 'ride-not-found')
    ) {
      // Se a tela saiu antes de receber o resultado, a próxima leitura ainda precisa reconciliar o par.
      this.passengerRequestRecoveries.get(passenger)?.delete(rideId);
    }
  }

  private recoverPassengerRequest(
    rideId: string,
    passenger: AuthenticatedUser,
    isCurrent: () => boolean = () => true,
  ): Observable<PassengerRequestRecoveryResult> {
    return this.fetchPassengerRequest(rideId, passenger.id).pipe(
      map((request) => ({ request })),
      catchError((error: unknown) => {
        const failure = this.passengerOperationError(error, passenger);
        return of(
          failure.status === 'unauthenticated'
            ? failure
            : {
                status: 'duplicate-check-error' as const,
                connectionError: passengerLoadError(error).connectionError,
              },
        );
      }),
      filter(isCurrent),
      switchMap((result) => {
        if (!('request' in result)) return of(result);
        const failure = this.passengerAccessFailure(passenger);
        return failure
          ? of(failure)
          : this.readRideAfterRequest(rideId, passenger, result.request);
      }),
    );
  }

  private readRideAfterRequest(
    rideId: string,
    passenger: AuthenticatedUser,
    request: RideRequest | null,
  ): Observable<PassengerRequestRecoveryResult> {
    return this.rideData.readPassengerRide(rideId).pipe(
      map((offer): PassengerRequestRecoveryResult => {
        const failure = this.passengerAccessFailure(passenger);
        if (failure) return failure;
        if (offer && offer.ride?.id !== rideId) return { status: 'ride-refresh-error' };

        if (!offer) return { status: 'ride-not-found' };
        const { ride } = offer;
        return request && isActiveRideRequest(request)
          ? { status: 'duplicate', request, ride }
          : { status: 'recovered', request, ride };
      }),
      catchError((error: unknown): Observable<PassengerRequestRecoveryResult> => {
        const failure = this.passengerOperationError(error, passenger);
        if (failure.status === 'unauthenticated') return of(failure);
        return of({
          status: 'ride-refresh-error',
          connectionError: passengerLoadError(error).connectionError,
        });
      }),
    );
  }

  private passengerRequestReadResult(
    result: PassengerRequestRecoveryResult | { status: 'created'; request: RideRequest; ride: Ride },
  ): PassengerRequestResult {
    if ('request' in result) {
      return { status: 'loaded', request: result.request, revalidatedRide: result.ride };
    }
    if (result.status === 'ride-not-found') return result;
    if (result.status === 'ride-refresh-error') {
      return { status: 'error', rideRefreshError: true, connectionError: result.connectionError };
    }
    if (result.status === 'duplicate-check-error') {
      return { status: 'error', connectionError: result.connectionError };
    }
    return passengerRequestError;
  }

  private passengerAccessFailure(passenger: AuthenticatedUser): PassengerAccessFailure | null {
    if (passenger !== this.auth.currentUser()) return unauthenticated;
    const reason = this.auth.passengerRestriction();
    return reason ? { status: 'restricted', reason } : null;
  }

  private passengerOperationError(
    error: unknown,
    passenger: AuthenticatedUser,
  ): PassengerOperationFailure {
    const status = error instanceof HttpErrorResponse ? error.status : undefined;
    if (status === 401 || passenger !== this.auth.currentUser()) return unauthenticated;
    return { status: status === 0 ? 'connection-error' : 'request-error' };
  }

  private fetchPassengerRequest(
    rideId: string,
    passengerId: string,
  ): Observable<RideRequest | null> {
    // _where preserva IDs textuais que o json-server converteria em filtros simples (ex.: "007").
    const where = { rideId: { eq: rideId }, passengerId: { eq: passengerId } };
    return this.http
      .get<RideRequest[]>(`${environment.apiUrl}/ride_requests`, {
        context: new HttpContext().set(HANDLE_SESSION_EXPIRATION_ONLY, true),
        params: { _where: JSON.stringify(where) },
      })
      .pipe(
        map((requests) => {
          const matching = requests
            .filter((request) => request.rideId === rideId && request.passengerId === passengerId)
            .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
          return matching.find(isActiveRideRequest) ?? matching[0] ?? null;
        }),
      );
  }

  private fetchRequestsForRide(rideId: string): Observable<LoadRideRequestsResult> {
    return this.http
      .get<RideRequest[]>(`${environment.apiUrl}/ride_requests`, { params: { rideId } })
      .pipe(
        tap((requests) => this.requestsState.set(requests)),
        map((requests) => ({ requests })),
        catchError((error: unknown) => of(this.mapError(error))),
      );
  }

  private cancelPendingAndNotify(
    cancelledRide: Ride,
    requests: RideRequest[],
  ): Observable<CancelRideResult> {
    const pendingRequests = requests.filter((request) => request.status === 'pending');
    const acceptedRequests = requests.filter((request) => request.status === 'accepted');
    const recipientIds = [
      ...acceptedRequests.map((request) => request.passengerId),
      ...pendingRequests.map((request) => request.passengerId),
    ];

    const cancelPending$ =
      pendingRequests.length === 0
        ? of([] as RideRequest[])
        : forkJoin(
            pendingRequests.map((request) =>
              this.http.patch<RideRequest>(`${environment.apiUrl}/ride_requests/${request.id}`, {
                status: 'cancelled',
              }),
            ),
          );

    return cancelPending$.pipe(
      tap((cancelledRequests) => {
        const cancelledById = new Map(cancelledRequests.map((item) => [item.id, item]));
        const merged = requests.map((item) => cancelledById.get(item.id) ?? item);
        this.requestsState.update((current) => [
          ...current.filter((item) => item.rideId !== cancelledRide.id),
          ...merged,
        ]);
      }),
      switchMap((cancelledRequests) =>
        this.notificationData
          .createCancellationNotifications$(cancelledRide, recipientIds)
          .pipe(
            map((notifications) => ({
              ride: cancelledRide,
              cancelledRequests,
              notifications,
            })),
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
