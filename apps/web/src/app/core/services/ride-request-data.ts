import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, Injector, Signal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  catchError,
  EMPTY,
  exhaustMap,
  forkJoin,
  map,
  Observable,
  of,
  startWith,
  Subject,
  switchMap,
  tap,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { Notification } from '../models/notification.model';
import { Ride } from '../models/ride.model';
import { RideRequest } from '../models/ride-request.model';
import { AuthData } from './auth-data';
import { ErrorNotice } from './error-notice';
import { NotificationData } from './notification-data';
import { RideData, RideErrorResult, RideUnauthorizedError } from './ride-data';

export type RideRequestDecisionResult =
  | { request: RideRequest; ride: Ride }
  | { unauthorized: true }
  | { invalidState: true }
  | { noAvailableSeats: true }
  | RideErrorResult;

export type CreateRideRequestResult =
  | { request: RideRequest }
  | { rideFull: true }
  | RideErrorResult;

export type LoadRideRequestsResult =
  | { requests: RideRequest[] }
  | { unauthorized: true }
  | RideErrorResult;

export type PassengerRequestResult =
  | { status: 'loading' }
  | { status: 'loaded'; request: RideRequest | null }
  | { status: 'error' };

export type CancelRideResult =
  | { ride: Ride; cancelledRequests: RideRequest[]; notifications: Notification[] }
  | { unauthorized: true }
  | { invalidState: true }
  | RideErrorResult;

const passengerRequestLoading = { status: 'loading' } as const;
const passengerRequestError = { status: 'error' } as const;

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
  private readonly createSubmissions = new Subject<{ ride: Ride; passengerId: string }>();
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

  readonly createResult = toSignal<CreateRideRequestResult | undefined>(
    this.resets.pipe(
      startWith(undefined),
      switchMap(() =>
        this.createSubmissions.pipe(
          exhaustMap(({ ride, passengerId }) => {
            if (!this.rideData.canAcceptNewRequests(ride)) {
              return of({ rideFull: true as const });
            }

            const body = {
              rideId: ride.id,
              passengerId,
              status: 'pending' as const,
              createdAt: new Date().toISOString(),
            };

            return this.http.post<RideRequest>(`${environment.apiUrl}/ride_requests`, body).pipe(
              tap((created) => this.requestsState.update((items) => [...items, created])),
              map((request) => ({ request })),
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
    const passengerId = computed(() => this.auth.currentUser()?.id);
    const query = computed(() => {
      const currentPassenger = passengerId();
      return currentPassenger ? { rideId: rideId(), passengerId: currentPassenger } : null;
    });
    const emission = toSignal(
      toObservable(query, { injector }).pipe(
        switchMap((selection) => {
          if (!selection) return EMPTY;

          return this.fetchPassengerRequest(selection.rideId, selection.passengerId).pipe(
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

  // TODO #6: Criação provisória de solicitações (createSubmissions / createResult / createRequest) usada antes da US03; conectar/substituir pelo fluxo do passageiro na Issue #6.
  createRequest(ride: Ride, passengerId: string): void {
    this.notice.message.set('');
    this.createSubmissions.next({ ride, passengerId });
  }

  cancelRide(ride: Ride): void {
    this.notice.message.set('');
    this.cancelSubmissions.next(ride);
  }

  reset(): void {
    this.requestsState.set([]);
    this.resets.next();
  }

  private fetchPassengerRequest(rideId: string, passengerId: string): Observable<PassengerRequestResult> {
    // _where preserva IDs textuais que o json-server converteria em filtros simples (ex.: "007").
    const where = { rideId: { eq: rideId }, passengerId: { eq: passengerId } };
    return this.http
      .get<RideRequest[]>(`${environment.apiUrl}/ride_requests`, {
        params: { _where: JSON.stringify(where) },
      })
      .pipe(
        map((requests): PassengerRequestResult => {
          const [latest] = requests
            .filter((request) => request.rideId === rideId && request.passengerId === passengerId)
            .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
          return { status: 'loaded', request: latest ?? null };
        }),
        catchError(() => of(passengerRequestError)),
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
