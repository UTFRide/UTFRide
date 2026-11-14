import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { exhaustMap, map, startWith, Subject, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Registration, User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthData {
  private readonly http = inject(HttpClient);
  private readonly submissions = new Subject<Registration>();
  private readonly resets = new Subject<void>();
  private readonly loginSubmissions = new Subject<{ email: string; password: string }>();
  private readonly authenticatedUser = signal<User | null>(null);
  readonly isAuthenticated = computed(() => this.authenticatedUser() !== null);
  readonly loginResult = toSignal(this.loginSubmissions.pipe(
    exhaustMap(({ email, password }) => this.http.get<User[]>(`${environment.apiUrl}/users`, { params: { email } }).pipe(
      map((users) => users.find((user) => user.email === email && user.password === password && !user.isBlocked && user.isEmailConfirmed) ?? null),
      tap((user) => this.authenticatedUser.set(user)),
    )),
  ));
  readonly result = toSignal(this.resets.pipe(
    startWith(undefined),
    switchMap(() => this.submissions.pipe(
      exhaustMap((registration) => this.http.post<User>(`${environment.apiUrl}/users`, {
        ...registration,
        role: 'student',
        isBlocked: false,
        isEmailConfirmed: true,
        ratingAverage: 0,
        createdAt: new Date().toISOString(),
      })),
      startWith(undefined),
    )),
  ));

  register(registration: Registration): void {
    this.submissions.next(registration);
  }

  resetRegistration(): void {
    this.resets.next();
  }

  login(email: string, password: string): void {
    this.loginSubmissions.next({ email, password });
  }
}
