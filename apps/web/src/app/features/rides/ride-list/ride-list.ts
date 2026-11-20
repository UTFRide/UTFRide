import { DatePipe } from '@angular/common';
import { Component, computed, inject, Injector, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RideData } from '../../../core/services/ride-data';
import { CurrencyBrlPipe } from '../../../shared/pipes/currency-brl-pipe';
import { InitialsPipe } from '../../../shared/pipes/initials-pipe';
import { RideFilters } from '../ride-filters/ride-filters';

@Component({
  imports: [DatePipe, RouterLink, CurrencyBrlPipe, InitialsPipe, RideFilters],
  templateUrl: './ride-list.html',
})
export class RideList {
  private readonly injector = inject(Injector);

  protected readonly origin = signal('');
  protected readonly destination = signal('');
  protected readonly date = signal('');
  protected readonly filtersOpen = signal(false);

  private readonly filters = computed(() => ({
    origin: this.origin(),
    destination: this.destination(),
    date: this.date(),
  }));

  protected readonly search = inject(RideData).searchAvailableRides(this.filters, this.injector);

  protected toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  protected clearFilters(): void {
    this.origin.set('');
    this.destination.set('');
    this.date.set('');
  }
}
