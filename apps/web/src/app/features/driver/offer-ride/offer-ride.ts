import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
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

function formatLocalDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLocalTimeInput(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
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
  return formatLocalDateInput(tomorrow);
}

@Component({
  selector: 'app-offer-ride',
  imports: [ReactiveFormsModule, RouterLink, CurrencyBrlPipe],
  templateUrl: './offer-ride.html',
})
export class OfferRide {
  private readonly rideData = inject(RideData);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private populatedRideId: string | null = null;

  readonly seatOptions = [1, 2, 3, 4] as const;
  readonly campusOptions = [
    { label: 'Sede Centro', value: 'UTFPR - Sede Centro (Av. Sete de Setembro)' },
    { label: 'Sede Ecoville', value: 'UTFPR - Sede Ecoville (R. Dep. Heitor Alencar Furtado)' },
    { label: 'Sede Neoville', value: 'UTFPR - Sede Neoville (R. Pedro Gusso)' },
  ] as const;

  readonly loading = signal(false);
  readonly submitAttempted = signal(false);
  readonly publishedRide = signal<Ride | null>(null);
  readonly editingRide = this.rideData.editingRide;
  readonly isEditMode = computed(() => this.editingRide() !== null);
  readonly hasConfirmedPassengers = computed(() => {
    const ride = this.editingRide();
    return !!ride && ride.availableSeats < ride.totalSeats;
  });
  readonly minAllowedSeats = computed(() => {
    const ride = this.editingRide();
    if (ride && ride.availableSeats < ride.totalSeats) {
      return ride.totalSeats;
    }
    return 1;
  });

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
    { validators: [futureDepartureValidator, (control) => this.confirmedPassengersValidator(control)] },
  );

  constructor() {
    this.rideData.resetPublish();
    this.rideData.resetUpdate();
    const routeRideId = this.route.snapshot.queryParamMap.get('rideId');
    const initialEditing = this.editingRide();
    if (initialEditing && (!routeRideId || initialEditing.id === routeRideId)) {
      this.populateFormFromRide(initialEditing);
    } else if (routeRideId) {
      const fromDriverRides = this.rideData.driverRides().find((item) => item.id === routeRideId);
      if (fromDriverRides) {
        this.rideData.startEditing(fromDriverRides);
        this.populateFormFromRide(fromDriverRides);
      } else {
        this.rideData.loadRideForEdit(routeRideId);
      }
    }
    this.destroyRef.onDestroy(() => {
      this.rideData.resetPublish();
      this.rideData.clearEditing();
    });
  }

  private readonly syncLoadedEditingRide = effect(() => {
    const ride = this.editingRide();
    if (!ride || this.populatedRideId === ride.id) return;
    this.populateFormFromRide(ride);
  });

  private readonly handlePublishResult = effect(() => {
    const result = this.rideData.publishResult();
    if (!result) return;
    this.loading.set(false);
    if ('ride' in result) {
      this.publishedRide.set(result.ride);
    }
  });

  private readonly handleUpdateResult = effect(() => {
    const result = this.rideData.updateResult();
    if (!result) return;
    this.loading.set(false);
    if ('ride' in result) {
      this.publishedRide.set(result.ride);
    }
  });

  private populateFormFromRide(ride: Ride): void {
    this.populatedRideId = ride.id;
    const departure = new Date(ride.departureTime);
    const hasValidDeparture = !Number.isNaN(departure.getTime());
    this.form.reset({
      origin: ride.origin,
      destination: ride.destination,
      notes: ride.notes ?? '',
      departureDate: hasValidDeparture ? formatLocalDateInput(departure) : defaultTomorrowDate(),
      departureTime: hasValidDeparture ? formatLocalTimeInput(departure) : '07:15',
      totalSeats: ride.totalSeats,
      pricePerSeat: ride.pricePerSeat,
    });
    if (ride.availableSeats < ride.totalSeats) {
      this.disableLockedControlsForConfirmedPassengers();
    } else {
      this.enableAllControls();
    }
    this.form.updateValueAndValidity();
  }

  private disableLockedControlsForConfirmedPassengers(): void {
    this.form.controls.origin.disable({ emitEvent: false });
    this.form.controls.destination.disable({ emitEvent: false });
    this.form.controls.notes.disable({ emitEvent: false });
    this.form.controls.departureDate.disable({ emitEvent: false });
    this.form.controls.departureTime.disable({ emitEvent: false });
    this.form.controls.pricePerSeat.disable({ emitEvent: false });
  }

  private enableAllControls(): void {
    this.form.controls.origin.enable({ emitEvent: false });
    this.form.controls.destination.enable({ emitEvent: false });
    this.form.controls.notes.enable({ emitEvent: false });
    this.form.controls.departureDate.enable({ emitEvent: false });
    this.form.controls.departureTime.enable({ emitEvent: false });
    this.form.controls.pricePerSeat.enable({ emitEvent: false });
  }

  private confirmedPassengersValidator(control: AbstractControl): ValidationErrors | null {
    const ride = this.editingRide();
    if (!ride || ride.availableSeats >= ride.totalSeats) {
      return null;
    }

    const errors: ValidationErrors = {};
    const totalSeats = control.get('totalSeats')?.value as number | null | undefined;
    if (totalSeats !== null && totalSeats !== undefined && totalSeats < ride.totalSeats) {
      errors['seatReduction'] = true;
    }

    const origin = (control.get('origin')?.value as string | undefined) ?? '';
    const destination = (control.get('destination')?.value as string | undefined) ?? '';
    const notes = (control.get('notes')?.value as string | undefined) ?? '';
    const departureDate = (control.get('departureDate')?.value as string | undefined) ?? '';
    const departureTime = (control.get('departureTime')?.value as string | undefined) ?? '';
    const pricePerSeat = control.get('pricePerSeat')?.value as number | null | undefined;
    const rideDeparture = new Date(ride.departureTime);
    const expectedDate = formatLocalDateInput(rideDeparture);
    const expectedTime = formatLocalTimeInput(rideDeparture);

    if (
      origin.trim() !== ride.origin.trim() ||
      destination.trim() !== ride.destination.trim() ||
      notes.trim() !== (ride.notes ?? '').trim() ||
      departureDate !== expectedDate ||
      departureTime !== expectedTime ||
      pricePerSeat !== ride.pricePerSeat
    ) {
      errors['lockedFieldChanged'] = true;
    }

    return Object.keys(errors).length > 0 ? errors : null;
  }

  setDestination(destination: string): void {
    if (this.hasConfirmedPassengers()) return;
    this.form.controls.destination.setValue(destination);
    this.form.controls.destination.markAsDirty();
    this.form.controls.destination.markAsTouched();
  }

  isSeatOptionDisabled(seats: number): boolean {
    return this.hasConfirmedPassengers() && seats < this.minAllowedSeats();
  }

  selectSeats(seats: number): void {
    if (this.isSeatOptionDisabled(seats)) return;
    this.form.controls.totalSeats.setValue(seats);
    this.form.controls.totalSeats.markAsDirty();
    this.form.controls.totalSeats.markAsTouched();
  }

  hasSeatReductionError(): boolean {
    const { totalSeats } = this.form.controls;
    const interacted = totalSeats.dirty || totalSeats.touched || this.submitAttempted();
    return this.form.hasError('seatReduction') && interacted;
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
    this.populatedRideId = null;
    this.submitAttempted.set(false);
    this.rideData.resetPublish();
    this.rideData.clearEditing();
    this.enableAllControls();
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
    if (!departure || totalSeats === null || pricePerSeat === null) {
      return;
    }

    const editing = this.editingRide();
    if (editing && new Date(editing.departureTime).getTime() <= Date.now()) {
      return;
    }

    const editingDeparture = editing ? new Date(editing.departureTime) : null;
    const unchangedDeparture =
      editing &&
      editingDeparture &&
      !Number.isNaN(editingDeparture.getTime()) &&
      departureDate === formatLocalDateInput(editingDeparture) &&
      departureTime === formatLocalTimeInput(editingDeparture);

    this.loading.set(true);
    const draft = {
      origin,
      destination,
      departureTime: unchangedDeparture ? editing.departureTime : departure.toISOString(),
      totalSeats,
      pricePerSeat,
      notes,
    };

    if (editing) {
      this.rideData.update(editing, draft);
      return;
    }

    this.rideData.publish(draft);
  }
}
