import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { environment } from '../../../../environments/environment';
import { routes } from '../../../app.routes';
import { errorInterceptor } from '../../../core/interceptors/error-interceptor';
import { AuthData } from '../../../core/services/auth-data';
import { ErrorNotice } from '../../../core/services/error-notice';
import { OFFLINE_ACTION_MESSAGE } from '../../../core/services/network-status';
import { SUPABASE_AUTH_CLIENT, SupabaseAuthClient } from '../../../core/services/supabase-client';

const usersUrl = `${environment.supabaseUrl}/rest/v1/users`;

const fakeSupabaseUser: SupabaseUser = {
  id: 'supabase-user-1',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
  email: 'ana@alunos.utfpr.edu.br',
  identities: [
    {
      id: 'id-1',
      user_id: 'supabase-user-1',
      identity_id: 'id-1',
      provider: 'email',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      last_sign_in_at: '2026-01-01T00:00:00.000Z',
      identity_data: {},
    },
  ],
};

const fakeSession: Session = {
  access_token: 'jwt-token',
  refresh_token: 'refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: fakeSupabaseUser,
};

function createFakeAuthClient(): SupabaseAuthClient {
  return {
    signUp: vi.fn(async () => ({ data: { user: fakeSupabaseUser, session: fakeSession }, error: null })),
    signInWithPassword: vi.fn(async (credentials) => {
      const email = 'email' in credentials ? credentials.email : fakeSupabaseUser.email;
      const user = { ...fakeSupabaseUser, email };
      return { data: { user, session: { ...fakeSession, user } }, error: null };
    }),
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

function setupLoginTesting(fakeAuth = createFakeAuthClient(), useErrorInterceptor = false) {
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      useErrorInterceptor
        ? provideHttpClient(withInterceptors([errorInterceptor]))
        : provideHttpClient(),
      provideHttpClientTesting(),
      { provide: SUPABASE_AUTH_CLIENT, useValue: fakeAuth },
    ],
  });
  return fakeAuth;
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

