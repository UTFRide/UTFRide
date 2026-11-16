import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Ride } from '../../../core/models/ride.model';
import { RideRequest } from '../../../core/models/ride-request.model';
import { RideData } from '../../../core/services/ride-data';
import { RideRequestData } from '../../../core/services/ride-request-data';
import { CurrencyBrlPipe } from '../../../shared/pipes/currency-brl-pipe';
import { formatPassengerInitials, RideRequestCard } from './ride-request-card';

@Component({
  selector: 'app-my-rides',
  imports: [RouterLink, CurrencyBrlPipe, RideRequestCard],
  templateUrl: './my-rides.html',
})
export class MyRides {
  private readonly rideData = inject(RideData);
  private readonly rideRequestData = inject(RideRequestData);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly cancelRideButton = viewChild<ElementRef<HTMLButtonElement>>('cancelRideButton');
  private readonly keepRideButton = viewChild<ElementRef<HTMLButtonElement>>('keepRideButton');
  private wasDialogOpen = false;

  readonly selectedRideId = signal<string | null>(null);
  readonly cancelConfirming = signal(false);
  readonly isCancelling = signal(false);
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

  readonly notifiablePassengers = computed<string[]>(() => {
    const names = [
      ...this.acceptedRequests().map((request) => request.passengerId),
      ...this.pendingRequests().map((request) => request.passengerId),
    ];
    return [...new Set(names.filter((name) => name.trim().length > 0))];
  });

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

  readonly canAcceptRequests = computed<boolean>(() => {
    const ride = this.selectedRide();
    if (!ride) return false;
    return this.rideData.canAcceptNewRequests(ride);
  });

  readonly canManageSelectedRide = computed<boolean>(() => {
    const ride = this.selectedRide();
    return !!ride && this.rideData.canCancel(ride);
  });

  readonly isLastAvailableSeat = computed<boolean>(() => {
    const ride = this.selectedRide();
    return !!ride && ride.status === 'active' && ride.availableSeats === 1;
  });

  readonly canEditSelectedRide = computed<boolean>(() => this.canManageSelectedRide());

  readonly canCancelSelectedRide = computed<boolean>(() => this.canManageSelectedRide());

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

  private readonly handleCancelResult = effect(() => {
    const result = this.rideRequestData.cancelResult();
    if (!result) return;
    this.isCancelling.set(false);
    if ('ride' in result) {
      this.cancelConfirming.set(false);
    }
  });

  private readonly syncDialogFocus = effect(() => {
    const isOpen = this.cancelConfirming();
    const keepButton = this.keepRideButton();

    if (isOpen && keepButton) {
      keepButton.nativeElement.focus();
      this.wasDialogOpen = true;
      return;
    }

    if (!isOpen && this.wasDialogOpen) {
      this.wasDialogOpen = false;
      const trigger = this.cancelRideButton()?.nativeElement;
      if (trigger && !trigger.disabled) {
        trigger.focus();
      }
    }
  });

  selectRide(rideId: string): void {
    this.cancelConfirming.set(false);
    this.selectedRideId.set(rideId);
  }

  passengerInitials(passengerId: string): string {
    return formatPassengerInitials(passengerId);
  }

  editSelectedRide(): void {
    const ride = this.selectedRide();
    if (!ride || !this.canEditSelectedRide()) return;
    this.rideData.startEditing(ride);
    void this.router.navigate(['/driver/offer'], { queryParams: { rideId: ride.id } });
  }

  openCancelConfirmation(): void {
    if (!this.canCancelSelectedRide()) return;
    this.cancelConfirming.set(true);
  }

  closeCancelConfirmation(): void {
    if (this.isCancelling()) return;
    this.cancelConfirming.set(false);
  }

  confirmCancelRide(): void {
    const ride = this.selectedRide();
    if (!ride || !this.canCancelSelectedRide() || this.isCancelling()) return;
    this.isCancelling.set(true);
    this.rideRequestData.cancelRide(ride);
  }

  acceptRequest(request: RideRequest): void {
    const ride = this.selectedRide();
    if (!ride || !this.canAcceptRequests()) return;
    this.rideRequestData.accept(request, ride);
  }

  rejectRequest(request: RideRequest): void {
    const ride = this.selectedRide();
    if (!ride || !this.canManageSelectedRide()) return;
    this.rideRequestData.reject(request, ride);
  }
}
