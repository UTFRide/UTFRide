import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthData } from '../../../core/services/auth-data';

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

  constructor() {
    this.auth.resetRegistration();
    this.destroyRef.onDestroy(() => this.auth.resetRegistration());
  }
  readonly loading = signal(false);
  readonly passwordVisible = signal(false);
  readonly confirmationVisible = signal(false);
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    registrationNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    whatsapp: new FormControl('', { nonNullable: true }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    terms: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
  }, { validators: matchingPasswords });

  private readonly navigateAfterRegistration = effect(() => {
    if (this.auth.result()) {
      this.loading.set(false);
      void this.router.navigateByUrl('/login');
    }
  });

  submit(): void {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    const { name, email, registrationNumber, whatsapp, password } = this.form.getRawValue();
    this.auth.register({ name, email, registrationNumber, whatsapp, password });
  }
}

