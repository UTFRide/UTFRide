import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Ride } from '../../../core/models/ride.model';
import { RideData } from '../../../core/services/ride-data';
import { CurrencyBrlPipe } from '../../../shared/pipes/currency-brl-pipe';

function requiredTrimmed(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim().length > 0 ? null : { required: true };
}

function integerValidator(control: AbstractControl<number | null>): ValidationErrors | null {
  if (control.value === null) return null;
  return Number.isInteger(control.value) ? null : { integer: true };
}

function parseLocalDateTime(dateStr: string, timeStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(timeStr)) {
    return null;
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute
  ) {
    return null;
  }
  return parsed;
}

function futureDepartureValidator(control: AbstractControl): ValidationErrors | null {
  const departureDate = control.get('departureDate')?.value as string | undefined;
  const departureTime = control.get('departureTime')?.value as string | undefined;
  if (!departureDate || !departureTime) return null;
  const parsed = parseLocalDateTime(departureDate, departureTime);
  if (!parsed || parsed.getTime() <= Date.now()) {
    return { nonFutureDeparture: true };
  }
  return null;
}

function defaultTomorrowDate(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

@Component({
  selector: 'app-offer-ride',
  imports: [ReactiveFormsModule, RouterLink, CurrencyBrlPipe],
  templateUrl: './offer-ride.html',
})
export class OfferRide {
  private readonly rideData = inject(RideData);
  private readonly destroyRef = inject(DestroyRef);

  readonly seatOptions = [1, 2, 3, 4] as const;
  readonly campusOptions = [
    { label: 'Sede Centro', value: 'UTFPR - Sede Centro (Av. Sete de Setembro)' },
    { label: 'Sede Ecoville', value: 'UTFPR - Sede Ecoville (R. Dep. Heitor Alencar Furtado)' },
    { label: 'Sede Neoville', value: 'UTFPR - Sede Neoville (R. Pedro Gusso)' },
  ] as const;

  readonly loading = signal(false);
  readonly submitAttempted = signal(false);
  readonly publishedRide = signal<Ride | null>(null);

  readonly form = new FormGroup(
    {
      origin: new FormControl('', { nonNullable: true, validators: [requiredTrimmed] }),
      destination: new FormControl('', { nonNullable: true, validators: [requiredTrimmed] }),
      notes: new FormControl('', { nonNullable: true }),
      departureDate: new FormControl(defaultTomorrowDate(), { nonNullable: true, validators: [Validators.required] }),
      departureTime: new FormControl('07:15', { nonNullable: true, validators: [Validators.required] }),
      totalSeats: new FormControl<number | null>(3, {
        validators: [Validators.required, Validators.min(1), Validators.max(4), integerValidator],
      }),
      pricePerSeat: new FormControl<number | null>(8, {
        validators: [Validators.required, Validators.min(0)],
      }),
    },
    { validators: futureDepartureValidator },
  );

  constructor() {
    this.rideData.resetPublish();
    this.destroyRef.onDestroy(() => this.rideData.resetPublish());
  }

  private readonly handlePublishResult = effect(() => {
    const result = this.rideData.publishResult();
    if (!result) return;
    this.loading.set(false);
    if ('ride' in result) {
      this.publishedRide.set(result.ride);
    }
  });

  setDestination(destination: string): void {
    this.form.controls.destination.setValue(destination);
    this.form.controls.destination.markAsDirty();
    this.form.controls.destination.markAsTouched();
  }

  selectSeats(seats: number): void {
    this.form.controls.totalSeats.setValue(seats);
    this.form.controls.totalSeats.markAsDirty();
    this.form.controls.totalSeats.markAsTouched();
  }

  isFieldInvalid(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.dirty || control.touched || this.submitAttempted());
  }

  hasNonFutureDateError(): boolean {
    const { departureDate, departureTime } = this.form.controls;
    const interacted =
      departureDate.dirty ||
      departureDate.touched ||
      departureTime.dirty ||
      departureTime.touched ||
      this.submitAttempted();
    return this.form.hasError('nonFutureDeparture') && interacted;
  }

  resetForAnotherRide(): void {
    this.publishedRide.set(null);
    this.submitAttempted.set(false);
    this.rideData.resetPublish();
    this.form.reset({
      origin: '',
      destination: '',
      notes: '',
      departureDate: defaultTomorrowDate(),
      departureTime: '07:15',
      totalSeats: 3,
      pricePerSeat: 8,
    });
  }

  submit(): void {
    this.submitAttempted.set(true);
    this.form.updateValueAndValidity();
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;

    const { origin, destination, notes, departureDate, departureTime, totalSeats, pricePerSeat } =
      this.form.getRawValue();
    const departure = parseLocalDateTime(departureDate, departureTime);
    if (!departure || departure.getTime() <= Date.now() || totalSeats === null || pricePerSeat === null) {
      return;
    }

    this.loading.set(true);
    this.rideData.publish({
      origin,
      destination,
      departureTime: departure.toISOString(),
      totalSeats,
      pricePerSeat,
      notes,
    });
  }
}
