import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { AuthData } from './auth-data';
import { SUPABASE_AUTH_CLIENT, SupabaseAuthClient } from './supabase-client';

const fakeSupabaseUser: SupabaseUser = {
  id: 'supabase-user-1',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
  email: 'ana@alunos.utfpr.edu.br',
  identities: [{ id: 'id-1', user_id: 'supabase-user-1', identity_id: 'id-1', provider: 'email', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z', last_sign_in_at: '2026-01-01T00:00:00.000Z', identity_data: {} }],
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

describe('AuthData', () => {
  it('cadastra no Supabase Auth com metadados, espelha em /users sem senha e encerra sessão automática', async () => {
    const fakeAuth = createFakeAuthClient();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: fakeAuth },
      ],
    });
    const service = TestBed.inject(AuthData);
    expect(service.result()).toBeUndefined();
    service.register({ name: 'Ana', email: 'ana@alunos.utfpr.edu.br', registrationNumber: '123', password: 'senha123', whatsapp: '41987654321' });
    const http = TestBed.inject(HttpTestingController);
    const lookup = http.expectOne((request) => request.url === 'http://localhost:3000/registration-exists' && request.method === 'POST');
    expect(lookup.request.body).toEqual({ email: 'ana@alunos.utfpr.edu.br', registrationNumber: '123' });
    lookup.flush({ exists: false });

    await flushMicrotasks();

    expect(fakeAuth.signUp).toHaveBeenCalledWith({
      email: 'ana@alunos.utfpr.edu.br',
      password: 'senha123',
      options: {
        data: {
          name: 'Ana',
          registrationNumber: '123',
          whatsapp: '41987654321',
          role: 'student',
          isBlocked: false,
        },
      },
    });

    const request = http.expectOne('http://localhost:3000/users');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      id: 'supabase-user-1',
      name: 'Ana',
      email: 'ana@alunos.utfpr.edu.br',
      registrationNumber: '123',
      whatsapp: '41987654321',
      role: 'student',
      isBlocked: false,
      isEmailConfirmed: true,
      ratingAverage: 0,
      createdAt: expect.any(String),
    });
    expect(request.request.body).not.toHaveProperty('password');
    const user = { ...request.request.body };
    request.flush(user);

    await flushMicrotasks();

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(service.result()).toEqual({ duplicate: false, user });
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();
    http.verify();
  });

  it('retorna duplicado quando o Supabase Auth informa usuário já registrado sem espelhar em /users', async () => {
    const fakeAuth = createFakeAuthClient();
    vi.mocked(fakeAuth.signUp).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { name: 'AuthApiError', message: 'User already registered', status: 422, code: 'user_already_exists' } as never,
    });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: fakeAuth },
      ],
    });
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    service.register({ name: 'Ana', email: 'ana@alunos.utfpr.edu.br', registrationNumber: '123', password: 'senha123', whatsapp: '' });
    http.expectOne('http://localhost:3000/registration-exists').flush({ exists: false });

    await flushMicrotasks();

    expect(service.result()).toEqual({ duplicate: true });
    http.expectNone('http://localhost:3000/users');
    http.verify();
  });

  it('retorna duplicado quando o Supabase Auth retorna usuário ofuscado sem identidades', async () => {
    const fakeAuth = createFakeAuthClient();
    vi.mocked(fakeAuth.signUp).mockResolvedValueOnce({
      data: { user: { ...fakeSupabaseUser, identities: [] }, session: null },
      error: null,
    });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: fakeAuth },
      ],
    });
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    service.register({ name: 'Ana', email: 'ana@alunos.utfpr.edu.br', registrationNumber: '123', password: 'senha123', whatsapp: '' });
    http.expectOne('http://localhost:3000/registration-exists').flush({ exists: false });

    await flushMicrotasks();

    expect(service.result()).toEqual({ duplicate: true });
    http.expectNone('http://localhost:3000/users');
    http.verify();
  });

  it.each([
    ['weak_password', 'Password should be at least 6 characters', 422, 'A senha deve ter pelo menos 6 caracteres.'],
    ['email_address_invalid', 'Unable to validate email address: invalid format', 400, 'Informe um e-mail institucional válido (@alunos.utfpr.edu.br).'],
    ['over_email_send_rate_limit', 'Email rate limit exceeded', 429, 'Muitas tentativas seguidas. Aguarde alguns instantes e tente novamente.'],
    ['signup_disabled', 'Signups not allowed for this instance', 403, 'Não foi possível concluir o cadastro. Tente novamente.'],
  ])('traduz erro %s do Supabase Auth no cadastro para português', async (code, message, status, expectedMessage) => {
    const fakeAuth = createFakeAuthClient();
    vi.mocked(fakeAuth.signUp).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { name: 'AuthApiError', message, status, code } as never,
    });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: fakeAuth },
      ],
    });
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    service.register({ name: 'Ana', email: 'ana@alunos.utfpr.edu.br', registrationNumber: '123', password: 'senha123', whatsapp: '' });
    http.expectOne('http://localhost:3000/registration-exists').flush({ exists: false });

    await flushMicrotasks();

    expect(service.result()).toEqual({ authError: expectedMessage });
    http.expectNone('http://localhost:3000/users');
    http.verify();
  });

  it('disponibiliza o perfil do aluno autenticado sem expor a senha', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    expect(service.currentUser()).toBeNull();

    service.login('ana@alunos.utfpr.edu.br', 'senha123');
    http.expectOne((request) => request.url === 'http://localhost:3000/users').flush([
      {
        id: '1',
        name: 'Ana',
        email: 'ana@alunos.utfpr.edu.br',
        password: 'senha123',
        registrationNumber: '123',
        whatsapp: '41987654321',
        role: 'student',
        isBlocked: false,
        isEmailConfirmed: true,
        ratingAverage: 4.5,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    expect(service.currentUser()).toEqual({
      id: '1',
      name: 'Ana',
      email: 'ana@alunos.utfpr.edu.br',
      registrationNumber: '123',
      whatsapp: '41987654321',
      role: 'student',
      isBlocked: false,
      isEmailConfirmed: true,
      ratingAverage: 4.5,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(service.currentUser()).not.toHaveProperty('password');

    service.logout();
    expect(service.currentUser()).toBeNull();
    http.verify();
  });

  it('impede login de conta bloqueada (isBlocked: true) mantendo usuário não autenticado e inapto a ofertar', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    service.login('bloqueado@alunos.utfpr.edu.br', 'senha123');
    http.expectOne((request) => request.url === `${environment.apiUrl}/users`).flush([
      {
        id: 'blocked-1',
        name: 'Aluno Bloqueado',
        email: 'bloqueado@alunos.utfpr.edu.br',
        password: 'senha123',
        registrationNumber: '999',
        whatsapp: '41999990000',
        role: 'student',
        isBlocked: true,
        isEmailConfirmed: true,
        ratingAverage: 4.0,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.canOffer()).toBe(false);
    expect(service.loginResult()).toEqual({ user: null, blocked: true });
    http.verify();
  });

  it('expõe canOffer e isBlocked coerentes com o perfil autenticado', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    expect(service.canOffer()).toBe(false);
    expect(service.isBlocked()).toBe(false);

    service.login('ana@alunos.utfpr.edu.br', 'senha123');
    http.expectOne((request) => request.url === `${environment.apiUrl}/users`).flush([
      {
        id: '1',
        name: 'Ana',
        email: 'ana@alunos.utfpr.edu.br',
        password: 'senha123',
        registrationNumber: '123',
        whatsapp: '41987654321',
        role: 'student',
        isBlocked: false,
        isEmailConfirmed: true,
        ratingAverage: 4.5,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    expect(service.canOffer()).toBe(true);
    expect(service.isBlocked()).toBe(false);

    service.login('suporte@alunos.utfpr.edu.br', 'senha123');
    http.expectOne((request) => request.url === `${environment.apiUrl}/users`).flush([
      {
        id: 'support-1',
        name: 'Suporte',
        email: 'suporte@alunos.utfpr.edu.br',
        password: 'senha123',
        registrationNumber: '000',
        whatsapp: '41900000000',
        role: 'support',
        isBlocked: false,
        isEmailConfirmed: true,
        ratingAverage: 5,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    expect(service.canOffer()).toBe(false);

    service.logout();
    expect(service.canOffer()).toBe(false);
    http.verify();
  });
});

describe('classificação de falhas de autenticação', () => {
  const registration = { name: 'Ana', email: 'ana@alunos.utfpr.edu.br', registrationNumber: '123', password: 'senha123', whatsapp: '41987654321' };
  let fakeAuth: SupabaseAuthClient;

  beforeEach(() => {
    fakeAuth = createFakeAuthClient();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: fakeAuth },
      ],
    });
  });

  it.each([401, 403, 500])('permite nova tentativa após erro HTTP %i no login', (status) => {
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    service.login(registration.email, registration.password);
    http.expectOne((request) => request.url.endsWith('/users')).flush('erro', { status, statusText: 'Erro' });
    expect(service.loginResult()).toEqual({ requestError: true });
    service.login(registration.email, registration.password);
    http.expectOne((request) => request.url.endsWith('/users')).flush([]);
    expect(service.loginResult()).toEqual({ user: null });
    http.verify();
  });

  it('permite nova tentativa após erro HTTP no cadastro', () => {
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    service.register(registration);
    http.expectOne((request) => request.url.endsWith('/registration-exists')).flush('erro', { status: 500, statusText: 'Erro' });
    expect(service.result()).toEqual({ requestError: true });
    expect(fakeAuth.signUp).not.toHaveBeenCalled();
    service.register(registration);
    http.expectOne((request) => request.url.endsWith('/registration-exists')).flush({ exists: true });
    expect(service.result()).toEqual({ duplicate: true });
    expect(fakeAuth.signUp).not.toHaveBeenCalled();
    http.verify();
  });

  it('permite nova tentativa após erro de processamento no login', () => {
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    service.login(registration.email, registration.password);
    http.expectOne((request) => request.url.endsWith('/users')).flush({});
    expect(service.loginResult()).toEqual({ requestError: true });
    service.login(registration.email, registration.password);
    http.expectOne((request) => request.url.endsWith('/users')).flush([]);
    expect(service.loginResult()).toEqual({ user: null });
    http.verify();
  });

  it('informa falha de conexão ao criar a conta no json-server e limpa eventual sessão do Supabase', async () => {
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    service.register(registration);
    http.expectOne((request) => request.url.endsWith('/registration-exists')).flush({ exists: false });
    await flushMicrotasks();
    http.expectOne((request) => request.url.endsWith('/users')).error(new ProgressEvent('error'));
    await flushMicrotasks();
    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(service.result()).toEqual({ connectionError: true });
    http.verify();
  });

  it('informa falha de conexão quando o signUp do Supabase falha por rede', async () => {
    vi.mocked(fakeAuth.signUp).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    service.register(registration);
    http.expectOne((request) => request.url.endsWith('/registration-exists')).flush({ exists: false });
    await flushMicrotasks();
    expect(service.result()).toEqual({ connectionError: true });
    http.expectNone((request) => request.url.endsWith('/users'));
    http.verify();
  });

  it('não conclui o cadastro com sucesso quando signOut retorna erro após criar o perfil em /users', async () => {
    vi.mocked(fakeAuth.signOut).mockResolvedValueOnce({
      error: { name: 'AuthApiError', message: 'Logout failed', status: 500 } as never,
    });
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    service.register(registration);
    http.expectOne((request) => request.url.endsWith('/registration-exists')).flush({ exists: false });
    await flushMicrotasks();
    const request = http.expectOne((request) => request.url.endsWith('/users'));
    request.flush({ id: 'supabase-user-1', ...request.request.body });
    await flushMicrotasks();

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(service.result()).toEqual({ authError: 'Não foi possível concluir o cadastro. Tente novamente.' });
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();
    http.verify();
  });

  it('informa falha de conexão quando signOut rejeita por rede após criar o perfil em /users', async () => {
    vi.mocked(fakeAuth.signOut).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    service.register(registration);
    http.expectOne((request) => request.url.endsWith('/registration-exists')).flush({ exists: false });
    await flushMicrotasks();
    const request = http.expectOne((request) => request.url.endsWith('/users'));
    request.flush({ id: 'supabase-user-1', ...request.request.body });
    await flushMicrotasks();

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(service.result()).toEqual({ connectionError: true });
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();
    http.verify();
  });

  it('não conclui o cadastro com sucesso quando signOut rejeita por erro inesperado após criar o perfil em /users', async () => {
    vi.mocked(fakeAuth.signOut).mockRejectedValueOnce(new Error('Storage unavailable'));
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    service.register(registration);
    http.expectOne((request) => request.url.endsWith('/registration-exists')).flush({ exists: false });
    await flushMicrotasks();
    const request = http.expectOne((request) => request.url.endsWith('/users'));
    request.flush({ id: 'supabase-user-1', ...request.request.body });
    await flushMicrotasks();

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(service.result()).toEqual({ authError: 'Não foi possível concluir o cadastro. Tente novamente.' });
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();
    http.verify();
  });

  it('preserva o erro HTTP original do json-server no rollback mesmo quando signOut falha', async () => {
    vi.mocked(fakeAuth.signOut).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    service.register(registration);
    http.expectOne((request) => request.url.endsWith('/registration-exists')).flush({ exists: false });
    await flushMicrotasks();
    http.expectOne((request) => request.url.endsWith('/users')).flush('erro', { status: 500, statusText: 'Erro' });
    await flushMicrotasks();

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(service.result()).toEqual({ requestError: true });
    http.verify();
  });
});

it('usa a URL configurada para cadastro e login', async () => {
  const originalApiUrl = environment.apiUrl;
  environment.apiUrl = 'http://api.test';
  try {
    const fakeAuth = createFakeAuthClient();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: fakeAuth },
      ],
    });
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    service.register({ name: 'Ana', email: 'ana@alunos.utfpr.edu.br', registrationNumber: '123', password: 'senha123', whatsapp: '41987654321' });
    http.expectOne('http://api.test/registration-exists').flush({ exists: false });
    await flushMicrotasks();
    http.expectOne('http://api.test/users').flush({});
    await flushMicrotasks();
    service.login('ana@alunos.utfpr.edu.br', 'senha123');
    http.expectOne((request) => request.url === 'http://api.test/users' && request.params.get('email') === 'ana@alunos.utfpr.edu.br').flush([]);
    http.verify();
  } finally {
    environment.apiUrl = originalApiUrl;
  }
});
