import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthError, isAuthRetryableFetchError, User as SupabaseUser } from '@supabase/supabase-js';
import { catchError, exhaustMap, from, map, Observable, of, startWith, Subject, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ErrorNotice } from './error-notice';
import { Registration, User } from '../models/user.model';
import { SupabaseClientService } from './supabase-client';

export type AuthenticatedUser = Omit<User, 'password'>;
export type PassengerAccessRestriction = 'blocked-account' | 'support-profile';
export type RegisterResult =
  | { duplicate: true }
  | { duplicate: false; user: User }
  | { connectionError: true }
  | { requestError: true }
  | { authError: string };

function isSupabaseDuplicateError(error: AuthError | null, user: SupabaseUser | null): boolean {
  if (error) {
    return error.code === 'user_already_exists' || /already registered|already exists/i.test(error.message ?? '');
  }
  return user !== null && Array.isArray(user.identities) && user.identities.length === 0;
}

function isConnectionFailure(error: unknown): boolean {
  if (error instanceof HttpErrorResponse) {
    return error.status === 0;
  }
  if (error instanceof TypeError || isAuthRetryableFetchError(error)) {
    return true;
  }
  if (typeof error === 'object' && error !== null) {
    const record = error as { status?: unknown; name?: unknown; message?: unknown };
    return (
      record.status === 0 ||
      record.name === 'AuthRetryableFetchError' ||
      (typeof record.message === 'string' && /failed to fetch|fetch failed|network/i.test(record.message))
    );
  }
  return false;
}

const DEFAULT_REGISTER_ERROR = 'Não foi possível concluir o cadastro. Tente novamente.';

function mapSignUpErrorMessage(error: AuthError): string {
  const message = error.message ?? '';
  if (error.code === 'weak_password' || /weak.*password|at least 6/i.test(message)) {
    return 'A senha deve ter pelo menos 6 caracteres.';
  }
  if (error.code === 'email_address_invalid' || /invalid email/i.test(message)) {
    return 'Informe um e-mail institucional válido (@alunos.utfpr.edu.br).';
  }
  if (error.code === 'over_email_send_rate_limit' || error.status === 429) {
    return 'Muitas tentativas seguidas. Aguarde alguns instantes e tente novamente.';
  }
  return DEFAULT_REGISTER_ERROR;
}

@Injectable({ providedIn: 'root' })
export class AuthData {
  private readonly http = inject(HttpClient);
  private readonly notice = inject(ErrorNotice);
  private readonly supabase = inject(SupabaseClientService);
  private readonly submissions = new Subject<Registration>();
  private readonly resets = new Subject<void>();
  private readonly loginSubmissions = new Subject<{ email: string; password: string }>();
  private readonly loginResets = new Subject<void>();
  private readonly authenticatedUser = signal<User | null>(null);
  private readonly sessionAccessToken = signal<string | null>(null);
  readonly accessToken = this.sessionAccessToken.asReadonly();
  readonly currentUser = computed<AuthenticatedUser | null>(() => {
    const user = this.authenticatedUser();
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      registrationNumber: user.registrationNumber,
      whatsapp: user.whatsapp,
      role: user.role,
      isBlocked: user.isBlocked,
      isEmailConfirmed: user.isEmailConfirmed,
      ratingAverage: user.ratingAverage,
      createdAt: user.createdAt,
    };
  });
  readonly isAuthenticated = computed(() => this.authenticatedUser() !== null);
  readonly isBlocked = computed(() => this.currentUser()?.isBlocked === true);
  readonly passengerRestriction = computed<PassengerAccessRestriction | null>(() => {
    const user = this.currentUser();
    if (user?.isBlocked) return 'blocked-account';
    return user?.role === 'support' ? 'support-profile' : null;
  });
  readonly canOffer = computed(() => {
    const user = this.currentUser();
    return user !== null && !user.isBlocked && user.role !== 'support';
  });
  readonly loginResult = toSignal(this.loginResets.pipe(
    startWith(undefined),
    switchMap(() => this.loginSubmissions.pipe(
      exhaustMap(({ email, password }) => this.http.get<User[]>(`${environment.apiUrl}/users`, { params: { email } }).pipe(
        map((users) => {
          const matched = users.find(
            (user) => user.email === email && user.password === password && user.isEmailConfirmed,
          );
          if (!matched) {
            return { user: null };
          }
          if (matched.isBlocked) {
            return { user: null, blocked: true as const };
          }
          return { user: matched };
        }),
        tap((result) => this.authenticatedUser.set(result.user)),
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
          : this.registerWithSupabase(registration)),
        catchError((error: unknown) => {
          if (isConnectionFailure(error)) {
            return of({ connectionError: true as const });
          }
          if (!(error instanceof HttpErrorResponse)) {
            this.notice.message.set('Falha inesperada. Tente novamente.');
          }
          return of({ requestError: true as const });
        }),
      )),
      startWith(undefined),
    )),
  ));

  private registerWithSupabase(registration: Registration): Observable<RegisterResult> {
    return from(
      this.supabase.signUp({
        email: registration.email,
        password: registration.password,
        options: {
          data: {
            name: registration.name,
            registrationNumber: registration.registrationNumber,
            whatsapp: registration.whatsapp,
            role: 'student',
            isBlocked: false,
          },
        },
      }),
    ).pipe(
      switchMap(({ data, error }) => {
        if (isSupabaseDuplicateError(error, data.user)) {
          return of({ duplicate: true as const });
        }
        if (error) {
          if (isConnectionFailure(error)) {
            return of({ connectionError: true as const });
          }
          return of({ authError: mapSignUpErrorMessage(error) });
        }
        if (!data.user) {
          return of({ authError: DEFAULT_REGISTER_ERROR });
        }
        // TODO: Atividade 15 — migrar coleção users para tabela no Supabase com RLS
        const profile = {
          ...(data.user.id ? { id: data.user.id } : {}),
          name: registration.name,
          email: registration.email,
          registrationNumber: registration.registrationNumber,
          whatsapp: registration.whatsapp,
          role: 'student' as const,
          isBlocked: false,
          isEmailConfirmed: true,
          ratingAverage: 0,
          createdAt: new Date().toISOString(),
        };
        return this.http.post<User>(`${environment.apiUrl}/users`, profile).pipe(
          catchError((httpError: unknown) =>
            from(this.clearAutoSession().catch(() => undefined)).pipe(
              switchMap(() => throwError(() => httpError)),
            ),
          ),
          switchMap((user) =>
            from(this.clearAutoSession()).pipe(
              map(() => ({ duplicate: false as const, user })),
              catchError((signOutError: unknown) =>
                of(
                  isConnectionFailure(signOutError)
                    ? { connectionError: true as const }
                    : { authError: DEFAULT_REGISTER_ERROR },
                ),
              ),
            ),
          ),
        );
      }),
    );
  }

  private async clearAutoSession(): Promise<void> {
    this.authenticatedUser.set(null);
    this.sessionAccessToken.set(null);
    const { error } = await this.supabase.signOut();
    if (error) {
      throw error;
    }
  }

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
