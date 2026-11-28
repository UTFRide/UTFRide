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
import { NetworkStatus, OFFLINE_ACTION_MESSAGE } from '../../../core/services/network-status';
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
  protected readonly network = inject(NetworkStatus);
  protected readonly offlineMessage = OFFLINE_ACTION_MESSAGE;

  private readonly cancelRideButton = viewChild<ElementRef<HTMLButtonElement>>('cancelRideButton');
  private readonly keepRideButton = viewChild<ElementRef<HTMLButtonElement>>('keepRideButton');
  private readonly deleteRideButton = viewChild<ElementRef<HTMLButtonElement>>('deleteRideButton');
  private readonly cancelDeleteButton = viewChild<ElementRef<HTMLButtonElement>>('cancelDeleteButton');
  private wasDialogOpen = false;
  private wasDeleteDialogOpen = false;

  readonly notifications = this.notificationData.userNotifications;
  readonly notificationsError = this.notificationData.loadError;
  readonly studentName = computed(() => this.authData.currentUser()?.name ?? 'Aluno UTFPR');
  readonly isBlockedStudent = this.authData.isBlocked;
  readonly authorizationError = signal<string | null>(null);
  readonly loadRidesError = signal<string | null>(null);
  readonly requestsError = signal<string | null>(null);
  readonly decisionError = signal<string | null>(null);
  readonly cancelError = signal<string | null>(null);
  readonly deleteError = signal<string | null>(null);
  readonly deleteSuccessMessage = signal<string | null>(null);
  readonly selectedRideId = signal<string | null>(null);
  readonly cancelConfirming = signal(false);
  readonly isCancelling = signal(false);
  readonly deleteConfirming = signal(false);
  readonly isDeleting = signal(false);
  readonly loggingOut = signal(false);
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
    if (this.network.isOffline()) return false;
    const ride = this.selectedRide();
    if (!ride) return false;
    return this.rideData.canManageRide(ride) && this.rideData.canAcceptNewRequests(ride);
  });

  readonly canManageSelectedRide = computed<boolean>(() => {
    if (this.network.isOffline()) return false;
    const ride = this.selectedRide();
    return !!ride && this.rideData.canCancel(ride);
  });

  readonly isLastAvailableSeat = computed<boolean>(() => {
    const ride = this.selectedRide();
    return !!ride && ride.status === 'active' && ride.availableSeats === 1;
  });

  readonly canEditSelectedRide = computed<boolean>(() => this.canManageSelectedRide());

  readonly canCancelSelectedRide = computed<boolean>(() => this.canManageSelectedRide());

  readonly canDeleteSelectedRide = computed<boolean>(() => {
    if (this.network.isOffline()) return false;
    const ride = this.selectedRide();
    return !!ride && this.rideData.canDelete(ride);
  });

  constructor() {
    this.rideData.resetDriverRides();
    this.rideData.resetDelete();
    this.rideRequestData.reset();
    this.rideData.loadDriverRides();
    this.destroyRef.onDestroy(() => {
      this.resetDeleteState();
      this.rideData.resetDriverRides();
      this.rideRequestData.reset();
    });
  }

  private readonly handleDeleteResult = effect(() => {
    const result = this.rideData.deleteResult();
    if (!result) return;
    this.isDeleting.set(false);
    if ('deletedRideId' in result) {
      this.deleteError.set(null);
      this.deleteConfirming.set(false);
      if (this.selectedRideId() === result.deletedRideId) {
        this.selectedRideId.set(null);
      }
      if (!this.activeManagedRideId()) {
        this.rideRequestData.reset();
      }
      this.deleteSuccessMessage.set('Oferta excluída definitivamente.');
    } else if ('unauthorized' in result) {
      this.deleteError.set(null);
      this.deleteConfirming.set(false);
      this.authorizationError.set(this.deleteUnauthorizedMessage());
    } else if ('connectionError' in result) {
      this.deleteError.set(
        'Falha de conexão ao excluir a oferta. Verifique sua internet e tente novamente.',
      );
    } else if ('invalidState' in result) {
      const message = 'Apenas ofertas canceladas podem ser excluídas definitivamente.';
      if (this.deleteConfirming()) {
        this.deleteError.set(message);
      } else {
        this.authorizationError.set(message);
      }
    } else if ('requestError' in result) {
      this.deleteError.set('Não foi possível excluir a oferta. Tente novamente.');
    }
  });

  private readonly loadRequestsForActiveRide = effect(() => {
    const rideId = this.activeManagedRideId();
    if (!rideId) return;
    untracked(() => this.rideRequestData.loadForRide(rideId));
  });

  private readonly handleDriverRidesResult = effect(() => {
    const result = this.rideData.driverRidesResult();
    if (!result) return;
    if ('unauthorized' in result) {
      this.loadRidesError.set(null);
      this.authorizationError.set(
        this.authData.isBlocked()
          ? 'Sua conta está bloqueada e não pode gerenciar ou ofertar caronas.'
          : 'Você não tem permissão para gerenciar ofertas de carona.',
      );
    } else if ('connectionError' in result) {
      this.loadRidesError.set(
        'Falha de conexão ao carregar suas ofertas. Verifique sua internet e tente novamente.',
      );
    } else if ('requestError' in result) {
      this.loadRidesError.set('Não foi possível carregar suas ofertas. Tente novamente.');
    } else if ('rides' in result) {
      this.authorizationError.set(null);
      this.loadRidesError.set(null);
    }
  });

  private readonly handleLoadRequestsResult = effect(() => {
    const result = this.rideRequestData.loadResult();
    if (!result) return;
    if ('unauthorized' in result) {
      this.requestsError.set(null);
      this.authorizationError.set(
        'Apenas o motorista autor com conta ativa pode consultar solicitações desta oferta.',
      );
    } else if ('connectionError' in result) {
      this.requestsError.set(
        'Falha de conexão ao carregar solicitações. Verifique sua internet e tente novamente.',
      );
    } else if ('requestError' in result) {
      this.requestsError.set('Não foi possível carregar as solicitações. Tente novamente.');
    } else if ('requests' in result) {
      this.requestsError.set(null);
    }
  });

  private readonly handleDecisionResult = effect(() => {
    const result = this.rideRequestData.decisionResult();
    if (!result) return;
    if ('unauthorized' in result) {
      this.decisionError.set(null);
      this.authorizationError.set(
        'Apenas o motorista autor com conta ativa pode decidir solicitações desta oferta.',
      );
    } else if ('connectionError' in result) {
      this.decisionError.set(
        'Falha de conexão ao atualizar a solicitação. Verifique sua internet e tente novamente.',
      );
    } else if ('requestError' in result || 'invalidState' in result || 'noAvailableSeats' in result) {
      this.decisionError.set('Não foi possível atualizar a solicitação. Tente novamente.');
    } else if ('request' in result) {
      this.decisionError.set(null);
    }
  });

  private readonly handleCancelResult = effect(() => {
    const result = this.rideRequestData.cancelResult();
    if (!result) return;
    this.isCancelling.set(false);
    if ('ride' in result) {
      this.cancelError.set(null);
      this.cancelConfirming.set(false);
    } else if ('unauthorized' in result) {
      this.cancelError.set(null);
      this.cancelConfirming.set(false);
      this.authorizationError.set(
        'Apenas o motorista autor com conta ativa pode cancelar esta oferta.',
      );
    } else if ('connectionError' in result) {
      this.cancelError.set(
        'Falha de conexão ao cancelar a oferta. Verifique sua internet e tente novamente.',
      );
    } else if ('requestError' in result || 'invalidState' in result) {
      this.cancelError.set('Não foi possível cancelar a oferta. Tente novamente.');
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

  private readonly syncDeleteDialogFocus = effect(() => {
    const isOpen = this.deleteConfirming();
    const cancelButton = this.cancelDeleteButton();

    if (isOpen && cancelButton) {
      cancelButton.nativeElement.focus();
      this.wasDeleteDialogOpen = true;
      return;
    }

    if (!isOpen && this.wasDeleteDialogOpen) {
      this.wasDeleteDialogOpen = false;
      const trigger = this.deleteRideButton()?.nativeElement;
      if (trigger && !trigger.disabled) {
        trigger.focus();
      }
    }
  });

  selectRide(rideId: string): void {
    this.cancelConfirming.set(false);
    this.cancelError.set(null);
    this.resetDeleteState();
    this.requestsError.set(null);
    this.decisionError.set(null);
    this.authorizationError.set(null);
    this.selectedRideId.set(rideId);
  }

  retryLoadRides(): void {
    if (this.network.isOffline()) return;
    this.loadRidesError.set(null);
    this.rideData.loadDriverRides();
  }

  retryLoadRequests(): void {
    if (this.network.isOffline()) return;
    const rideId = this.activeManagedRideId();
    if (!rideId) return;
    this.requestsError.set(null);
    this.rideRequestData.loadForRide(rideId);
  }

  loadNotifications(): void {
    this.notificationData.loadForCurrentUser();
  }

  async logout(): Promise<void> {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    try {
      await this.authData.logout();
      await this.router.navigateByUrl('/login');
    } finally {
      this.loggingOut.set(false);
    }
  }

  editSelectedRide(): void {
    const ride = this.selectedRide();
    if (!ride || this.network.isOffline()) return;
    this.authorizationError.set(null);
    this.deleteSuccessMessage.set(null);
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
    if (!ride || this.deleteConfirming() || this.network.isOffline()) return;
    this.authorizationError.set(null);
    this.cancelError.set(null);
    this.deleteSuccessMessage.set(null);
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
    this.cancelError.set(null);
    this.cancelConfirming.set(false);
  }

  confirmCancelRide(): void {
    const ride = this.selectedRide();
    if (!ride || this.isCancelling() || this.network.isOffline()) return;
    this.authorizationError.set(null);
    this.cancelError.set(null);
    if (!this.rideData.canManageRide(ride)) {
      this.isCancelling.set(true);
      this.rideRequestData.cancelRide(ride);
      return;
    }
    if (!this.canCancelSelectedRide()) return;
    this.isCancelling.set(true);
    this.rideRequestData.cancelRide(ride);
  }

  openDeleteConfirmation(): void {
    const ride = this.selectedRide();
    if (!ride || this.cancelConfirming() || this.network.isOffline()) return;
    this.authorizationError.set(null);
    this.deleteError.set(null);
    this.deleteSuccessMessage.set(null);
    if (!this.rideData.canManageRide(ride)) {
      this.authorizationError.set(this.deleteUnauthorizedMessage());
      return;
    }
    if (!this.canDeleteSelectedRide()) {
      this.authorizationError.set(
        'Apenas ofertas canceladas podem ser excluídas definitivamente.',
      );
      return;
    }
    this.deleteConfirming.set(true);
  }

  private resetDeleteState(): void {
    this.deleteConfirming.set(false);
    this.isDeleting.set(false);
    this.deleteError.set(null);
    this.deleteSuccessMessage.set(null);
    this.rideData.resetDelete();
  }

  private deleteUnauthorizedMessage(): string {
    return this.authData.isBlocked()
      ? 'Sua conta está bloqueada e não pode excluir ofertas de carona.'
      : 'Apenas o motorista autor com conta ativa pode excluir esta oferta.';
  }

  closeDeleteConfirmation(): void {
    if (this.isDeleting()) return;
    this.deleteError.set(null);
    this.deleteConfirming.set(false);
  }

  confirmDeleteRide(): void {
    const ride = this.selectedRide();
    if (!ride || this.isDeleting() || this.network.isOffline()) return;
    this.authorizationError.set(null);
    this.deleteError.set(null);
    this.deleteSuccessMessage.set(null);
    this.isDeleting.set(true);
    this.rideData.deleteRide(ride);
  }

  acceptRequest(request: RideRequest): void {
    const ride = this.selectedRide();
    if (!ride || this.network.isOffline()) return;
    this.authorizationError.set(null);
    this.decisionError.set(null);
    if (!this.rideData.canManageRide(ride)) {
      this.rideRequestData.accept(request, ride);
      return;
    }
    if (!this.canAcceptRequests()) return;
    this.rideRequestData.accept(request, ride);
  }

  rejectRequest(request: RideRequest): void {
    const ride = this.selectedRide();
    if (!ride || this.network.isOffline()) return;
    this.authorizationError.set(null);
    this.decisionError.set(null);
    if (!this.rideData.canManageRide(ride)) {
      this.rideRequestData.reject(request, ride);
      return;
    }
    if (!this.canManageSelectedRide()) return;
    this.rideRequestData.reject(request, ride);
  }
}
