import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthData } from '../../../core/services/auth-data';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
})
export class Login {
  private readonly auth = inject(AuthData);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly loading = signal(false);
  readonly invalidCredentials = signal(false);
  readonly connectionError = signal(false);
  readonly passwordVisible = signal(false);
  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    this.auth.resetLogin();
    this.destroyRef.onDestroy(() => this.auth.resetLogin());
  }

  private readonly navigateAfterLogin = effect(() => {
    const result = this.auth.loginResult();
    if (result && 'connectionError' in result) {
      this.loading.set(false);
      this.connectionError.set(true);
    } else if (result && 'requestError' in result) {
      this.loading.set(false);
    } else if (result?.user === null) {
      this.loading.set(false);
      this.invalidCredentials.set(true);
    } else if (result?.user) {
      this.loading.set(false);
      void this.router.navigateByUrl('/rides');
    }
  });

  submit(): void {
    if (this.form.invalid || this.loading()) return;
    this.invalidCredentials.set(false);
    this.connectionError.set(false);
    this.loading.set(true);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password);
  }
}
