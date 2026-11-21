import { Component, effect, inject, model } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { LocationData } from '../../../core/services/location-data';

@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-ride-filters',
  templateUrl: './ride-filters.html',
})
export class RideFilters {
  readonly origin = model<string>('');
  readonly destination = model<string>('');
  readonly date = model<string>('');
  protected readonly suggestions = inject(LocationData).suggestions;

  protected readonly form = new FormGroup({
    origin: new FormControl('', { nonNullable: true }),
    destination: new FormControl('', { nonNullable: true }),
    date: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      const { origin, destination, date } = this.form.getRawValue();
      this.origin.set(origin);
      this.destination.set(destination);
      this.date.set(date);
    });

    effect(() => {
      const filters = {
        origin: this.origin(),
        destination: this.destination(),
        date: this.date(),
      };
      const { origin, destination, date } = this.form.getRawValue();
      if (
        origin !== filters.origin ||
        destination !== filters.destination ||
        date !== filters.date
      ) {
        this.form.setValue(filters, { emitEvent: false });
      }
    });
  }
}
