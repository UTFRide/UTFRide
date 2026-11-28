import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { routes } from '../../app.routes';
import { AuthData } from '../../core/services/auth-data';
import { SUPABASE_AUTH_CLIENT, SupabaseAuthClient } from '../../core/services/supabase-client';

const fakeSupabaseUser: SupabaseUser = {
  id: 'student-404-1',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
  email: 'ana@alunos.utfpr.edu.br',
  identities: [],
};

const fakeSession: Session = {
  access_token: 'jwt-token-404',
  refresh_token: 'refresh-token-404',
  expires_in: 3600,
  token_type: 'bearer',
  user: fakeSupabaseUser,
};

const activeUserRow = {
  id: 'student-404-1',
  name: 'Ana',
  email: 'ana@alunos.utfpr.edu.br',
  registration_number: '123456',
  whatsapp: '41987654321',
  role: 'student' as const,
  is_blocked: false,
  is_email_confirmed: true,
  rating_average: 4.8,
  created_at: '2026-01-01T00:00:00.000Z',
};

function createFakeAuthClient(): SupabaseAuthClient {
  return {
    signUp: vi.fn(async () => ({ data: { user: fakeSupabaseUser, session: fakeSession }, error: null })),
    signInWithPassword: vi.fn(async () => ({
      data: { user: fakeSupabaseUser, session: fakeSession },
      error: null,
    })),
    signOut: vi.fn(async () => ({ error: null })),
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { id: 'sub-404', callback: vi.fn(), unsubscribe: vi.fn() } },
    })),
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function authenticateStudent(http: HttpTestingController): Promise<AuthData> {
  const auth = TestBed.inject(AuthData);
  auth.login('ana@alunos.utfpr.edu.br', 'senha123');
  await flushMicrotasks();
  http
    .expectOne(
      (request) =>
        request.url === `${environment.supabaseUrl}/rest/v1/users` &&
        request.method === 'GET' &&
        request.params.get('id') === 'eq.student-404-1',
    )
    .flush([activeUserRow]);
  await flushMicrotasks();
  return auth;
}

describe('NotFound (404)', () => {
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

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('registra a rota curinga ** ao final de routes com loadComponent e sem authGuard', () => {
    const wildcardRoute = routes.at(-1);

    expect(wildcardRoute?.path).toBe('**');
    expect(typeof wildcardRoute?.loadComponent).toBe('function');
    expect(wildcardRoute?.canActivate).toBeUndefined();
  });

  it.each(['/rota-inexistente', '/driver/desconhecida', '/rides/algo/extra'])(
    'ativa a rota curinga %s sob demanda para visitante sem redirecionar ao login e aponta retorno para /',
    async (unknownRoute) => {
      const harness = await RouterTestingHarness.create(unknownRoute);
      const root = harness.routeNativeElement as HTMLElement;
      const returnLink = root.querySelector<HTMLAnchorElement>('[data-testid="not-found-return-link"]');

      expect(TestBed.inject(Router).url).toBe(unknownRoute);
      expect(fakeAuth.getSession).not.toHaveBeenCalled();
      expect(root.textContent).toContain('404');
      expect(root.querySelector('h1')?.textContent).toMatch(/página não encontrada/i);
      expect(returnLink).not.toBeNull();
      expect(returnLink?.getAttribute('href')).toBe('/');

      returnLink?.click();
      await harness.fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe('/');
    },
  );

  it.each(['/rota-inexistente', '/driver/desconhecida'])(
    'ativa a rota curinga %s para aluno autenticado exibindo 404 e direcionando retorno para /rides',
    async (unknownRoute) => {
      const http = TestBed.inject(HttpTestingController);
      await authenticateStudent(http);

      const harness = await RouterTestingHarness.create(unknownRoute);
      const root = harness.routeNativeElement as HTMLElement;
      const returnLink = root.querySelector<HTMLAnchorElement>('[data-testid="not-found-return-link"]');

      expect(TestBed.inject(Router).url).toBe(unknownRoute);
      expect(fakeAuth.getSession).not.toHaveBeenCalled();
      expect(root.textContent).toContain('404');
      expect(root.querySelector('h1')?.textContent).toMatch(/página não encontrada/i);
      expect(returnLink).not.toBeNull();
      expect(returnLink?.getAttribute('href')).toBe('/rides');

      returnLink?.click();
      await flushMicrotasks();

      http
        .match((request) => request.url.startsWith(environment.supabaseUrl))
        .forEach((request) => request.flush([]));
      await harness.fixture.whenStable();

      expect(TestBed.inject(Router).url).toBe('/rides');
    },
  );

  it('atualiza o destino de retorno para / quando a sessão é encerrada na tela 404', async () => {
    const http = TestBed.inject(HttpTestingController);
    const auth = await authenticateStudent(http);

    const harness = await RouterTestingHarness.create('/rota-inexistente');
    const root = harness.routeNativeElement as HTMLElement;

    expect(
      root.querySelector<HTMLAnchorElement>('[data-testid="not-found-return-link"]')?.getAttribute('href'),
    ).toBe('/rides');

    await auth.logout();
    harness.detectChanges();

    expect(
      root.querySelector<HTMLAnchorElement>('[data-testid="not-found-return-link"]')?.getAttribute('href'),
    ).toBe('/');
  });
});
