import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, exhaustMap, map, of, startWith, Subject, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ErrorNotice } from './error-notice';
import { Registration, User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthData {
  private readonly http = inject(HttpClient);
  private readonly notice = inject(ErrorNotice);
  private readonly submissions = new Subject<Registration>();
  private readonly resets = new Subject<void>();
  private readonly loginSubmissions = new Subject<{ email: string; password: string }>();
  private readonly loginResets = new Subject<void>();
  private readonly authenticatedUser = signal<User | null>(null);
  readonly isAuthenticated = computed(() => this.authenticatedUser() !== null);
  readonly loginResult = toSignal(this.loginResets.pipe(
    startWith(undefined),
    switchMap(() => this.loginSubmissions.pipe(
      exhaustMap(({ email, password }) => this.http.get<User[]>(`${environment.apiUrl}/users`, { params: { email } }).pipe(
        map((users) => users.find((user) => user.email === email && user.password === password && !user.isBlocked && user.isEmailConfirmed) ?? null),
        tap((user) => this.authenticatedUser.set(user)),
        map((user) => ({ user })),
        catchError((error: unknown) => {
          if (!(error instanceof HttpErrorResponse)) {
            this.notice.message.set('Falha inesperada. Tente novamente.');
          }
          return of(error instanceof HttpErrorResponse && error.status === 0
            ? { connectionError: true as const }
            : { requestError: true as const });
        }),
      )),
      startWith(undefined),
    )),
  ));
  readonly result = toSignal(this.resets.pipe(
    startWith(undefined),
    switchMap(() => this.submissions.pipe(
      exhaustMap((registration) => this.http.post<{ exists: boolean }>(`${environment.apiUrl}/registration-exists`, { email: registration.email, registrationNumber: registration.registrationNumber }).pipe(
        switchMap(({ exists }) => exists
          ? of({ duplicate: true as const })
          : this.http.post<User>(`${environment.apiUrl}/users`, {
            ...registration,
            role: 'student',
            isBlocked: false,
            isEmailConfirmed: true,
            ratingAverage: 0,
            createdAt: new Date().toISOString(),
          }).pipe(map((user) => ({ duplicate: false as const, user })))),
        catchError((error: unknown) => {
          if (!(error instanceof HttpErrorResponse)) {
            this.notice.message.set('Falha inesperada. Tente novamente.');
          }
          return of(error instanceof HttpErrorResponse && error.status === 0
            ? { connectionError: true as const }
            : { requestError: true as const });
        }),
      )),
      startWith(undefined),
    )),
  ));

  logout(): void {
    this.authenticatedUser.set(null);
  }

  register(registration: Registration): void {
    this.notice.message.set('');
    this.submissions.next(registration);
  }

  resetRegistration(): void {
    this.resets.next();
  }

  login(email: string, password: string): void {
    this.notice.message.set('');
    this.loginSubmissions.next({ email, password });
  }

  resetLogin(): void {
    this.loginResets.next();
  }
}
