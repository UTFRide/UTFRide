import { Component, input, output } from '@angular/core';
import { RideRequest } from '../../../core/models/ride-request.model';
import { InitialsPipe } from '../../../shared/pipes/initials-pipe';

@Component({
  selector: 'app-ride-request-card',
  imports: [InitialsPipe],
  templateUrl: './ride-request-card.html',
})
export class RideRequestCard {
  readonly request = input.required<RideRequest>();
  readonly canAccept = input.required<boolean>();
  readonly canReject = input(true);
  readonly isLastSeat = input(false);

  readonly accepted = output<RideRequest>();
  readonly rejected = output<RideRequest>();
}
