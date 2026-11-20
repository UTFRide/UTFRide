import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, Injector, Signal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  catchError,
  defer,
  EMPTY,
  exhaustMap,
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
import { Ride } from '../models/ride.model';
import { RideRequest } from '../models/ride-request.model';
import { AuthData, AuthenticatedUser, PassengerAccessRestriction } from './auth-data';
import { ErrorNotice } from './error-notice';
import { NotificationData } from './notification-data';
import { RideData, RideErrorResult, RideUnauthorizedError } from './ride-data';

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

export type CreateRideRequestResult =
  | { status: 'created' | 'duplicate'; request: RideRequest; ride: Ride }
  | { status: 'unavailable'; reason: RideRequestBlockReason; ride: Ride }
  | PassengerOperationFailure;

export type CancelPassengerRequestResult =
  | { status: 'cancelled'; request: RideRequest }
  | { status: 'not-owned' | 'invalid-state' }
  | PassengerOperationFailure;

export type LoadRideRequestsResult =
  | { requests: RideRequest[] }
  | { unauthorized: true }
  | RideErrorResult;

export type PassengerRequestResult = (
  | { status: 'loading' }
  | { status: 'loaded'; request: RideRequest | null }
  | { status: 'error' }
) & { revalidatedRide?: Ride };

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
  private readonly cancelSubmissions = new Subject<Ride>();
  private readonly resets = new Subject<void>();
  private readonly requestsState = signal<RideRequest[]>([]);

  readonly requests = computed(() => this.requestsState());

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

  loadPassengerRequest(rideId: Signal<string>, injector: Injector): Signal<PassengerRequestResult> {
    const query = computed(() => {
      const passenger = this.auth.currentUser();
      return passenger ? { rideId: rideId(), passenger } : null;
    });
    const emission = toSignal(
      toObservable(query, { injector }).pipe(
        switchMap((selection) => {
          if (!selection) return EMPTY;

          const read = this.fetchPassengerRequest(selection.rideId, selection.passenger.id).pipe(
            map((request): PassengerRequestResult => ({ status: 'loaded', request })),
            catchError(() => of(passengerRequestError)),
          );
          const creation = this.passengerCreations.get(selection.passenger)?.get(selection.rideId);
          const current = creation
            ? creation.pipe(
                switchMap((result) => {
                  if ('request' in result) {
                    return of<PassengerRequestResult>({
                      status: 'loaded',
                      request: result.request,
                      revalidatedRide: result.ride,
                    });
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

  createRequest(rideId: string): Observable<CreateRideRequestResult> {
    const passenger = this.auth.currentUser();
    return defer(() => {
      if (!passenger) return of(unauthenticated);
      const failure = this.passengerAccessFailure(passenger);
      if (failure) return of(failure);

      const creations =
        this.passengerCreations.get(passenger) ?? new Map<string, Observable<CreateRideRequestResult>>();
      this.passengerCreations.set(passenger, creations);
      const inProgress = creations.get(rideId);
      if (inProgress) return inProgress;

      const creation = this.submitPassengerRequest(rideId, passenger).pipe(
        finalize(() => creations.delete(rideId)),
        // Uma confirmação em andamento pode terminar enquanto o passageiro navega.
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      creations.set(rideId, creation);
      return creation;
    });
  }

  cancelPassengerRequest(requestId: string): Observable<CancelPassengerRequestResult> {
    const passenger = this.auth.currentUser();
    return defer(() => {
      if (!passenger) return of(unauthenticated);
      const failure = this.passengerAccessFailure(passenger);
      if (failure) return of(failure);

      const context = new HttpContext().set(HANDLE_SESSION_EXPIRATION_ONLY, true);
      const url = `${environment.apiUrl}/ride_requests/${encodeURIComponent(requestId)}`;
      return this.http.get<RideRequest>(url, { context }).pipe(
        switchMap((request): Observable<CancelPassengerRequestResult> => {
          const failure = this.passengerAccessFailure(passenger);
          if (failure) return of(failure);
          if (request.id !== requestId) return of({ status: 'request-error' });
          if (request.passengerId !== passenger.id) return of({ status: 'not-owned' });
          if (request.status !== 'pending') return of({ status: 'invalid-state' });

          return this.http.patch<RideRequest>(url, { status: 'cancelled' }, { context }).pipe(
            map((updated): CancelPassengerRequestResult =>
              this.passengerAccessFailure(passenger) ?? { status: 'cancelled', request: updated },
            ),
          );
        }),
        catchError((error: unknown) => of(this.passengerOperationError(error, passenger))),
      );
    });
  }

  cancelRide(ride: Ride): void {
    this.notice.message.set('');
    this.cancelSubmissions.next(ride);
  }

  reset(): void {
    this.requestsState.set([]);
    this.resets.next();
  }

  private submitPassengerRequest(
    rideId: string,
    passenger: AuthenticatedUser,
  ): Observable<CreateRideRequestResult> {
    const context = new HttpContext().set(HANDLE_SESSION_EXPIRATION_ONLY, true);

    return this.fetchPassengerRequest(rideId, passenger.id, context).pipe(
      switchMap((previous) => {
        const failure = this.passengerAccessFailure(passenger);
        if (failure) return of(failure);

        return this.http
          .get<Ride>(`${environment.apiUrl}/rides/${encodeURIComponent(rideId)}`, { context })
          .pipe(
            switchMap((ride): Observable<CreateRideRequestResult> => {
              const failure = this.passengerAccessFailure(passenger);
              if (failure) return of(failure);
              if (ride.id !== rideId) return of({ status: 'request-error' });
              if (previous && isActiveRideRequest(previous)) {
                return of({ status: 'duplicate', ride, request: previous });
              }

              const reason = this.requestBlockReason(ride);
              if (reason) return of({ status: 'unavailable', reason, ride });

              const body = {
                rideId,
                passengerId: passenger.id,
                status: 'pending' as const,
                createdAt: new Date().toISOString(),
              };
              return this.http
                .post<RideRequest>(`${environment.apiUrl}/ride_requests`, body, { context })
                .pipe(
                  map((request): CreateRideRequestResult =>
                    this.passengerAccessFailure(passenger) ?? { status: 'created', ride, request },
                  ),
                );
            }),
          );
      }),
      catchError((error: unknown) => of(this.passengerOperationError(error, passenger))),
    );
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
    context?: HttpContext,
  ): Observable<RideRequest | null> {
    // _where preserva IDs textuais que o json-server converteria em filtros simples (ex.: "007").
    const where = { rideId: { eq: rideId }, passengerId: { eq: passengerId } };
    return this.http
      .get<RideRequest[]>(`${environment.apiUrl}/ride_requests`, {
        context,
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
