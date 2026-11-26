import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthError, isAuthRetryableFetchError, User as SupabaseUser } from '@supabase/supabase-js';
import { catchError, exhaustMap, firstValueFrom, from, map, Observable, of, startWith, Subject, switchMap, throwError } from 'rxjs';
import { ErrorNotice } from './error-notice';
import { Registration, User } from '../models/user.model';
import { SupabaseClientService } from './supabase-client';
import {
  mapUserRow,
  SUPABASE_SINGLE_OBJECT_HEADERS,
  supabaseRestUrl,
  supabaseRpcUrl,
  UserRow,
} from './supabase-rest';

export type AuthenticatedUser = Omit<User, 'password'>;
export type PassengerAccessRestriction = 'blocked-account' | 'support-profile';
export type RegisterResult =
  | { duplicate: true }
  | { duplicate: false; user: User }
  | { connectionError: true }
  | { requestError: true }
  | { authError: string };
export type LoginResult =
  | { user: User }
  | { user: null; blocked?: true }
  | { connectionError: true }
  | { requestError: true };

function isSupabaseDuplicateError(error: AuthError | null, user: SupabaseUser | null): boolean {
  if (error) {
    return error.code === 'user_already_exists' || /already registered|already exists/i.test(error.message ?? '');
  }
  return user !== null && Array.isArray(user.identities) && user.identities.length === 0;
}

