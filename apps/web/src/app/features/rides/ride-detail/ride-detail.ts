import { DatePipe } from '@angular/common';
import { Component, computed, inject, Injector, input, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map, startWith, Subject, switchMap } from 'rxjs';
import { AuthData } from '../../../core/services/auth-data';
import { NetworkStatus, OFFLINE_ACTION_MESSAGE } from '../../../core/services/network-status';
import { RideData, RideDetailResult } from '../../../core/services/ride-data';
import { isActiveRideRequest, RideRequestData } from '../../../core/services/ride-request-data';
import { CurrencyBrlPipe } from '../../../shared/pipes/currency-brl-pipe';
import { InitialsPipe } from '../../../shared/pipes/initials-pipe';
import { RideRequestConfirmPanel } from './ride-request-confirm-panel/ride-request-confirm-panel';

@Component({
  imports: [DatePipe, RouterLink, CurrencyBrlPipe, InitialsPipe, RideRequestConfirmPanel],
  selector: 'app-ride-detail',
  templateUrl: './ride-detail.html',
})
export class RideDetail {
  readonly id = input.required<string>();
  readonly initialDetail = input<RideDetailResult>();

  private readonly injector = inject(Injector);
  private readonly auth = inject(AuthData);
  private readonly requests = inject(RideRequestData);
  protected readonly network = inject(NetworkStatus);
  protected readonly offlineMessage = OFFLINE_ACTION_MESSAGE;
  private readonly selection = computed(() => ({
    rideId: this.id(),
    passenger: this.auth.currentUser(),
  }));
  private readonly detailRetry = linkedSignal({
    source: this.selection,
    computation: () => 0,
  });
  private readonly requestRetry = linkedSignal({
    source: this.selection,
    computation: () => 0,
  });
  private readonly loadedDetail = inject(RideData).loadRideDetail(
    this.id,
    this.injector,
    this.detailRetry,
    this.initialDetail,
  );
  private readonly loadedRequest = this.requests.loadPassengerRequest(
    this.id,
    this.injector,
    this.requestRetry,
  );
  private readonly confirmations = new Subject<void>();
  private readonly confirmationResult = toSignal(
    this.confirmations.pipe(
      switchMap(() => {
        const selection = this.selection();
        return this.requests
          .createRequest(selection.rideId, () => selection === this.selection())
          .pipe(
            startWith({ status: 'submitting' } as const),
            map((result) => ({ selection, result })),
          );
      }),
    ),
  );
  private readonly currentConfirmation = computed(() => {
    const confirmation = this.confirmationResult();
    return confirmation?.selection === this.selection() ? confirmation.result : undefined;
  });

  protected readonly confirmationOpen = linkedSignal({
    source: () => ({ selection: this.selection(), offline: this.network.isOffline() }),
    computation: (source, previous): boolean => {
      if (source.offline) return false;
      if (previous && previous.source.selection === source.selection) {
        return previous.value;
      }
      return false;
    },
  });
  protected readonly submitting = computed(
    () => this.currentConfirmation()?.status === 'submitting',
  );

  protected readonly detail = computed(() => {
    const detail = this.loadedDetail();
    const confirmation = this.currentConfirmation();
    const request = this.loadedRequest();
    if (confirmation?.status === 'ride-not-found' || request.status === 'ride-not-found') {
      return { status: 'not-found' } as const;
    }
    const ride =
      confirmation && 'ride' in confirmation
        ? confirmation.ride
        : request.revalidatedRide;
    if (detail.status !== 'loaded' || !ride) return detail;

    return {
      status: 'loaded' as const,
      ride: { ...ride, driver: ride.driverId === detail.ride.driverId ? detail.ride.driver : null },
    };
  });

  protected readonly passengerRequest = computed(() => {
    const confirmation = this.currentConfirmation();
    return confirmation && 'request' in confirmation
      ? { status: 'loaded' as const, request: confirmation.request }
      : this.loadedRequest();
  });

  protected readonly requestBlockReason = computed(() => {
    const detail = this.detail();
    return detail.status === 'loaded' ? this.requests.requestBlockReason(detail.ride) : null;
  });

  protected readonly passengerRestriction = this.auth.passengerRestriction;

  protected readonly canRequest = computed(() => {
    const request = this.passengerRequest();
    return (
      this.selection().passenger !== null &&
      this.passengerRestriction() === null &&
      request.status === 'loaded' &&
      !isActiveRideRequest(request.request) &&
      this.requestBlockReason() === null
    );
  });

  protected readonly confirmationError = computed(() => {
    const confirmation = this.currentConfirmation();
    switch (confirmation?.status) {
      case 'connection-error':
        return 'Falha de conexão ao enviar a solicitação.';
      case 'request-error':
        return 'Não foi possível enviar a solicitação.';
      case 'duplicate-check-error':
        return confirmation.connectionError
          ? 'Falha de conexão ao consultar o estado da solicitação existente.'
          : 'Não foi possível consultar o estado da solicitação existente.';
      case 'ride-refresh-error':
        return confirmation.connectionError
          ? 'Falha de conexão ao atualizar a disponibilidade da carona.'
          : 'Não foi possível atualizar a disponibilidade da carona.';
      default:
        return '';
    }
  });

  protected retryDetail(): void {
    if (this.detail().status === 'error' && !this.network.isOffline()) {
      this.detailRetry.update((attempt) => attempt + 1);
    }
  }

  protected retryRequestRead(): void {
    if (this.passengerRequest().status === 'error' && !this.network.isOffline()) {
      this.requestRetry.update((attempt) => attempt + 1);
    }
  }

  protected toggleConfirmation(): void {
    if (this.canRequest() && !this.submitting() && !this.network.isOffline()) {
      this.confirmationOpen.update((open) => !open);
    }
  }

  protected dismissConfirmation(trigger: HTMLButtonElement): void {
    if (this.submitting()) return;
    this.confirmationOpen.set(false);
    trigger.focus();
  }

  protected confirmRequest(): void {
    if (
      this.canRequest() &&
      this.confirmationOpen() &&
      !this.submitting() &&
      !this.network.isOffline()
    ) {
      this.confirmations.next();
    }
  }
}
