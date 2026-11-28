import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthData } from '../../../core/services/auth-data';
import { NetworkStatus, OFFLINE_ACTION_MESSAGE } from '../../../core/services/network-status';

function matchingPasswords(control: AbstractControl): ValidationErrors | null {
  return control.get('password')?.value === control.get('confirmPassword')?.value
    ? null
    : { passwordMismatch: true };
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
})
export class Register {
  private readonly auth = inject(AuthData);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly network = inject(NetworkStatus);
  protected readonly offlineMessage = OFFLINE_ACTION_MESSAGE;

  constructor() {
    this.auth.resetRegistration();
    this.destroyRef.onDestroy(() => this.auth.resetRegistration());
  }
  readonly loading = signal(false);
  readonly duplicate = signal(false);
  readonly connectionError = signal(false);
  readonly authError = signal('');
  readonly passwordVisible = signal(false);
  readonly confirmationVisible = signal(false);
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email, Validators.pattern(/^[^@]+@alunos\.utfpr\.edu\.br$/i)] }),
    registrationNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    whatsapp: new FormControl('', { nonNullable: true }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    terms: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
  }, { validators: matchingPasswords });

  private readonly navigateAfterRegistration = effect(() => {
    const result = this.auth.result();
    if (result) {
      this.loading.set(false);
      if ('connectionError' in result) {
        this.connectionError.set(true);
      } else if ('authError' in result) {
        this.authError.set(result.authError);
      } else if (!('requestError' in result)) {
        this.duplicate.set(result.duplicate);
        if (!result.duplicate) {
          void this.router.navigateByUrl('/login', { state: { accountCreated: true } });
        }
      }
    }
  });

  submit(): void {
    if (this.form.invalid || this.loading() || this.network.isOffline()) return;
    this.duplicate.set(false);
    this.connectionError.set(false);
    this.authError.set('');
    this.loading.set(true);
    const { name, email, registrationNumber, whatsapp, password } = this.form.getRawValue();
    this.auth.register({ name, email, registrationNumber, whatsapp, password });
  }
}