function isInvalidCredentialsError(error: AuthError): boolean {
  return (
    error.code === 'invalid_credentials' ||
    /invalid login credentials|invalid credentials/i.test(error.message ?? '')
  );
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
  private sessionRestorePromise: Promise<boolean> | null = null;
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
      exhaustMap(({ email, password }) => this.loginWithSupabase(email, password).pipe(
        catchError((error: unknown) => {
          this.clearLocalSession();
          return of(this.classifyUnexpectedFailure(error));
        }),
      )),
      startWith(undefined),
    )),
  ));
  readonly result = toSignal(this.resets.pipe(
    startWith(undefined),
    switchMap(() => this.submissions.pipe(
      exhaustMap((registration) =>
        this.http
          .post<boolean>(supabaseRpcUrl('check_registration_exists'), {
            p_email: registration.email,
            p_registration_number: registration.registrationNumber,
          })
          .pipe(
            switchMap((exists) => (exists ? of({ duplicate: true as const }) : this.registerWithSupabase(registration))),
            catchError((error: unknown) => of(this.classifyUnexpectedFailure(error))),
          ),
      ),
      startWith(undefined),
    )),
  ));

  private classifyUnexpectedFailure(error: unknown): { connectionError: true } | { requestError: true } {
    if (isConnectionFailure(error)) {
      return { connectionError: true as const };
    }
    if (!(error instanceof HttpErrorResponse)) {
      this.notice.message.set('Falha inesperada. Tente novamente.');
    }
    return { requestError: true as const };
  }

  private loginWithSupabase(email: string, password: string): Observable<LoginResult> {
    return from(this.supabase.signInWithPassword({ email, password })).pipe(
      switchMap(({ data, error }) => {
        if (error) {
          this.clearLocalSession();
          if (isConnectionFailure(error)) {
            return of({ connectionError: true as const });
          }
          if (isInvalidCredentialsError(error)) {
            return of({ user: null });
          }
          this.notice.message.set('Falha inesperada. Tente novamente.');
          return of({ requestError: true as const });
        }
        if (!data.user || !data.session?.access_token) {
          this.clearLocalSession();
          this.notice.message.set('Falha inesperada. Tente novamente.');
          return of({ requestError: true as const });
        }
        return this.loadOrMirrorProfile(data.user, data.session.access_token, email);
      }),
    );
  }

  private loadOrMirrorProfile(
    supabaseUser: SupabaseUser,
    accessToken: string,
    fallbackEmail = '',
  ): Observable<LoginResult> {
    const lookupEmail = supabaseUser.email ?? fallbackEmail;
    if (!lookupEmail) {
      return from(this.clearAutoSession()).pipe(map(() => ({ user: null })));
    }
    return this.http
      .get<UserRow[]>(supabaseRestUrl('users'), {
        params: { id: `eq.${supabaseUser.id}` },
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .pipe(
        switchMap((users) => {
          if (!Array.isArray(users)) {
            return throwError(() => new Error('Resposta inválida ao carregar perfil.'));
          }
          const existing = users.find((user) => user.id === supabaseUser.id) ?? users[0];
          if (existing) {
            return of(mapUserRow(existing));
          }
          return this.http
            .post<UserRow>(
              supabaseRestUrl('users'),
              this.buildMirrorProfileRow(supabaseUser, lookupEmail),
              {
                headers: {
                  ...SUPABASE_SINGLE_OBJECT_HEADERS,
                  Authorization: `Bearer ${accessToken}`,
                },
              },
            )
            .pipe(map((created) => mapUserRow(created)));
        }),
        this.rollbackSessionOnError(),
        switchMap((user) => {
          if (user.isBlocked) {
            return from(this.clearAutoSession()).pipe(
              map(() => ({ user: null, blocked: true as const })),
            );
          }
          this.authenticatedUser.set(user);
          this.sessionAccessToken.set(accessToken);
          return of({ user });
        }),
      );
  }

  private buildMirrorProfileRow(supabaseUser: SupabaseUser, email: string): UserRow {
    const metadata = supabaseUser.user_metadata ?? {};
    const name = typeof metadata['name'] === 'string' && metadata['name'].trim()
      ? metadata['name']
      : email.split('@')[0];
    const registration_number = typeof metadata['registrationNumber'] === 'string'
      ? metadata['registrationNumber']
      : '';
    const whatsapp = typeof metadata['whatsapp'] === 'string'
      ? metadata['whatsapp']
      : '';
    const role = metadata['role'] === 'support' ? ('support' as const) : ('student' as const);
    const is_blocked = metadata['isBlocked'] === true;

    return {
      id: supabaseUser.id,
      name,
      email,
      registration_number,
      whatsapp,
      role,
      is_blocked,
      is_email_confirmed: true,
      rating_average: 0,
      created_at: supabaseUser.created_at || new Date().toISOString(),
    };
  }

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
        const profileRow: UserRow = {
          id: data.user.id,
          name: registration.name,
          email: registration.email,
          registration_number: registration.registrationNumber,
          whatsapp: registration.whatsapp,
          role: 'student',
          is_blocked: false,
          is_email_confirmed: true,
          rating_average: 0,
          created_at: new Date().toISOString(),
        };
        const headers: Record<string, string> = { ...SUPABASE_SINGLE_OBJECT_HEADERS };
        if (data.session?.access_token) {
          headers['Authorization'] = `Bearer ${data.session.access_token}`;
        }
        return this.http.post<UserRow>(supabaseRestUrl('users'), profileRow, { headers }).pipe(
          map((saved) => mapUserRow(saved)),
          this.rollbackSessionOnError(),
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

  private rollbackSessionOnError<T>() {
    return catchError<T, Observable<never>>((error: unknown) =>
      from(this.clearAutoSession().catch(() => undefined)).pipe(
        switchMap(() => throwError(() => error)),
      ),
    );
  }

  private clearLocalSession(): void {
    this.authenticatedUser.set(null);
    this.sessionAccessToken.set(null);
  }

  private async clearAutoSession(): Promise<void> {
    this.clearLocalSession();
    const { error } = await this.supabase.signOut();
    if (error) {
      throw error;
    }
  }

  ensureSessionRestored(): Promise<boolean> {
    if (this.isAuthenticated()) {
      return Promise.resolve(true);
    }
    this.sessionRestorePromise ??= this.restoreSession();
    return this.sessionRestorePromise;
  }

  private async restoreSession(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.getSession();
      if (error || !data.session?.user || !data.session.access_token) {
        this.clearLocalSession();
        return false;
      }
      const result = await firstValueFrom(
        this.loadOrMirrorProfile(data.session.user, data.session.access_token),
      );
      if ('user' in result && result.user !== null) {
        return true;
      }
      this.clearLocalSession();
      return false;
    } catch {
      this.clearLocalSession();
      return false;
    } finally {
      this.sessionRestorePromise = null;
    }
  }

  async logout(): Promise<void> {
    this.clearLocalSession();
    this.sessionRestorePromise = null;
    try {
      await this.supabase.signOut();
    } catch {
      // A sessão local já foi encerrada; falha de rede no signOut não deve travar a saída.
    }
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
