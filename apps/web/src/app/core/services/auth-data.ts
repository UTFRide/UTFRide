import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { exhaustMap, startWith, Subject, switchMap } from 'rxjs';
import { Registration, User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthData {
  private readonly http = inject(HttpClient);
  private readonly submissions = new Subject<Registration>();
  private readonly resets = new Subject<void>();
  readonly result = toSignal(this.resets.pipe(
    startWith(undefined),
    switchMap(() => this.submissions.pipe(
      exhaustMap((registration) => this.http.post<User>('http://localhost:3000/users', {
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
}
