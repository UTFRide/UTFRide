import { DatePipe } from '@angular/common';
import { Component, inject, Injector, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RideData } from '../../../core/services/ride-data';
import { RideRequestData } from '../../../core/services/ride-request-data';
import { CurrencyBrlPipe } from '../../../shared/pipes/currency-brl-pipe';
import { InitialsPipe } from '../../../shared/pipes/initials-pipe';

@Component({
  imports: [DatePipe, RouterLink, CurrencyBrlPipe, InitialsPipe],
  selector: 'app-ride-detail',
  templateUrl: './ride-detail.html',
})
export class RideDetail {
  readonly id = input.required<string>();

  private readonly injector = inject(Injector);
  protected readonly detail = inject(RideData).loadRideDetail(this.id, this.injector);
  protected readonly passengerRequest = inject(RideRequestData).loadPassengerRequest(
    this.id,
    this.injector,
  );
}
