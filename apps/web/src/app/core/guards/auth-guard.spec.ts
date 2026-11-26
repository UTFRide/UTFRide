import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { routes } from '../../app.routes';
import { AuthData } from '../services/auth-data';
import { SUPABASE_AUTH_CLIENT, SupabaseAuthClient } from '../services/supabase-client';
import { authGuard } from './auth-guard';

const fakeSupabaseUser: SupabaseUser = {
  id: 'supabase-user-1',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
  email: 'ana@alunos.utfpr.edu.br',
  identities: [],
};

const fakeSession: Session = {
  access_token: 'jwt-restored-token',
  refresh_token: 'refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: fakeSupabaseUser,
};

const activeUserRow = {
  id: 'supabase-user-1',
  name: 'Ana',
  email: 'ana@alunos.utfpr.edu.br',
  registration_number: '123',
  whatsapp: '41987654321',
  role: 'student' as const,
  is_blocked: false,
  is_email_confirmed: true,
  rating_average: 4.5,
  created_at: '2026-01-01T00:00:00.000Z',
};

const activeUser = {
  id: 'supabase-user-1',
  name: 'Ana',
  email: 'ana@alunos.utfpr.edu.br',
  registrationNumber: '123',
  whatsapp: '41987654321',
  role: 'student' as const,
  isBlocked: false,
  isEmailConfirmed: true,
  ratingAverage: 4.5,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function createFakeAuthClient(): SupabaseAuthClient {
  return {
    signUp: vi.fn(async () => ({ data: { user: fakeSupabaseUser, session: fakeSession }, error: null })),
    signInWithPassword: vi.fn(async () => ({ data: { user: fakeSupabaseUser, session: fakeSession }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { id: 'sub-1', callback: vi.fn(), unsubscribe: vi.fn() } },
    })),
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function waitForRequest(
  http: HttpTestingController,
  matcher: (request: {
    url: string;
    method: string;
    params: { get(name: string): string | null };
  }) => boolean,
) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const [match] = http.match(matcher);
    if (match) {
      return match;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return http.expectOne(matcher);
}

async function waitForUsersRequest(http: HttpTestingController) {
  return waitForRequest(
    http,
    (request) =>
      request.url === `${environment.supabaseUrl}/rest/v1/users` &&
      request.method === 'GET' &&
      request.params.get('id') === 'eq.supabase-user-1',
  );
}

describe('authGuard', () => {
  let fakeAuth: SupabaseAuthClient;

  beforeEach(() => {
    fakeAuth = createFakeAuthClient();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes, withComponentInputBinding()),
        { provide: SUPABASE_AUTH_CLIENT, useValue: fakeAuth },
      ],
    });
  });

  it('retorna true direto quando o aluno já está autenticado sem chamar getSession()', async () => {
    const auth = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    auth.login('ana@alunos.utfpr.edu.br', 'senha123');
    await flushMicrotasks();
    http.expectOne((request) => request.url === `${environment.supabaseUrl}/rest/v1/users`).flush([activeUserRow]);
    await flushMicrotasks();

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

    expect(result).toBe(true);
    expect(fakeAuth.getSession).not.toHaveBeenCalled();
  });

  it('retorna UrlTree para /login quando não há sessão restaurável', async () => {
    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
    expect(fakeAuth.getSession).toHaveBeenCalledTimes(1);
  });

  it('aguarda restauração única quando chamadas simultâneas do guard ocorrem antes da sessão resolver', async () => {
    let resolveSession!: (
      value: Awaited<ReturnType<SupabaseAuthClient['getSession']>>,
    ) => void;
    vi.mocked(fakeAuth.getSession).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSession = resolve;
        }),
    );
    const http = TestBed.inject(HttpTestingController);

    const firstGuard = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    const secondGuard = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    expect(fakeAuth.getSession).toHaveBeenCalledTimes(1);

    resolveSession({ data: { session: fakeSession }, error: null });
    const usersRequest = await waitForUsersRequest(http);
    usersRequest.flush([activeUserRow]);

    await expect(Promise.all([firstGuard, secondGuard])).resolves.toEqual([true, true]);
    expect(fakeAuth.getSession).toHaveBeenCalledTimes(1);
  });

  it.each(['/', '/login', '/register'])(
    'mantém rota pública %s acessível para visitante sem sessão',
    async (publicRoute) => {
      await RouterTestingHarness.create(publicRoute);

      expect(TestBed.inject(Router).url).toBe(publicRoute);
      expect(fakeAuth.getSession).not.toHaveBeenCalled();
    },
  );

  it.each(['/rides', '/rides/my-trips', '/rides/ride-1', '/driver/offer', '/driver/my-rides'])(
    'libera rota protegida %s no F5 quando getSession() restaura sessão ativa e token JWT',
    async (protectedRoute) => {
      vi.mocked(fakeAuth.getSession).mockResolvedValueOnce({
        data: { session: fakeSession },
        error: null,
      });
      const auth = TestBed.inject(AuthData);
      const http = TestBed.inject(HttpTestingController);

      const navigation = RouterTestingHarness.create(protectedRoute);
      const usersRequest = await waitForUsersRequest(http);
      usersRequest.flush([activeUserRow]);

      if (protectedRoute === '/rides/ride-1') {
        const resolverRideRequest = await waitForRequest(
          http,
          (request) =>
            request.url === `${environment.supabaseUrl}/rest/v1/rides` &&
            request.method === 'GET' &&
            request.params.get('id') === 'eq.ride-1',
        );
        resolverRideRequest.flush([]);
      }

      await navigation;

      expect(TestBed.inject(Router).url).toBe(protectedRoute);
      expect(auth.isAuthenticated()).toBe(true);
      expect(auth.currentUser()).toEqual(activeUser);
      expect(auth.accessToken()).toBe('jwt-restored-token');
      expect(fakeAuth.getSession).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['/rides', '/rides/my-trips', '/rides/ride-1', '/driver/offer', '/driver/my-rides'])(
    'redireciona rota protegida %s para /login quando não há sessão ativa',
    async (protectedRoute) => {
      vi.mocked(fakeAuth.getSession).mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      await RouterTestingHarness.create(protectedRoute);

      expect(TestBed.inject(Router).url).toBe('/login');
      expect(fakeAuth.getSession).toHaveBeenCalledTimes(1);
    },
  );

  it('redireciona para /login quando getSession() falha por erro ou queda de rede', async () => {
    vi.mocked(fakeAuth.getSession).mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await RouterTestingHarness.create('/rides');

    expect(TestBed.inject(Router).url).toBe('/login');
    expect(fakeAuth.getSession).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(AuthData).isAuthenticated()).toBe(false);
    expect(TestBed.inject(AuthData).accessToken()).toBeNull();
  });

  it('redireciona para /login quando a sessão restaurada pertence a conta bloqueada', async () => {
    vi.mocked(fakeAuth.getSession).mockResolvedValueOnce({
      data: { session: fakeSession },
      error: null,
    });
    const http = TestBed.inject(HttpTestingController);

    const navigation = RouterTestingHarness.create('/rides');
    const usersRequest = await waitForUsersRequest(http);
    usersRequest.flush([{ ...activeUserRow, is_blocked: true }]);

    await navigation;

    expect(TestBed.inject(Router).url).toBe('/login');
    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(AuthData).isAuthenticated()).toBe(false);
    expect(TestBed.inject(AuthData).accessToken()).toBeNull();
  });
});
