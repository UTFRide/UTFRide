import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Ride } from '../../../core/models/ride.model';
import { RideRequest } from '../../../core/models/ride-request.model';
import { AuthData } from '../../../core/services/auth-data';
import { NotificationData } from '../../../core/services/notification-data';
import { RideData } from '../../../core/services/ride-data';
import { RideRequestData } from '../../../core/services/ride-request-data';
import { NotificationBell } from '../../../shared/components/notification-bell/notification-bell';
import { CurrencyBrlPipe } from '../../../shared/pipes/currency-brl-pipe';
import { InitialsPipe } from '../../../shared/pipes/initials-pipe';
import { RideRequestCard } from './ride-request-card';

@Component({
  selector: 'app-my-rides',
  imports: [RouterLink, CurrencyBrlPipe, RideRequestCard, NotificationBell, InitialsPipe],
  templateUrl: './my-rides.html',
})
export class MyRides {
  private readonly authData = inject(AuthData);
  private readonly notificationData = inject(NotificationData);
  private readonly rideData = inject(RideData);
  private readonly rideRequestData = inject(RideRequestData);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly cancelRideButton = viewChild<ElementRef<HTMLButtonElement>>('cancelRideButton');
  private readonly keepRideButton = viewChild<ElementRef<HTMLButtonElement>>('keepRideButton');
  private wasDialogOpen = false;

  readonly notifications = this.notificationData.userNotifications;
  readonly notificationsError = this.notificationData.loadError;
  readonly studentName = computed(() => this.authData.currentUser()?.name ?? 'Aluno UTFPR');
  readonly isBlockedStudent = this.authData.isBlocked;
  readonly authorizationError = signal<string | null>(null);
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

  private readonly activeManagedRideId = computed<string | null>(() => {
    const ride = this.selectedRide();
    if (!ride || !this.rideData.canManageRide(ride)) return null;
    return ride.id;
  });

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
    return this.rideData.canManageRide(ride) && this.rideData.canAcceptNewRequests(ride);
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
    const rideId = this.activeManagedRideId();
    if (!rideId) return;
    untracked(() => this.rideRequestData.loadForRide(rideId));
  });

  private readonly handleDriverRidesResult = effect(() => {
    const result = this.rideData.driverRidesResult();
    if (!result) return;
    if ('unauthorized' in result) {
      this.authorizationError.set(
        this.authData.isBlocked()
          ? 'Sua conta está bloqueada e não pode gerenciar ou ofertar caronas.'
          : 'Você não tem permissão para gerenciar ofertas de carona.',
      );
    } else if ('rides' in result) {
      this.authorizationError.set(null);
    }
  });

  private readonly handleLoadRequestsResult = effect(() => {
    const result = this.rideRequestData.loadResult();
    if (!result) return;
    if ('unauthorized' in result) {
      this.authorizationError.set(
        'Apenas o motorista autor com conta ativa pode consultar solicitações desta oferta.',
      );
    }
  });

  private readonly handleDecisionResult = effect(() => {
    const result = this.rideRequestData.decisionResult();
    if (!result) return;
    if ('unauthorized' in result) {
      this.authorizationError.set(
        'Apenas o motorista autor com conta ativa pode decidir solicitações desta oferta.',
      );
    }
  });

  private readonly handleCancelResult = effect(() => {
    const result = this.rideRequestData.cancelResult();
    if (!result) return;
    this.isCancelling.set(false);
    if ('ride' in result) {
      this.cancelConfirming.set(false);
    } else if ('unauthorized' in result) {
      this.cancelConfirming.set(false);
      this.authorizationError.set(
        'Apenas o motorista autor com conta ativa pode cancelar esta oferta.',
      );
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
    this.authorizationError.set(null);
    this.selectedRideId.set(rideId);
  }

  loadNotifications(): void {
    this.notificationData.loadForCurrentUser();
  }

  editSelectedRide(): void {
    const ride = this.selectedRide();
    if (!ride) return;
    this.authorizationError.set(null);
    if (!this.rideData.canManageRide(ride)) {
      this.authorizationError.set(
        'Apenas o motorista autor com conta ativa pode editar esta oferta.',
      );
      return;
    }
    if (!this.canEditSelectedRide() || !this.rideData.startEditing(ride)) {
      return;
    }
    void this.router.navigate(['/driver/offer'], { queryParams: { rideId: ride.id } });
  }

  openCancelConfirmation(): void {
    const ride = this.selectedRide();
    if (!ride) return;
    this.authorizationError.set(null);
    if (!this.rideData.canManageRide(ride)) {
      this.authorizationError.set(
        'Apenas o motorista autor com conta ativa pode cancelar esta oferta.',
      );
      return;
    }
    if (!this.canCancelSelectedRide()) return;
    this.cancelConfirming.set(true);
  }

  closeCancelConfirmation(): void {
    if (this.isCancelling()) return;
    this.cancelConfirming.set(false);
  }

  confirmCancelRide(): void {
    const ride = this.selectedRide();
    if (!ride || this.isCancelling()) return;
    this.authorizationError.set(null);
    if (!this.rideData.canManageRide(ride)) {
      this.isCancelling.set(true);
      this.rideRequestData.cancelRide(ride);
      return;
    }
    if (!this.canCancelSelectedRide()) return;
    this.isCancelling.set(true);
    this.rideRequestData.cancelRide(ride);
  }

  acceptRequest(request: RideRequest): void {
    const ride = this.selectedRide();
    if (!ride) return;
    this.authorizationError.set(null);
    if (!this.rideData.canManageRide(ride)) {
      this.rideRequestData.accept(request, ride);
      return;
    }
    if (!this.canAcceptRequests()) return;
    this.rideRequestData.accept(request, ride);
  }

  rejectRequest(request: RideRequest): void {
    const ride = this.selectedRide();
    if (!ride) return;
    this.authorizationError.set(null);
    if (!this.rideData.canManageRide(ride)) {
      this.rideRequestData.reject(request, ride);
      return;
    }
    if (!this.canManageSelectedRide()) return;
    this.rideRequestData.reject(request, ride);
  }
}
