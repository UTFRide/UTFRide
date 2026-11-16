import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, exhaustMap, map, of, startWith, Subject, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Ride } from '../models/ride.model';
import { RideRequest } from '../models/ride-request.model';
import { AuthData } from './auth-data';
import { ErrorNotice } from './error-notice';
import { RideData, RideErrorResult } from './ride-data';

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

export type LoadRideRequestsResult = { requests: RideRequest[] } | RideErrorResult;

@Injectable({ providedIn: 'root' })
export class RideRequestData {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthData);
  private readonly rideData = inject(RideData);
  private readonly notice = inject(ErrorNotice);

  private readonly loadRideIds = new Subject<string>();
  private readonly decisionSubmissions = new Subject<{
    type: 'accept' | 'reject';
    request: RideRequest;
    ride: Ride;
  }>();
  private readonly createSubmissions = new Subject<{ ride: Ride; passengerId: string }>();
  private readonly resets = new Subject<void>();
  private readonly requestsState = signal<RideRequest[]>([]);

  readonly requests = computed(() => this.requestsState());

  readonly loadResult = toSignal<LoadRideRequestsResult | undefined>(
    this.resets.pipe(
      startWith(undefined),
      switchMap(() =>
        this.loadRideIds.pipe(
          switchMap((rideId) =>
            this.http
              .get<RideRequest[]>(`${environment.apiUrl}/ride_requests`, { params: { rideId } })
              .pipe(
                tap((requests) => this.requestsState.set(requests)),
                map((requests) => ({ requests })),
                catchError((error: unknown) => of(this.mapError(error))),
              ),
          ),
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
            const driver = this.auth.currentUser();
            if (!driver || driver.isBlocked || driver.id !== ride.driverId) {
              return of({ unauthorized: true as const });
            }

            if (
              request.rideId !== ride.id ||
              request.status !== 'pending' ||
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
                  catchError((error: unknown) => of(this.mapError(error))),
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

  loadForRide(rideId: string): void {
    this.notice.message.set('');
    this.loadRideIds.next(rideId);
  }

  accept(request: RideRequest, ride: Ride): void {
    this.notice.message.set('');
    this.decisionSubmissions.next({ type: 'accept', request, ride });
  }

  reject(request: RideRequest, ride: Ride): void {
    this.notice.message.set('');
    this.decisionSubmissions.next({ type: 'reject', request, ride });
  }

  createRequest(ride: Ride, passengerId: string): void {
    this.notice.message.set('');
    this.createSubmissions.next({ ride, passengerId });
  }

  reset(): void {
    this.requestsState.set([]);
    this.resets.next();
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
