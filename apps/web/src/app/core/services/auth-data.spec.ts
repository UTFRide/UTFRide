import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { AuthData } from './auth-data';
import { ErrorNotice } from './error-notice';
import { OfflineCache } from './offline-cache';
import { SUPABASE_AUTH_CLIENT, SupabaseAuthClient } from './supabase-client';

const usersUrl = `${environment.supabaseUrl}/rest/v1/users`;
const registrationExistsRpcUrl = `${environment.supabaseUrl}/rest/v1/rpc/check_registration_exists`;

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

describe('AuthData', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('cadastra no Supabase Auth com metadados, grava perfil em /rest/v1/users sem senha e encerra sessão automática', async () => {
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
    const lookup = http.expectOne((request) => request.url === registrationExistsRpcUrl && request.method === 'POST');
    expect(lookup.request.body).toEqual({ p_email: 'ana@alunos.utfpr.edu.br', p_registration_number: '123' });
    lookup.flush(false);

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

    const request = http.expectOne(usersUrl);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    expect(request.request.headers.get('Prefer')).toBe('return=representation');
    expect(request.request.headers.get('Accept')).toBe('application/vnd.pgrst.object+json');
    expect(request.request.body).toEqual({
      id: 'supabase-user-1',
      name: 'Ana',
      email: 'ana@alunos.utfpr.edu.br',
      registration_number: '123',
      whatsapp: '41987654321',
      role: 'student',
      is_blocked: false,
      is_email_confirmed: true,
      rating_average: 0,
      created_at: expect.any(String),
    });
    expect(request.request.body).not.toHaveProperty('password');
    const row = { ...request.request.body };
    request.flush(row);

    await flushMicrotasks();

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(service.result()).toEqual({
      duplicate: false,
      user: {
        id: 'supabase-user-1',
        name: 'Ana',
        email: 'ana@alunos.utfpr.edu.br',
        registrationNumber: '123',
        whatsapp: '41987654321',
        password: '',
        role: 'student',
        isBlocked: false,
        isEmailConfirmed: true,
        ratingAverage: 0,
        createdAt: row.created_at,
      },
    });
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();
    http.verify();
  });

  it('retorna duplicado quando o Supabase Auth informa usuário já registrado sem gravar em /rest/v1/users', async () => {
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
    http.expectOne(registrationExistsRpcUrl).flush(false);

    await flushMicrotasks();

    expect(service.result()).toEqual({ duplicate: true });
    http.expectNone(usersUrl);
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
    http.expectOne(registrationExistsRpcUrl).flush(false);

    await flushMicrotasks();

    expect(service.result()).toEqual({ duplicate: true });
    http.expectNone(usersUrl);
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
    http.expectOne(registrationExistsRpcUrl).flush(false);

    await flushMicrotasks();

    expect(service.result()).toEqual({ authError: expectedMessage });
    http.expectNone(usersUrl);
    http.verify();
  });

  it('autentica via Supabase Auth, busca perfil em /rest/v1/users e armazena accessToken sem expor senha', async () => {
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

    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();

    service.login('ana@alunos.utfpr.edu.br', 'senha123');
    await flushMicrotasks();

    expect(fakeAuth.signInWithPassword).toHaveBeenCalledWith({
      email: 'ana@alunos.utfpr.edu.br',
      password: 'senha123',
    });

    const profileRequest = http.expectOne(
      (request) =>
        request.url === usersUrl &&
        request.method === 'GET' &&
        request.params.get('id') === 'eq.supabase-user-1',
    );
    expect(profileRequest.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    profileRequest.flush([
      {
        id: 'supabase-user-1',
        name: 'Ana',
        email: 'ana@alunos.utfpr.edu.br',
        registration_number: '123',
        whatsapp: '41987654321',
        role: 'student',
        is_blocked: false,
        is_email_confirmed: true,
        rating_average: 4.5,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    await flushMicrotasks();

    expect(service.accessToken()).toBe('jwt-token');
    expect(service.currentUser()).toEqual({
      id: 'supabase-user-1',
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

  it('sincroniza o perfil espelho em /rest/v1/users a partir dos metadados do Supabase quando não existe no banco', async () => {
    const fakeAuth = createFakeAuthClient();
    const userWithMetadata: SupabaseUser = {
      ...fakeSupabaseUser,
      id: 'supabase-mirror-1',
      email: 'novo@alunos.utfpr.edu.br',
      user_metadata: {
        name: 'Novo Aluno',
        registrationNumber: '2026123',
        whatsapp: '41999991111',
        role: 'student',
        isBlocked: false,
      },
    };
    vi.mocked(fakeAuth.signInWithPassword).mockResolvedValueOnce({
      data: { user: userWithMetadata, session: { ...fakeSession, access_token: 'jwt-mirror', user: userWithMetadata } },
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

    service.login('novo@alunos.utfpr.edu.br', 'senha123');
    await flushMicrotasks();

    http
      .expectOne(
        (request) =>
          request.url === usersUrl &&
          request.method === 'GET' &&
          request.params.get('id') === 'eq.supabase-mirror-1',
      )
      .flush([]);

    const postRequest = http.expectOne(
      (request) => request.url === usersUrl && request.method === 'POST',
    );
    expect(postRequest.request.headers.get('Authorization')).toBe('Bearer jwt-mirror');
    expect(postRequest.request.body).toEqual({
      id: 'supabase-mirror-1',
      name: 'Novo Aluno',
      email: 'novo@alunos.utfpr.edu.br',
      registration_number: '2026123',
      whatsapp: '41999991111',
      role: 'student',
      is_blocked: false,
      is_email_confirmed: true,
      rating_average: 0,
      created_at: expect.any(String),
    });
    expect(postRequest.request.body).not.toHaveProperty('password');
    const row = { ...postRequest.request.body };
    postRequest.flush(row);
    await flushMicrotasks();

    const expectedUser = {
      id: 'supabase-mirror-1',
      name: 'Novo Aluno',
      email: 'novo@alunos.utfpr.edu.br',
      registrationNumber: '2026123',
      whatsapp: '41999991111',
      role: 'student',
      isBlocked: false,
      isEmailConfirmed: true,
      ratingAverage: 0,
      createdAt: row.created_at,
    };

    expect(service.accessToken()).toBe('jwt-mirror');
    expect(service.currentUser()).toEqual(expectedUser);
    expect(service.loginResult()).toEqual({ user: { ...expectedUser, password: '' } });
    http.verify();
  });

  it('impede login de conta bloqueada (isBlocked: true), encerra sessão no Supabase e zera token', async () => {
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

    service.login('bloqueado@alunos.utfpr.edu.br', 'senha123');
    await flushMicrotasks();

    http.expectOne((request) => request.url === usersUrl).flush([
      {
        id: 'blocked-1',
        name: 'Aluno Bloqueado',
        email: 'bloqueado@alunos.utfpr.edu.br',
        registration_number: '999',
        whatsapp: '41999990000',
        role: 'student',
        is_blocked: true,
        is_email_confirmed: true,
        rating_average: 4.0,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    await flushMicrotasks();

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.canOffer()).toBe(false);
    expect(service.loginResult()).toEqual({ user: null, blocked: true });
    http.verify();
  });

  it('expõe canOffer e isBlocked coerentes com o perfil autenticado', async () => {
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

    expect(service.canOffer()).toBe(false);
    expect(service.isBlocked()).toBe(false);

    service.login('ana@alunos.utfpr.edu.br', 'senha123');
    await flushMicrotasks();
    http.expectOne((request) => request.url === usersUrl).flush([
      {
        id: '1',
        name: 'Ana',
        email: 'ana@alunos.utfpr.edu.br',
        registration_number: '123',
        whatsapp: '41987654321',
        role: 'student',
        is_blocked: false,
        is_email_confirmed: true,
        rating_average: 4.5,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    await flushMicrotasks();

    expect(service.canOffer()).toBe(true);
    expect(service.isBlocked()).toBe(false);

    service.login('suporte@alunos.utfpr.edu.br', 'senha123');
    await flushMicrotasks();
    http.expectOne((request) => request.url === usersUrl).flush([
      {
        id: 'support-1',
        name: 'Suporte',
        email: 'suporte@alunos.utfpr.edu.br',
        registration_number: '000',
        whatsapp: '41900000000',
        role: 'support',
        is_blocked: false,
        is_email_confirmed: true,
        rating_average: 5,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    await flushMicrotasks();

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
    localStorage.clear();
    fakeAuth = createFakeAuthClient();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: fakeAuth },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it.each([401, 403, 500])('permite nova tentativa após erro HTTP %i no login e limpa sessão do Supabase', async (status) => {
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    service.login(registration.email, registration.password);
    await flushMicrotasks();
    http.expectOne((request) => request.url === usersUrl).flush('erro', { status, statusText: 'Erro' });
    await flushMicrotasks();

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(service.loginResult()).toEqual({ requestError: true });
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();

    vi.mocked(fakeAuth.signInWithPassword).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { name: 'AuthApiError', message: 'Invalid login credentials', status: 400, code: 'invalid_credentials' } as never,
    });
    service.login(registration.email, registration.password);
    await flushMicrotasks();

    expect(service.loginResult()).toEqual({ user: null });
    http.expectNone(usersUrl);
    http.verify();
  });

  it('retorna user null sem consultar /rest/v1/users nem vazar erro em inglês quando credenciais são inválidas no Supabase', async () => {
    vi.mocked(fakeAuth.signInWithPassword).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { name: 'AuthApiError', message: 'Invalid login credentials', status: 400, code: 'invalid_credentials' } as never,
    });
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    const notice = TestBed.inject(ErrorNotice);

    service.login(registration.email, 'errada');
    await flushMicrotasks();

    expect(service.loginResult()).toEqual({ user: null });
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();
    expect(notice.message()).toBe('');
    http.expectNone(usersUrl);
    http.verify();
  });

  it('informa falha de conexão quando signInWithPassword falha por rede sem consultar /rest/v1/users', async () => {
    vi.mocked(fakeAuth.signInWithPassword).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    service.login(registration.email, registration.password);
    await flushMicrotasks();

    expect(service.loginResult()).toEqual({ connectionError: true });
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();
    http.expectNone(usersUrl);
    http.verify();
  });

  it('notifica erro amigável em português quando signInWithPassword falha com erro inesperado', async () => {
    vi.mocked(fakeAuth.signInWithPassword).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { name: 'AuthApiError', message: 'Internal server error', status: 500, code: 'unexpected_failure' } as never,
    });
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    const notice = TestBed.inject(ErrorNotice);

    service.login(registration.email, registration.password);
    await flushMicrotasks();

    expect(service.loginResult()).toEqual({ requestError: true });
    expect(notice.message()).toBe('Falha inesperada. Tente novamente.');
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();
    http.expectNone(usersUrl);
    http.verify();
  });

  it('informa falha de conexão e encerra sessão do Supabase quando GET ou POST /rest/v1/users falha no login', async () => {
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    service.login(registration.email, registration.password);
    await flushMicrotasks();
    http.expectOne((request) => request.url === usersUrl && request.method === 'GET').flush([]);
    http.expectOne((request) => request.url === usersUrl && request.method === 'POST').error(new ProgressEvent('error'));
    await flushMicrotasks();

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(service.loginResult()).toEqual({ connectionError: true });
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();
    http.verify();
  });

  it('não engole erro nem mantém sessão ativa se signOut falhar ao bloquear conta com isBlocked: true', async () => {
    vi.mocked(fakeAuth.signOut).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    service.login('bloqueado@alunos.utfpr.edu.br', registration.password);
    await flushMicrotasks();
    http.expectOne((request) => request.url === usersUrl).flush([
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
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    await flushMicrotasks();

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(service.loginResult()).toEqual({ connectionError: true });
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();
    http.verify();
  });

  it('permite nova tentativa após erro HTTP no cadastro', () => {
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    service.register(registration);
    http.expectOne(registrationExistsRpcUrl).flush('erro', { status: 500, statusText: 'Erro' });
    expect(service.result()).toEqual({ requestError: true });
    expect(fakeAuth.signUp).not.toHaveBeenCalled();
    service.register(registration);
    http.expectOne(registrationExistsRpcUrl).flush(true);
    expect(service.result()).toEqual({ duplicate: true });
    expect(fakeAuth.signUp).not.toHaveBeenCalled();
    http.verify();
  });

  it('permite nova tentativa após erro de processamento no login', async () => {
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    service.login(registration.email, registration.password);
    await flushMicrotasks();
    http.expectOne((request) => request.url === usersUrl).flush({});
    await flushMicrotasks();

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(service.loginResult()).toEqual({ requestError: true });
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();

    vi.mocked(fakeAuth.signInWithPassword).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { name: 'AuthApiError', message: 'Invalid login credentials', status: 400, code: 'invalid_credentials' } as never,
    });
    service.login(registration.email, registration.password);
    await flushMicrotasks();

    expect(service.loginResult()).toEqual({ user: null });
    http.verify();
  });

  it('informa falha de conexão ao gravar perfil no Supabase e limpa eventual sessão do Auth', async () => {
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    service.register(registration);
    http.expectOne(registrationExistsRpcUrl).flush(false);
    await flushMicrotasks();
    http.expectOne(usersUrl).error(new ProgressEvent('error'));
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
    http.expectOne(registrationExistsRpcUrl).flush(false);
    await flushMicrotasks();
    expect(service.result()).toEqual({ connectionError: true });
    http.expectNone(usersUrl);
    http.verify();
  });

  it('não conclui o cadastro com sucesso quando signOut retorna erro após criar o perfil em /rest/v1/users', async () => {
    vi.mocked(fakeAuth.signOut).mockResolvedValueOnce({
      error: { name: 'AuthApiError', message: 'Logout failed', status: 500 } as never,
    });
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    service.register(registration);
    http.expectOne(registrationExistsRpcUrl).flush(false);
    await flushMicrotasks();
    const request = http.expectOne(usersUrl);
    request.flush({ id: 'supabase-user-1', ...request.request.body });
    await flushMicrotasks();

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(service.result()).toEqual({ authError: 'Não foi possível concluir o cadastro. Tente novamente.' });
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();
    http.verify();
  });

  it('informa falha de conexão quando signOut rejeita por rede após criar o perfil em /rest/v1/users', async () => {
    vi.mocked(fakeAuth.signOut).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    service.register(registration);
    http.expectOne(registrationExistsRpcUrl).flush(false);
    await flushMicrotasks();
    const request = http.expectOne(usersUrl);
    request.flush({ id: 'supabase-user-1', ...request.request.body });
    await flushMicrotasks();

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(service.result()).toEqual({ connectionError: true });
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();
    http.verify();
  });

  it('não conclui o cadastro com sucesso quando signOut rejeita por erro inesperado após criar o perfil em /rest/v1/users', async () => {
    vi.mocked(fakeAuth.signOut).mockRejectedValueOnce(new Error('Storage unavailable'));
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    service.register(registration);
    http.expectOne(registrationExistsRpcUrl).flush(false);
    await flushMicrotasks();
    const request = http.expectOne(usersUrl);
    request.flush({ id: 'supabase-user-1', ...request.request.body });
    await flushMicrotasks();

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(service.result()).toEqual({ authError: 'Não foi possível concluir o cadastro. Tente novamente.' });
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();
    http.verify();
  });

  it('preserva o erro HTTP original no rollback mesmo quando signOut falha', async () => {
    vi.mocked(fakeAuth.signOut).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    service.register(registration);
    http.expectOne(registrationExistsRpcUrl).flush(false);
    await flushMicrotasks();
    http.expectOne(usersUrl).flush('erro', { status: 500, statusText: 'Erro' });
    await flushMicrotasks();

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(service.result()).toEqual({ requestError: true });
    http.verify();
  });
});

it('usa supabaseUrl configurado para cadastro e login', async () => {
  const originalSupabaseUrl = environment.supabaseUrl;
  environment.supabaseUrl = 'https://projeto-teste.supabase.co';
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
    http.expectOne('https://projeto-teste.supabase.co/rest/v1/rpc/check_registration_exists').flush(false);
    await flushMicrotasks();
    http.expectOne('https://projeto-teste.supabase.co/rest/v1/users').flush({});
    await flushMicrotasks();
    service.login('ana@alunos.utfpr.edu.br', 'senha123');
    await flushMicrotasks();
    http
      .expectOne(
        (request) =>
          request.url === 'https://projeto-teste.supabase.co/rest/v1/users' &&
          request.params.get('id') === 'eq.supabase-user-1',
      )
      .flush([
        {
          id: 'supabase-user-1',
          name: 'Ana',
          email: 'ana@alunos.utfpr.edu.br',
          registration_number: '123',
          whatsapp: '41987654321',
          role: 'student',
          is_blocked: false,
          is_email_confirmed: true,
          rating_average: 0,
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ]);
    await flushMicrotasks();
    http.verify();
  } finally {
    environment.supabaseUrl = originalSupabaseUrl;
  }
});

describe('restauração de sessão persistida (ensureSessionRestored)', () => {
  let fakeAuth: SupabaseAuthClient;

  beforeEach(() => {
    localStorage.clear();
    fakeAuth = createFakeAuthClient();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: fakeAuth },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('restaura currentUser e accessToken a partir de getSession() e perfil em /rest/v1/users', async () => {
    vi.mocked(fakeAuth.getSession).mockResolvedValueOnce({
      data: { session: fakeSession },
      error: null,
    });
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    const restorePromise = service.ensureSessionRestored();
    await flushMicrotasks();

    const profileRequest = http.expectOne(
      (request) =>
        request.url === usersUrl &&
        request.method === 'GET' &&
        request.params.get('id') === 'eq.supabase-user-1',
    );
    expect(profileRequest.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    profileRequest.flush([
      {
        id: 'supabase-user-1',
        name: 'Ana',
        email: 'ana@alunos.utfpr.edu.br',
        registration_number: '123',
        whatsapp: '41987654321',
        role: 'student',
        is_blocked: false,
        is_email_confirmed: true,
        rating_average: 4.5,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    await expect(restorePromise).resolves.toBe(true);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.accessToken()).toBe('jwt-token');
    expect(service.currentUser()).toEqual({
      id: 'supabase-user-1',
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
    http.verify();
  });

  it('espelha perfil em /rest/v1/users a partir dos metadados do Supabase quando ainda não existe no banco', async () => {
    const userWithMetadata: SupabaseUser = {
      ...fakeSupabaseUser,
      id: 'supabase-restore-mirror',
      email: 'calouro@alunos.utfpr.edu.br',
      user_metadata: {
        name: 'Calouro',
        registrationNumber: '2026999',
        whatsapp: '41988887777',
        role: 'student',
        isBlocked: false,
      },
    };
    vi.mocked(fakeAuth.getSession).mockResolvedValueOnce({
      data: {
        session: {
          ...fakeSession,
          access_token: 'jwt-restored-mirror',
          user: userWithMetadata,
        },
      },
      error: null,
    });
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    const restorePromise = service.ensureSessionRestored();
    await flushMicrotasks();

    http
      .expectOne(
        (request) =>
          request.url === usersUrl &&
          request.method === 'GET' &&
          request.params.get('id') === 'eq.supabase-restore-mirror',
      )
      .flush([]);

    const postRequest = http.expectOne(
      (request) => request.url === usersUrl && request.method === 'POST',
    );
    expect(postRequest.request.headers.get('Authorization')).toBe('Bearer jwt-restored-mirror');
    const row = { ...postRequest.request.body };
    postRequest.flush(row);

    await expect(restorePromise).resolves.toBe(true);
    expect(service.accessToken()).toBe('jwt-restored-mirror');
    expect(service.currentUser()).toEqual({
      id: 'supabase-restore-mirror',
      name: 'Calouro',
      email: 'calouro@alunos.utfpr.edu.br',
      registrationNumber: '2026999',
      whatsapp: '41988887777',
      role: 'student',
      isBlocked: false,
      isEmailConfirmed: true,
      ratingAverage: 0,
      createdAt: row.created_at,
    });
    http.verify();
  });

  it('memoiza a Promise em voo para chamadas simultâneas e evita chamadas duplicadas a getSession()', async () => {
    let resolveSession!: (
      value: Awaited<ReturnType<SupabaseAuthClient['getSession']>>,
    ) => void;
    vi.mocked(fakeAuth.getSession).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSession = resolve;
        }),
    );
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    const first = service.ensureSessionRestored();
    const second = service.ensureSessionRestored();
    expect(fakeAuth.getSession).toHaveBeenCalledTimes(1);

    resolveSession({ data: { session: fakeSession }, error: null });
    await flushMicrotasks();

    http.expectOne((request) => request.url === usersUrl).flush([
      {
        id: 'supabase-user-1',
        name: 'Ana',
        email: 'ana@alunos.utfpr.edu.br',
        registration_number: '123',
        whatsapp: '41987654321',
        role: 'student',
        is_blocked: false,
        is_email_confirmed: true,
        rating_average: 4.5,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(fakeAuth.getSession).toHaveBeenCalledTimes(1);

    await expect(service.ensureSessionRestored()).resolves.toBe(true);
    expect(fakeAuth.getSession).toHaveBeenCalledTimes(1);
    http.verify();
  });

  it('retorna false sem consultar /rest/v1/users quando não há sessão ou faltam user/access_token', async () => {
    vi.mocked(fakeAuth.getSession)
      .mockResolvedValueOnce({ data: { session: null }, error: null })
      .mockResolvedValueOnce({
        data: { session: { ...fakeSession, access_token: '' } },
        error: null,
      });
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    await expect(service.ensureSessionRestored()).resolves.toBe(false);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();

    await expect(service.ensureSessionRestored()).resolves.toBe(false);
    expect(fakeAuth.getSession).toHaveBeenCalledTimes(2);
    http.expectNone(usersUrl);
    http.verify();
  });

  it('limpa sessão local e resolve false com segurança quando getSession() retorna error ou falha por rede', async () => {
    vi.mocked(fakeAuth.getSession)
      .mockResolvedValueOnce({
        data: { session: null },
        error: { name: 'AuthApiError', message: 'Session error', status: 500 } as never,
      })
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    await expect(service.ensureSessionRestored()).resolves.toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();

    await expect(service.ensureSessionRestored()).resolves.toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();
    expect(fakeAuth.getSession).toHaveBeenCalledTimes(2);
    http.expectNone(usersUrl);
    http.verify();
  });

  it('impede restauração de conta bloqueada (isBlocked: true), chama signOut() e retorna false', async () => {
    vi.mocked(fakeAuth.getSession).mockResolvedValueOnce({
      data: { session: fakeSession },
      error: null,
    });
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    const restorePromise = service.ensureSessionRestored();
    await flushMicrotasks();

    http.expectOne((request) => request.url === usersUrl).flush([
      {
        id: 'blocked-1',
        name: 'Aluno Bloqueado',
        email: 'ana@alunos.utfpr.edu.br',
        registration_number: '999',
        whatsapp: '41999990000',
        role: 'student',
        is_blocked: true,
        is_email_confirmed: true,
        rating_average: 4,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    await expect(restorePromise).resolves.toBe(false);
    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();
    http.verify();
  });

  it('executa rollback e resolve false sem rejeitar quando /rest/v1/users falha na restauração', async () => {
    vi.mocked(fakeAuth.getSession).mockResolvedValueOnce({
      data: { session: fakeSession },
      error: null,
    });
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    const restorePromise = service.ensureSessionRestored();
    await flushMicrotasks();

    http
      .expectOne((request) => request.url === usersUrl)
      .flush('erro', { status: 500, statusText: 'Erro' });

    await expect(restorePromise).resolves.toBe(false);
    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();
    http.verify();
  });
});

describe('logout()', () => {
  let fakeAuth: SupabaseAuthClient;

  beforeEach(() => {
    localStorage.clear();
    fakeAuth = createFakeAuthClient();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: fakeAuth },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  async function authenticate(service: AuthData, http: HttpTestingController): Promise<void> {
    service.login('ana@alunos.utfpr.edu.br', 'senha123');
    await flushMicrotasks();
    http.expectOne((request) => request.url === usersUrl).flush([
      {
        id: 'supabase-user-1',
        name: 'Ana',
        email: 'ana@alunos.utfpr.edu.br',
        registration_number: '123',
        whatsapp: '41987654321',
        role: 'student',
        is_blocked: false,
        is_email_confirmed: true,
        rating_average: 4.5,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    await flushMicrotasks();
  }

  it('invoca signOut no Supabase Auth e limpa currentUser e accessToken', async () => {
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    await authenticate(service, http);

    expect(service.isAuthenticated()).toBe(true);
    expect(service.accessToken()).toBe('jwt-token');

    await service.logout();

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();
    http.verify();
  });

  it('limpa currentUser e accessToken mesmo quando signOut retorna erro ou falha por rede', async () => {
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    await authenticate(service, http);

    vi.mocked(fakeAuth.signOut).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(service.logout()).resolves.toBeUndefined();

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();

    await authenticate(service, http);
    vi.mocked(fakeAuth.signOut).mockResolvedValueOnce({
      error: { name: 'AuthApiError', message: 'Network error', status: 500 } as never,
    });
    await expect(service.logout()).resolves.toBeUndefined();

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(2);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.accessToken()).toBeNull();
    http.verify();
  });
});

describe('persistência e restauração offline de sessão (CA3, CA7)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  function setupModule(fakeAuth: SupabaseAuthClient): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: fakeAuth },
      ],
    });
  }

  it('salva o perfil autenticado sem senha em OfflineCache e restaura sessão somente-leitura offline sem HTTP', async () => {
    const fakeAuth = createFakeAuthClient();
    setupModule(fakeAuth);
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    service.login('ana@alunos.utfpr.edu.br', 'senha123');
    await flushMicrotasks();
    http.expectOne((request) => request.url === usersUrl).flush([
      {
        id: 'supabase-user-1',
        name: 'Ana',
        email: 'ana@alunos.utfpr.edu.br',
        registration_number: '123',
        whatsapp: '41987654321',
        role: 'student',
        is_blocked: false,
        is_email_confirmed: true,
        rating_average: 4.5,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    await flushMicrotasks();
    http.verify();

    const cache = TestBed.inject(OfflineCache);
    const cachedProfile = cache.getUserItem<Record<string, unknown>>('supabase-user-1', 'profile');
    expect(cachedProfile).toEqual({
      id: 'supabase-user-1',
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
    expect(cachedProfile).not.toHaveProperty('password');
    expect(JSON.stringify(localStorage)).not.toContain('senha123');

    TestBed.resetTestingModule();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const offlineAuth = createFakeAuthClient();
    vi.mocked(offlineAuth.getSession).mockResolvedValueOnce({
      data: { session: fakeSession },
      error: null,
    });
    setupModule(offlineAuth);

    const restoredService = TestBed.inject(AuthData);
    const offlineHttp = TestBed.inject(HttpTestingController);

    await expect(restoredService.ensureSessionRestored()).resolves.toBe(true);
    offlineHttp.expectNone(usersUrl);
    offlineHttp.verify();

    expect(restoredService.isAuthenticated()).toBe(true);
    expect(restoredService.accessToken()).toBe('jwt-token');
    expect(restoredService.currentUser()).toEqual({
      id: 'supabase-user-1',
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
  });

  it('limpa o cache privado do usuário no logout para impedir restauração offline posterior', async () => {
    const fakeAuth = createFakeAuthClient();
    setupModule(fakeAuth);
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    const cache = TestBed.inject(OfflineCache);

    service.login('ana@alunos.utfpr.edu.br', 'senha123');
    await flushMicrotasks();
    http.expectOne((request) => request.url === usersUrl).flush([
      {
        id: 'supabase-user-1',
        name: 'Ana',
        email: 'ana@alunos.utfpr.edu.br',
        registration_number: '123',
        whatsapp: '41987654321',
        role: 'student',
        is_blocked: false,
        is_email_confirmed: true,
        rating_average: 4.5,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    await flushMicrotasks();

    cache.setUserItem('supabase-user-1', 'rides', [{ id: 'ride-1' }]);
    await service.logout();

    expect(cache.getUserItem('supabase-user-1', 'profile')).toBeNull();
    expect(cache.getUserItem('supabase-user-1', 'rides')).toBeNull();
    http.verify();

    TestBed.resetTestingModule();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const offlineAuth = createFakeAuthClient();
    vi.mocked(offlineAuth.getSession).mockResolvedValueOnce({
      data: { session: fakeSession },
      error: null,
    });
    setupModule(offlineAuth);

    const restoredService = TestBed.inject(AuthData);
    const offlineHttp = TestBed.inject(HttpTestingController);
    await expect(restoredService.ensureSessionRestored()).resolves.toBe(false);
    expect(restoredService.isAuthenticated()).toBe(false);
    expect(restoredService.currentUser()).toBeNull();
    offlineHttp.expectNone(usersUrl);
    offlineHttp.verify();
  });

  it('impede vazamento de cache entre contas na troca de usuário e na restauração offline com sessão de outro aluno', async () => {
    const fakeAuth = createFakeAuthClient();
    setupModule(fakeAuth);
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    const cache = TestBed.inject(OfflineCache);

    service.login('ana@alunos.utfpr.edu.br', 'senha123');
    await flushMicrotasks();
    http.expectOne((request) => request.url === usersUrl).flush([
      {
        id: 'supabase-user-1',
        name: 'Ana',
        email: 'ana@alunos.utfpr.edu.br',
        registration_number: '123',
        whatsapp: '41987654321',
        role: 'student',
        is_blocked: false,
        is_email_confirmed: true,
        rating_average: 4.5,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    await flushMicrotasks();
    cache.setUserItem('supabase-user-1', 'rides', [{ id: 'ride-ana' }]);

    const secondSupabaseUser: SupabaseUser = {
      ...fakeSupabaseUser,
      id: 'supabase-user-2',
      email: 'bruno@alunos.utfpr.edu.br',
    };
    vi.mocked(fakeAuth.signInWithPassword).mockResolvedValueOnce({
      data: { user: secondSupabaseUser, session: { ...fakeSession, access_token: 'jwt-2', user: secondSupabaseUser } },
      error: null,
    });

    service.login('bruno@alunos.utfpr.edu.br', 'senha123');
    await flushMicrotasks();
    http.expectOne((request) => request.url === usersUrl && request.params.get('id') === 'eq.supabase-user-2').flush([
      {
        id: 'supabase-user-2',
        name: 'Bruno',
        email: 'bruno@alunos.utfpr.edu.br',
        registration_number: '456',
        whatsapp: '41999998888',
        role: 'student',
        is_blocked: false,
        is_email_confirmed: true,
        rating_average: 5,
        created_at: '2026-01-02T00:00:00.000Z',
      },
    ]);
    await flushMicrotasks();
    http.verify();

    expect(cache.getUserItem('supabase-user-1', 'profile')).toBeNull();
    expect(cache.getUserItem('supabase-user-1', 'rides')).toBeNull();
    expect(cache.getUserItem<{ id: string }>('supabase-user-2', 'profile')?.id).toBe('supabase-user-2');

    TestBed.resetTestingModule();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const offlineAuth = createFakeAuthClient();
    const thirdUser: SupabaseUser = {
      ...fakeSupabaseUser,
      id: 'supabase-user-3',
      email: 'carla@alunos.utfpr.edu.br',
    };
    vi.mocked(offlineAuth.getSession).mockResolvedValueOnce({
      data: { session: { ...fakeSession, user: thirdUser } },
      error: null,
    });
    setupModule(offlineAuth);

    const restoredService = TestBed.inject(AuthData);
    const offlineHttp = TestBed.inject(HttpTestingController);
    await expect(restoredService.ensureSessionRestored()).resolves.toBe(false);
    expect(restoredService.isAuthenticated()).toBe(false);
    expect(restoredService.currentUser()).toBeNull();
    expect(TestBed.inject(OfflineCache).getUserItem('supabase-user-2', 'profile')).toBeNull();
    offlineHttp.expectNone(usersUrl);
    offlineHttp.verify();
  });

  it('retorna false offline sem HTTP quando getSession não possui sessão ou o perfil em cache está bloqueado', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const fakeAuth = createFakeAuthClient();
    vi.mocked(fakeAuth.getSession)
      .mockResolvedValueOnce({ data: { session: null }, error: null })
      .mockResolvedValueOnce({ data: { session: fakeSession }, error: null });
    setupModule(fakeAuth);
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    const cache = TestBed.inject(OfflineCache);

    await expect(service.ensureSessionRestored()).resolves.toBe(false);

    cache.setUserItem('supabase-user-1', 'profile', {
      id: 'supabase-user-1',
      name: 'Ana Bloqueada',
      email: 'ana@alunos.utfpr.edu.br',
      registrationNumber: '123',
      whatsapp: '',
      role: 'student',
      isBlocked: true,
      isEmailConfirmed: true,
      ratingAverage: 4,
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    await expect(service.ensureSessionRestored()).resolves.toBe(false);
    expect(service.isAuthenticated()).toBe(false);
    expect(cache.getUserItem('supabase-user-1', 'profile')).toBeNull();
    http.expectNone(usersUrl);
    http.verify();
  });

  it('bloqueia login() e register() offline antes de chamar Supabase Auth ou HTTP', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const fakeAuth = createFakeAuthClient();
    setupModule(fakeAuth);
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    service.login('ana@alunos.utfpr.edu.br', 'senha123');
    await flushMicrotasks();
    expect(service.loginResult()).toEqual({ connectionError: true });
    expect(fakeAuth.signInWithPassword).not.toHaveBeenCalled();

    service.register({
      name: 'Ana',
      email: 'ana@alunos.utfpr.edu.br',
      registrationNumber: '123',
      password: 'senha123',
      whatsapp: '41987654321',
    });
    await flushMicrotasks();
    expect(service.result()).toEqual({ connectionError: true });
    expect(fakeAuth.signUp).not.toHaveBeenCalled();

    http.expectNone(registrationExistsRpcUrl);
    http.expectNone(usersUrl);
    http.verify();
  });
});
