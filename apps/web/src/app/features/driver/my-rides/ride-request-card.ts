import { Component, computed, input, output } from '@angular/core';
import { RideRequest } from '../../../core/models/ride-request.model';

@Component({
  selector: 'app-ride-request-card',
  templateUrl: './ride-request-card.html',
})
export class RideRequestCard {
  readonly request = input.required<RideRequest>();
  readonly canAccept = input.required<boolean>();
  readonly canReject = input(true);
  readonly isLastSeat = input(false);

  readonly accepted = output<RideRequest>();
  readonly rejected = output<RideRequest>();

  readonly passengerInitials = computed(() => {
    const parts = this.request()
      .passengerId.trim()
      .split(/\s+/)
      .filter((part) => part.length > 0);
    if (parts.length === 0) return 'AL';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  });
}