function fillCredentials(root: HTMLElement, emailValue: string, passwordValue: string): void {
  for (const [name, value] of [
    ['email', emailValue],
    ['password', passwordValue],
  ]) {
    const input = root.querySelector<HTMLInputElement>(`input[formControlName="${name}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

describe('Autenticação institucional', () => {
  it('informa mensagem amigável em português para credenciais inválidas sem vazar inglês ou consultar /rest/v1/users', async () => {
    const fakeAuth = createFakeAuthClient();
    setupLoginTesting(fakeAuth);
    const harness = await RouterTestingHarness.create('/login');
    const root = harness.routeNativeElement as HTMLElement;
    const http = TestBed.inject(HttpTestingController);
    const submit = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;

    for (const address of ['ausente@alunos.utfpr.edu.br', 'ana@alunos.utfpr.edu.br']) {
      vi.mocked(fakeAuth.signInWithPassword).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: {
          name: 'AuthApiError',
          message: 'Invalid login credentials',
          status: 400,
          code: 'invalid_credentials',
        } as never,
      });

      fillCredentials(root, address, 'senha-incorreta');
      root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flushMicrotasks();
      await harness.fixture.whenStable();

      expect(root.querySelector('[role="alert"]')?.textContent?.replace(/\s+/g, '')).toBe(
        'Falha na autenticação E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.'.replace(/\s+/g, ''),
      );
      expect(submit.disabled).toBe(false);
      expect(TestBed.inject(AuthData).isAuthenticated()).toBe(false);
      expect(TestBed.inject(AuthData).accessToken()).toBeNull();
      expect(TestBed.inject(Router).url).toBe('/login');
    }
    http.expectNone(usersUrl);
    http.verify();
  });

  it('bloqueia acesso de conta com isBlocked: true (RN07), chama signOut e não mantém sessão parcial', async () => {
    const fakeAuth = setupLoginTesting();
    const harness = await RouterTestingHarness.create('/login');
    const root = harness.routeNativeElement as HTMLElement;
    const http = TestBed.inject(HttpTestingController);
    const submit = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;

    fillCredentials(root, 'bloqueado@alunos.utfpr.edu.br', 'senha123');
    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushMicrotasks();

    http.expectOne((req) => req.url === usersUrl).flush([
      {
        id: 'blocked-1',
        name: 'Aluno Bloqueado',
        email: 'bloqueado@alunos.utfpr.edu.br',
        registration_number: '999',
        whatsapp: '',
        role: 'student',
        is_blocked: true,
        is_email_confirmed: true,
        rating_average: 0,
        created_at: '2026-01-01',
      },
    ]);
    await flushMicrotasks();
    await harness.fixture.whenStable();

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(submit.disabled).toBe(false);
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(TestBed.inject(AuthData).isAuthenticated()).toBe(false);
    expect(TestBed.inject(AuthData).accessToken()).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/login');
    http.verify();
  });

  it('não exibe a falha anterior ao sair e voltar para o login', async () => {
    const fakeAuth = createFakeAuthClient();
    vi.mocked(fakeAuth.signInWithPassword).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { name: 'AuthApiError', message: 'Invalid login credentials', status: 400, code: 'invalid_credentials' } as never,
    });
    setupLoginTesting(fakeAuth);
    const harness = await RouterTestingHarness.create('/login');
    const root = harness.routeNativeElement as HTMLElement;

    fillCredentials(root, 'ana@alunos.utfpr.edu.br', 'incorreta');
    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    await harness.fixture.whenStable();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();

    await harness.navigateByUrl('/register');
    await harness.navigateByUrl('/login');
    await harness.fixture.whenStable();
    const returned = harness.routeNativeElement as HTMLElement;
    expect(returned.querySelector('[role="alert"]')).toBeNull();
    expect(returned.querySelector<HTMLInputElement>('input[formControlName="email"]')?.value).toBe('');
    expect(returned.querySelector<HTMLInputElement>('input[formControlName="password"]')?.value).toBe('');
    TestBed.inject(HttpTestingController).verify();
  });

  it('autentica via Supabase Auth, armazena accessToken e entra em /rides', async () => {
    const fakeAuth = setupLoginTesting();
    const harness = await RouterTestingHarness.create('/login');
    const root = harness.routeNativeElement as HTMLElement;

    fillCredentials(root, 'ana@alunos.utfpr.edu.br', 'senha123');
    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushMicrotasks();

    expect(fakeAuth.signInWithPassword).toHaveBeenCalledWith({
      email: 'ana@alunos.utfpr.edu.br',
      password: 'senha123',
    });

    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne((req) => req.url === usersUrl && req.method === 'GET');
    request.flush([
      {
        id: '1',
        name: 'Ana',
        email: 'ana@alunos.utfpr.edu.br',
        registration_number: '123',
        whatsapp: '',
        role: 'student',
        is_blocked: false,
        is_email_confirmed: true,
        rating_average: 0,
        created_at: '2026-01-01',
      },
    ]);
    await flushMicrotasks();
    await harness.fixture.whenStable();

    const auth = TestBed.inject(AuthData);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.accessToken()).toBe('jwt-token');
    expect(TestBed.inject(Router).url).toBe('/rides');
    http.verify();
  });
});

it('redireciona visitantes que tentam acessar a área protegida', async () => {
  setupLoginTesting();
  await RouterTestingHarness.create('/rides');
  expect(TestBed.inject(Router).url).toBe('/login');
});

it('informa falha de conexão quando signInWithPassword falha por rede sem travar loading e permite tentar novamente', async () => {
  const fakeAuth = createFakeAuthClient();
  vi.mocked(fakeAuth.signInWithPassword).mockRejectedValueOnce(new TypeError('Failed to fetch'));
  setupLoginTesting(fakeAuth);
  const harness = await RouterTestingHarness.create('/login');
  const root = harness.routeNativeElement as HTMLElement;

  fillCredentials(root, 'ana@alunos.utfpr.edu.br', 'senha123');
  const submit = () => root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  const http = TestBed.inject(HttpTestingController);

  submit();
  await flushMicrotasks();
  await harness.fixture.whenStable();

  expect(root.querySelector('[role="alert"]')?.textContent).toContain('conexão');
  expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  expect(TestBed.inject(AuthData).isAuthenticated()).toBe(false);
  expect(TestBed.inject(AuthData).accessToken()).toBeNull();

  submit();
  await flushMicrotasks();
  http.expectOne((request) => request.url === usersUrl).flush([
    {
      id: '1',
      name: 'Ana',
      email: 'ana@alunos.utfpr.edu.br',
      registration_number: '123',
      whatsapp: '',
      role: 'student',
      is_blocked: false,
      is_email_confirmed: true,
      rating_average: 0,
      created_at: '2026-01-01',
    },
  ]);
  await flushMicrotasks();
  await harness.fixture.whenStable();
  expect(TestBed.inject(Router).url).toBe('/rides');
  http.verify();
});

it('informa falha inesperada do Supabase Auth sem travar loading e permite tentar novamente', async () => {
  const fakeAuth = createFakeAuthClient();
  vi.mocked(fakeAuth.signInWithPassword).mockResolvedValueOnce({
    data: { user: null, session: null },
    error: { name: 'AuthApiError', message: 'Internal error', status: 500, code: 'unexpected_failure' } as never,
  });
  setupLoginTesting(fakeAuth);
  const harness = await RouterTestingHarness.create('/login');
  const root = harness.routeNativeElement as HTMLElement;
  const notice = TestBed.inject(ErrorNotice);
  const http = TestBed.inject(HttpTestingController);

  fillCredentials(root, 'ana@alunos.utfpr.edu.br', 'senha123');
  const submit = () => root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  submit();
  await flushMicrotasks();
  await harness.fixture.whenStable();

  expect(notice.message()).toBe('Falha inesperada. Tente novamente.');
  expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  expect(TestBed.inject(AuthData).isAuthenticated()).toBe(false);

  submit();
  await flushMicrotasks();
  http.expectOne((request) => request.url === usersUrl).flush([
    {
      id: '1',
      name: 'Ana',
      email: 'ana@alunos.utfpr.edu.br',
      registration_number: '123',
      whatsapp: '',
      role: 'student',
      is_blocked: false,
      is_email_confirmed: true,
      rating_average: 0,
      created_at: '2026-01-01',
    },
  ]);
  await flushMicrotasks();
  await harness.fixture.whenStable();
  expect(notice.message()).toBe('');
  expect(TestBed.inject(Router).url).toBe('/rides');
  http.verify();
});

it.each([401, 500])('informa erro %i no login e remove o aviso ao entrar após nova tentativa', async (status) => {
  setupLoginTesting(createFakeAuthClient(), true);
  const harness = await RouterTestingHarness.create('/login');
  const root = harness.routeNativeElement as HTMLElement;

  fillCredentials(root, 'ana@alunos.utfpr.edu.br', 'senha123');
  const submit = () => root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  const http = TestBed.inject(HttpTestingController);
  const notice = TestBed.inject(ErrorNotice);

  submit();
  await flushMicrotasks();
  http.expectOne((request) => request.url === usersUrl).flush('', { status, statusText: 'Erro' });
  await flushMicrotasks();
  await harness.fixture.whenStable();

  expect(TestBed.inject(Router).url).toBe('/login');
  expect(notice.message()).not.toBe('');
  expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);

  submit();
  await flushMicrotasks();
  http.expectOne((request) => request.url === usersUrl).flush([
    {
      id: '1',
      name: 'Ana',
      email: 'ana@alunos.utfpr.edu.br',
      registration_number: '123',
      whatsapp: '',
      role: 'student',
      is_blocked: false,
      is_email_confirmed: true,
      rating_average: 0,
      created_at: '2026-01-01',
    },
  ]);
  await flushMicrotasks();
  await harness.fixture.whenStable();

  expect(TestBed.inject(Router).url).toBe('/rides');
  expect(notice.message()).toBe('');
  http.verify();
});

it('exibe aviso em português de conta criada com sucesso ao navegar vindo do cadastro e oculta ao submeter ou acessar direto', async () => {
  const fakeAuth = createFakeAuthClient();
  vi.mocked(fakeAuth.signInWithPassword).mockResolvedValueOnce({
    data: { user: null, session: null },
    error: { name: 'AuthApiError', message: 'Invalid login credentials', status: 400, code: 'invalid_credentials' } as never,
  });
  setupLoginTesting(fakeAuth);
  const harness = await RouterTestingHarness.create('/');
  const router = TestBed.inject(Router);

  await router.navigateByUrl('/login', { state: { accountCreated: true } });
  await harness.fixture.whenStable();
  const root = harness.routeNativeElement as HTMLElement;
  const statusBanner = root.querySelector<HTMLElement>('[role="status"]');
  expect(statusBanner).not.toBeNull();
  expect(statusBanner?.textContent).toContain('Conta criada com sucesso');
  expect(statusBanner?.className).toContain('bg-sucesso-fundo');
  expect(statusBanner?.className).toContain('text-sucesso');

  fillCredentials(root, 'ana@alunos.utfpr.edu.br', 'incorreta');
  root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await flushMicrotasks();
  await harness.fixture.whenStable();
  expect(root.querySelector('[role="status"]')).toBeNull();

  await router.navigateByUrl('/register');
  await router.navigateByUrl('/login');
  await harness.fixture.whenStable();
  expect((harness.routeNativeElement as HTMLElement).querySelector('[role="status"]')).toBeNull();
  TestBed.inject(HttpTestingController).verify();
});

describe('comportamento offline e reconexão em Login (CA2, CA7)', () => {
  it('desabilita o envio offline, exibe OFFLINE_ACTION_MESSAGE acessível e impede submit sem chamadas de rede', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const fakeAuth = setupLoginTesting();
    const harness = await RouterTestingHarness.create('/login');
    const root = harness.routeNativeElement as HTMLElement;
    const http = TestBed.inject(HttpTestingController);

    fillCredentials(root, 'ana@alunos.utfpr.edu.br', 'senha123');
    await harness.fixture.whenStable();

    const submit = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submit.disabled).toBe(true);
    const describedById = submit.getAttribute('aria-describedby');
    expect(describedById).toBeTruthy();
    const hint = root.querySelector(`#${describedById}`);
    expect(hint).not.toBeNull();
    expect(hint?.textContent).toContain(OFFLINE_ACTION_MESSAGE);

    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushMicrotasks();

    expect(fakeAuth.signInWithPassword).not.toHaveBeenCalled();
    http.expectNone(usersUrl);
    expect(TestBed.inject(Router).url).toBe('/login');
    http.verify();
  });

  it('reage aos eventos offline e online reabilitando o envio válido ao reconectar', async () => {
    const fakeAuth = setupLoginTesting();
    const harness = await RouterTestingHarness.create('/login');
    const root = harness.routeNativeElement as HTMLElement;
    const http = TestBed.inject(HttpTestingController);

    fillCredentials(root, 'ana@alunos.utfpr.edu.br', 'senha123');
    await harness.fixture.whenStable();
    const submit = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submit.disabled).toBe(false);

    window.dispatchEvent(new Event('offline'));
    await harness.fixture.whenStable();

    expect(submit.disabled).toBe(true);
    expect(root.textContent).toContain(OFFLINE_ACTION_MESSAGE);
    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    expect(fakeAuth.signInWithPassword).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('online'));
    await harness.fixture.whenStable();

    expect(submit.disabled).toBe(false);
    expect(root.textContent).not.toContain(OFFLINE_ACTION_MESSAGE);

    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushMicrotasks();
    http.expectOne((request) => request.url === usersUrl).flush([
      {
        id: '1',
        name: 'Ana',
        email: 'ana@alunos.utfpr.edu.br',
        registration_number: '123',
        whatsapp: '',
        role: 'student',
        is_blocked: false,
        is_email_confirmed: true,
        rating_average: 0,
        created_at: '2026-01-01',
      },
    ]);
    await flushMicrotasks();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/rides');
    http.verify();
  });
});
