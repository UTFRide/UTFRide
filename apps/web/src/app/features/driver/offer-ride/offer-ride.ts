import { Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Ride } from '../../../core/models/ride.model';
import { AuthData } from '../../../core/services/auth-data';
import { NetworkStatus, OFFLINE_ACTION_MESSAGE } from '../../../core/services/network-status';
import { NotificationData } from '../../../core/services/notification-data';
import { RideData } from '../../../core/services/ride-data';
import { NotificationBell } from '../../../shared/components/notification-bell/notification-bell';
import { CurrencyBrlPipe } from '../../../shared/pipes/currency-brl-pipe';
import { InitialsPipe } from '../../../shared/pipes/initials-pipe';

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
  imports: [ReactiveFormsModule, RouterLink, CurrencyBrlPipe, NotificationBell, InitialsPipe],
  templateUrl: './offer-ride.html',
})
export class OfferRide {
  private readonly authData = inject(AuthData);
  private readonly notificationData = inject(NotificationData);
  private readonly rideData = inject(RideData);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly network = inject(NetworkStatus);
  protected readonly offlineMessage = OFFLINE_ACTION_MESSAGE;
  private readonly routeRideId = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('rideId'))),
    { initialValue: this.route.snapshot.queryParamMap.get('rideId') },
  );
  private activeRouteRideId: string | null | undefined = undefined;
  private populatedRideId: string | null = null;

  readonly notifications = this.notificationData.userNotifications;
  readonly notificationsError = this.notificationData.loadError;
  readonly studentName = computed(() => this.authData.currentUser()?.name ?? 'Aluno UTFPR');

  readonly seatOptions = [1, 2, 3, 4] as const;
  readonly campusOptions = [
    { label: 'Sede Centro', value: 'UTFPR - Sede Centro (Av. Sete de Setembro)' },
    { label: 'Sede Ecoville', value: 'UTFPR - Sede Ecoville (R. Dep. Heitor Alencar Furtado)' },
    { label: 'Sede Neoville', value: 'UTFPR - Sede Neoville (R. Pedro Gusso)' },
  ] as const;

  readonly loading = signal(false);
  readonly loggingOut = signal(false);
  readonly submitAttempted = signal(false);
  readonly publishedRide = signal<Ride | null>(null);
  readonly authorizationError = signal<string | null>(null);
  readonly operationError = signal<string | null>(null);
  readonly editLoadError = signal<string | null>(null);
  readonly editAccessDenied = signal(false);
  private readonly pendingEditRideId = signal<string | null>(null);
  readonly canOffer = this.rideData.canOffer;
  readonly blockedStudentNotice = computed<string | null>(() =>
    this.authData.isBlocked()
      ? 'Sua conta está bloqueada e não pode publicar ou editar ofertas de carona.'
      : null,
  );
  readonly editingRide = this.rideData.editingRide;
  readonly isEditMode = computed(
    () => this.editingRide() !== null || this.pendingEditRideId() !== null,
  );
  readonly canManageEditingRide = computed<boolean>(() => {
    const ride = this.editingRide();
    return !ride || this.rideData.canManageRide(ride);
  });
  readonly submitBlocked = computed<boolean>(
    () =>
      !this.canOffer() ||
      this.editAccessDenied() ||
      !this.canManageEditingRide() ||
      this.editLoadError() !== null ||
      this.pendingEditRideId() !== null ||
      this.network.isOffline(),
  );
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
    this.destroyRef.onDestroy(() => {
      this.rideData.resetPublish();
      this.rideData.clearEditing();
    });
  }

  private readonly syncRouteMode = effect(() => {
    const routeRideId = this.routeRideId();
    if (this.activeRouteRideId === routeRideId) return;
    this.activeRouteRideId = routeRideId;
    untracked(() => this.applyRouteMode(routeRideId));
  });

  private readonly syncLoadedEditingRide = effect(() => {
    const ride = this.editingRide();
    if (!ride || this.populatedRideId === ride.id) return;
    if (!this.rideData.canManageRide(ride)) {
      this.rideData.clearEditing();
      this.editAccessDenied.set(true);
      this.authorizationError.set('Você não tem permissão para editar esta oferta de carona.');
      return;
    }
    this.populateFormFromRide(ride);
  });

  private readonly handleEditRideLoadResult = effect(() => {
    const result = this.rideData.editRideLoadResult();
    if (!result) return;
    if ('unauthorized' in result) {
      this.pendingEditRideId.set(null);
      this.editLoadError.set(null);
      this.editAccessDenied.set(true);
      this.authorizationError.set(
        this.authData.isBlocked()
          ? 'Sua conta está bloqueada e não pode editar ofertas de carona.'
          : 'Você não tem permissão para editar esta oferta de carona.',
      );
    } else if ('connectionError' in result) {
      this.editAccessDenied.set(false);
      this.authorizationError.set(null);
      this.editLoadError.set(
        'Falha de conexão ao carregar a oferta para edição. Verifique sua internet e tente novamente.',
      );
    } else if ('requestError' in result) {
      this.editAccessDenied.set(false);
      this.authorizationError.set(null);
      this.editLoadError.set('Não foi possível carregar a oferta para edição. Tente novamente.');
    } else if ('ride' in result) {
      this.pendingEditRideId.set(null);
      this.editLoadError.set(null);
      this.editAccessDenied.set(false);
      this.authorizationError.set(null);
    }
  });

  private readonly handlePublishResult = effect(() => {
    const result = this.rideData.publishResult();
    if (!result) return;
    this.loading.set(false);
    if ('ride' in result) {
      this.authorizationError.set(null);
      this.operationError.set(null);
      this.publishedRide.set(result.ride);
    } else if ('unauthorized' in result) {
      this.operationError.set(null);
      this.authorizationError.set(
        this.authData.isBlocked()
          ? 'Sua conta está bloqueada e não pode publicar ofertas de carona.'
          : 'Você não tem permissão para publicar ofertas de carona.',
      );
    } else if ('connectionError' in result) {
      this.operationError.set(
        'Falha de conexão ao publicar a oferta. Verifique sua internet e tente novamente.',
      );
    } else if ('requestError' in result) {
      this.operationError.set('Não foi possível publicar a oferta. Tente novamente.');
    }
  });

  private readonly handleUpdateResult = effect(() => {
    const result = this.rideData.updateResult();
    if (!result) return;
    this.loading.set(false);
    if ('ride' in result) {
      this.authorizationError.set(null);
      this.operationError.set(null);
      this.publishedRide.set(result.ride);
    } else if ('unauthorized' in result) {
      this.operationError.set(null);
      this.authorizationError.set(
        this.authData.isBlocked()
          ? 'Sua conta está bloqueada e não pode editar ofertas de carona.'
          : 'Apenas o motorista autor com conta ativa pode editar esta oferta.',
      );
    } else if ('connectionError' in result) {
      this.operationError.set(
        'Falha de conexão ao salvar as alterações. Verifique sua internet e tente novamente.',
      );
    } else if ('requestError' in result || 'invalidState' in result || 'invalidData' in result) {
      this.operationError.set('Não foi possível salvar as alterações. Tente novamente.');
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

  retryLoadEdit(): void {
    if (this.network.isOffline()) return;
    const rideId = this.pendingEditRideId();
    if (!rideId) return;
    this.editLoadError.set(null);
    this.rideData.loadRideForEdit(rideId);
  }

  resetForAnotherRide(): void {
    this.resetToCreateMode();
  }

  private applyRouteMode(routeRideId: string | null): void {
    if (!routeRideId) {
      this.resetToCreateMode();
      return;
    }

    this.resetLocalState();
    this.rideData.resetPublish();
    this.rideData.resetUpdate();
    this.enableAllControls();

    const currentEditing = this.editingRide();
    if (currentEditing && currentEditing.id === routeRideId) {
      if (this.rideData.canManageRide(currentEditing)) {
        this.populateFormFromRide(currentEditing);
      } else {
        this.rideData.clearEditing();
        this.editAccessDenied.set(true);
        this.authorizationError.set('Você não tem permissão para editar esta oferta de carona.');
      }
      return;
    }

    this.rideData.clearEditing();
    const fromDriverRides = this.rideData.driverRides().find((item) => item.id === routeRideId);
    if (fromDriverRides) {
      if (this.rideData.startEditing(fromDriverRides)) {
        this.populateFormFromRide(fromDriverRides);
      } else {
        this.editAccessDenied.set(true);
        this.authorizationError.set('Você não tem permissão para editar esta oferta de carona.');
      }
      return;
    }

    this.pendingEditRideId.set(routeRideId);
    this.rideData.loadRideForEdit(routeRideId);
  }

  private resetLocalState(): void {
    this.loading.set(false);
    this.publishedRide.set(null);
    this.authorizationError.set(null);
    this.operationError.set(null);
    this.editLoadError.set(null);
    this.pendingEditRideId.set(null);
    this.editAccessDenied.set(false);
    this.populatedRideId = null;
    this.submitAttempted.set(false);
  }

  private resetToCreateMode(): void {
    this.resetLocalState();
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
    if (this.network.isOffline()) return;
    this.submitAttempted.set(true);
    this.authorizationError.set(null);
    this.operationError.set(null);
    this.form.updateValueAndValidity();
    this.form.markAllAsTouched();
    if (this.editAccessDenied()) {
      this.authorizationError.set('Você não tem permissão para editar esta oferta de carona.');
      return;
    }
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
