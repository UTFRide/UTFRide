import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Ride } from '../../../core/models/ride.model';
import { RideRequest } from '../../../core/models/ride-request.model';
import { RideData } from '../../../core/services/ride-data';
import { RideRequestData } from '../../../core/services/ride-request-data';
import { CurrencyBrlPipe } from '../../../shared/pipes/currency-brl-pipe';
import { RideRequestCard } from './ride-request-card';

@Component({
  selector: 'app-my-rides',
  imports: [RouterLink, CurrencyBrlPipe, RideRequestCard],
  templateUrl: './my-rides.html',
})
export class MyRides {
  private readonly rideData = inject(RideData);
  private readonly rideRequestData = inject(RideRequestData);
  private readonly destroyRef = inject(DestroyRef);

  readonly selectedRideId = signal<string | null>(null);
  readonly rides = this.rideData.driverRides;

  readonly selectedRide = computed<Ride | null>(() => {
    const rides = this.rides();
    const id = this.selectedRideId();
    return (id ? rides.find((ride) => ride.id === id) : undefined) ?? rides[0] ?? null;
  });

  readonly activeRideId = computed<string | null>(() => this.selectedRide()?.id ?? null);

  readonly rideRequests = computed<RideRequest[]>(() => {
    const rideId = this.activeRideId();
    if (!rideId) return [];
    return this.rideRequestData.requests().filter((request) => request.rideId === rideId);
  });

  readonly acceptedRequests = computed<RideRequest[]>(() =>
    this.rideRequests().filter((request) => request.status === 'accepted'),
  );

  readonly pendingRequests = computed<RideRequest[]>(() =>
    this.rideRequests().filter((request) => request.status === 'pending'),
  );

  readonly occupiedSeats = computed<number>(() => {
    const ride = this.selectedRide();
    if (!ride) return 0;
    return Math.max(0, ride.totalSeats - ride.availableSeats);
  });

  readonly occupancyPercentage = computed<number>(() => {
    const ride = this.selectedRide();
    if (!ride || ride.totalSeats <= 0) return 0;
    return Math.round((this.occupiedSeats() / ride.totalSeats) * 100);
  });

  readonly isBeforeDeparture = computed<boolean>(() => {
    const ride = this.selectedRide();
    if (!ride) return false;
    return new Date(ride.departureTime).getTime() > Date.now();
  });

  readonly canAcceptRequests = computed<boolean>(() => {
    const ride = this.selectedRide();
    if (!ride) return false;
    return this.rideData.canAcceptNewRequests(ride);
  });

  readonly isLastAvailableSeat = computed<boolean>(() => {
    const ride = this.selectedRide();
    return !!ride && ride.status === 'active' && ride.availableSeats === 1;
  });

  constructor() {
    this.rideData.resetDriverRides();
    this.rideRequestData.reset();
    this.rideData.loadDriverRides();
    this.destroyRef.onDestroy(() => {
      this.rideData.resetDriverRides();
      this.rideRequestData.reset();
    });
  }

  private readonly loadRequestsForActiveRide = effect(() => {
    const rideId = this.activeRideId();
    if (!rideId) return;
    this.rideRequestData.loadForRide(rideId);
  });

  selectRide(rideId: string): void {
    this.selectedRideId.set(rideId);
  }

  acceptRequest(request: RideRequest): void {
    const ride = this.selectedRide();
    if (!ride || !this.canAcceptRequests()) return;
    this.rideRequestData.accept(request, ride);
  }

  rejectRequest(request: RideRequest): void {
    const ride = this.selectedRide();
    if (!ride || !this.isBeforeDeparture()) return;
    this.rideRequestData.reject(request, ride);
  }
}
