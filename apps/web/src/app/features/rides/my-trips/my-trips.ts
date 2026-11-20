import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  linkedSignal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { RideRequestStatus } from '../../../core/models/ride-request.model';
import { AuthData } from '../../../core/services/auth-data';
import { PassengerTripSummary, RideRequestData } from '../../../core/services/ride-request-data';
import { CurrencyBrlPipe } from '../../../shared/pipes/currency-brl-pipe';
import { InitialsPipe } from '../../../shared/pipes/initials-pipe';

type TripGroup = 'pending' | 'confirmed' | 'history';
type TripCardStatus = RideRequestStatus | 'completed' | 'ride-cancelled' | 'unavailable';

interface TripCard {
  trip: PassengerTripSummary;
  status: TripCardStatus;
}

function tripStatus(trip: PassengerTripSummary): TripCardStatus {
  if (trip.status === 'cancelled' || trip.status === 'rejected') return trip.status;

  switch (trip.ride?.status) {
    case 'active':
    case 'full':
      return trip.status;
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'ride-cancelled';
    default:
      return 'unavailable';
  }
}

@Component({
  imports: [DatePipe, RouterLink, CurrencyBrlPipe, InitialsPipe],
  selector: 'app-my-trips',
  templateUrl: './my-trips.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyTrips {
  private readonly auth = inject(AuthData);
  private readonly requests = inject(RideRequestData);
  protected readonly loadResult = this.requests.loadPassengerTrips(inject(Injector));
  private readonly trips = computed(() => {
    const result = this.loadResult();
    return result.status === 'loaded' ? result.trips : [];
  });

  protected readonly cancellation = this.requests.passengerCancellation;
  protected readonly cancelling = computed(() => this.cancellation()?.status === 'cancelling');
  protected readonly cancellationError = computed(() => {
    switch (this.cancellation()?.status) {
      case 'connection-error':
        return 'Falha de conexão ao cancelar a solicitação.';
      case 'invalid-state':
        return 'Somente solicitações pendentes podem ser canceladas.';
      case 'not-owned':
      case 'request-error':
        return 'Não foi possível cancelar a solicitação.';
      default:
        return '';
    }
  });

  protected readonly passengerRestriction = this.auth.passengerRestriction;
  protected readonly selectedGroup = linkedSignal({
    source: this.auth.currentUser,
    computation: (): TripGroup => 'pending',
  });
  protected readonly tabs = [
    { group: 'pending', label: 'Pendentes' },
    { group: 'confirmed', label: 'Confirmadas' },
    { group: 'history', label: 'Histórico' },
  ] as const;
  protected readonly groups = computed(() => {
    const groups: Record<TripGroup, TripCard[]> = { pending: [], confirmed: [], history: [] };
    for (const trip of this.trips()) {
      const status = tripStatus(trip);
      switch (status) {
        case 'pending':
          groups.pending.push({ trip, status });
          break;
        case 'accepted':
          groups.confirmed.push({ trip, status });
          break;
        default:
          groups.history.push({ trip, status });
      }
    }
    return groups;
  });

  protected cancelTrip(trip: PassengerTripSummary): void {
    if (
      !this.auth.currentUser() ||
      this.passengerRestriction() ||
      this.cancelling() ||
      !this.trips().includes(trip) ||
      tripStatus(trip) !== 'pending' ||
      !window.confirm('Deseja cancelar sua solicitação de vaga?')
    ) {
      return;
    }

    this.requests.cancelPassengerTrip(trip.id);
  }

  protected whatsappLink(phone: string): string | null {
    const digits = phone.replace(/\D/g, '');
    if (/^55\d{10,11}$/.test(digits)) return `https://wa.me/${digits}`;
    return /^\d{10,11}$/.test(digits) ? `https://wa.me/55${digits}` : null;
  }
}
