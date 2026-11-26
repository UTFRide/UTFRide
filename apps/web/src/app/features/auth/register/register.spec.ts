import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { environment } from '../../../../environments/environment';
import { routes } from '../../../app.routes';
import { AuthData } from '../../../core/services/auth-data';
import { SUPABASE_AUTH_CLIENT, SupabaseAuthClient } from '../../../core/services/supabase-client';

const usersUrl = `${environment.supabaseUrl}/rest/v1/users`;
const registrationExistsRpcUrl = `${environment.supabaseUrl}/rest/v1/rpc/check_registration_exists`;

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

function setupRegisterTesting(fakeAuth = createFakeAuthClient()) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: SUPABASE_AUTH_CLIENT, useValue: fakeAuth },
    ],
  });
  return fakeAuth;
}

function fillField(root: HTMLElement, name: string, value: string): void {
  const input = root.querySelector<HTMLInputElement>(`input[formControlName="${name}"]`);
  expect(input).not.toBeNull();
  input!.value = value;
  input!.dispatchEvent(new Event('input', { bubbles: true }));
}

it('descarta os dados não enviados ao sair do cadastro e retornar', async () => {
  const fakeAuth = setupRegisterTesting();
  const harness = await RouterTestingHarness.create('/register');
  const root = harness.routeNativeElement as HTMLElement;
  const values = {
    name: 'Ana Silva',
    email: 'ana@alunos.utfpr.edu.br',
    registrationNumber: '1234567',
    whatsapp: '(41) 98765-4321',
    password: 'senha123',
    confirmPassword: 'senha123',
  };
  for (const [name, value] of Object.entries(values)) {
    fillField(root, name, value);
  }
  const terms = root.querySelector<HTMLInputElement>('input[formControlName="terms"]')!;
  terms.checked = true;
  terms.dispatchEvent(new Event('change', { bubbles: true }));
  const http = TestBed.inject(HttpTestingController);
  await harness.navigateByUrl('/');
  await harness.navigateByUrl('/register');
  const returned = harness.routeNativeElement as HTMLElement;
  for (const name of Object.keys(values)) {
    expect(returned.querySelector<HTMLInputElement>(`input[formControlName="${name}"]`)!.value).toBe('');
  }
  expect(returned.querySelector<HTMLInputElement>('input[formControlName="terms"]')!.checked).toBe(false);
  http.expectNone((request) => request.method === 'POST');
  expect(fakeAuth.signUp).not.toHaveBeenCalled();
  http.verify();
});

it('bloqueia cadastro com e-mail fora do domínio institucional e informa o domínio exigido', async () => {
  const fakeAuth = setupRegisterTesting();
  const harness = await RouterTestingHarness.create('/register');
  const root = harness.routeNativeElement as HTMLElement;
  fillField(root, 'name', 'Ana Silva');
  fillField(root, 'email', 'ana@example.com');
  fillField(root, 'registrationNumber', '1234567');
  fillField(root, 'password', 'senha123');
  fillField(root, 'confirmPassword', 'senha123');
  const terms = root.querySelector<HTMLInputElement>('input[formControlName="terms"]')!;
  terms.checked = true;
  terms.dispatchEvent(new Event('change', { bubbles: true }));
  root.querySelector<HTMLInputElement>('#email')!.dispatchEvent(new Event('blur'));
  await harness.fixture.whenStable();

  expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  TestBed.inject(HttpTestingController).expectNone(usersUrl);
  expect(fakeAuth.signUp).not.toHaveBeenCalled();
  const alert = root.querySelector<HTMLElement>('[role="alert"]');
  expect(alert).not.toBeNull();
  expect(alert!.textContent).toContain('Validação necessária');
  expect(alert!.textContent).toContain('@alunos.utfpr.edu.br');
  expect(alert!.querySelector('.material-symbols-outlined')?.textContent).toContain('error');
  expect(root.querySelector('#email')!.compareDocumentPosition(alert!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  fillField(root, 'email', 'ana@alunos.utfpr.edu.br');
  await harness.fixture.whenStable();
  expect(root.querySelector('[role="alert"]')).toBeNull();
  expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  TestBed.inject(HttpTestingController).verify();
});

it('bloqueia cadastro com senha menor que 6 caracteres sem enviar requisição', async () => {
  const fakeAuth = setupRegisterTesting();
  const harness = await RouterTestingHarness.create('/register');
  const root = harness.routeNativeElement as HTMLElement;
  fillField(root, 'name', 'Ana Silva');
  fillField(root, 'email', 'ana@alunos.utfpr.edu.br');
  fillField(root, 'registrationNumber', '1234567');
  fillField(root, 'password', '12345');
  fillField(root, 'confirmPassword', '12345');
  const terms = root.querySelector<HTMLInputElement>('input[formControlName="terms"]')!;
  terms.checked = true;
  terms.dispatchEvent(new Event('change', { bubbles: true }));
  await harness.fixture.whenStable();

  expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  TestBed.inject(HttpTestingController).expectNone(registrationExistsRpcUrl);
  expect(fakeAuth.signUp).not.toHaveBeenCalled();
  TestBed.inject(HttpTestingController).verify();
});

describe('Cadastro institucional', () => {
  it('cria conta no Supabase Auth, grava em /rest/v1/users sem senha, encerra sessão automática e navega para /login com aviso', async () => {
    const fakeAuth = setupRegisterTesting();
    const harness = await RouterTestingHarness.create('/register');
    const root = harness.routeNativeElement as HTMLElement;

    fillField(root, 'name', 'Ana Silva');
    fillField(root, 'email', 'ana@alunos.utfpr.edu.br');
    fillField(root, 'registrationNumber', '1234567');
    fillField(root, 'password', 'senha123');
    fillField(root, 'confirmPassword', 'senha123');
    fillField(root, 'whatsapp', '(41) 98765-4321');
    const terms = root.querySelector<HTMLInputElement>('input[formControlName="terms"]')!;
    terms.checked = true;
    terms.dispatchEvent(new Event('change', { bubbles: true }));
    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    const http = TestBed.inject(HttpTestingController);
    http.expectOne(registrationExistsRpcUrl).flush(false);
    await flushMicrotasks();

    expect(fakeAuth.signUp).toHaveBeenCalledWith({
      email: 'ana@alunos.utfpr.edu.br',
      password: 'senha123',
      options: {
        data: {
          name: 'Ana Silva',
          registrationNumber: '1234567',
          whatsapp: '(41) 98765-4321',
          role: 'student',
          isBlocked: false,
        },
      },
    });

    const request = http.expectOne(usersUrl);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      id: 'supabase-user-1',
      name: 'Ana Silva',
      email: 'ana@alunos.utfpr.edu.br',
      registration_number: '1234567',
      whatsapp: '(41) 98765-4321',
      role: 'student',
      is_blocked: false,
      is_email_confirmed: true,
      rating_average: 0,
      created_at: expect.any(String),
    });
    expect(request.request.body).not.toHaveProperty('password');
    expect(request.request.body).not.toHaveProperty('confirmPassword');
    expect(request.request.body).not.toHaveProperty('terms');
    request.flush(request.request.body);
    await flushMicrotasks();
    await harness.fixture.whenStable();

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(AuthData).isAuthenticated()).toBe(false);
    expect(TestBed.inject(AuthData).accessToken()).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/login');
    expect((harness.routeNativeElement as HTMLElement).querySelector('[role="status"]')?.textContent)
      .toContain('Conta criada com sucesso');
    http.verify();
  });
});

it('apresenta os campos e avisos do protótipo', async () => {
  setupRegisterTesting();
  const harness = await RouterTestingHarness.create('/register');
  const root = harness.routeNativeElement as HTMLElement;
  expect(root.querySelector('header img[alt*="UTFRide"]')).not.toBeNull();
  expect(root.querySelector('main img[alt*="UTFRide"]')).not.toBeNull();
  expect(root.querySelector('input[type="tel"]')).not.toBeNull();
  expect(root.querySelector('input[autocomplete="new-password"] + input')).toBeNull();
  expect(root.querySelectorAll('input[autocomplete="new-password"]').length).toBe(2);
  expect(root.querySelector('input[type="checkbox"]')).not.toBeNull();
  expect(root.textContent).toContain('confirmação do e-mail será simulada automaticamente');
});

it('exige a aceitação dos termos e a confirmação da senha', async () => {
  setupRegisterTesting();
  const harness = await RouterTestingHarness.create('/register');
  const root = harness.routeNativeElement as HTMLElement;
  fillField(root, 'name', 'Ana Silva');
  fillField(root, 'email', 'ana@alunos.utfpr.edu.br');
  fillField(root, 'registrationNumber', '1234567');
  fillField(root, 'password', 'senha123');
  fillField(root, 'confirmPassword', 'outraSenha');
  const terms = root.querySelector<HTMLInputElement>('input[formControlName="terms"]')!;
  const button = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  await harness.fixture.whenStable();
  expect(button.disabled).toBe(true);
  terms.checked = true;
  terms.dispatchEvent(new Event('change', { bubbles: true }));
  await harness.fixture.whenStable();
  expect(button.disabled).toBe(true);
  fillField(root, 'confirmPassword', 'senha123');
  await harness.fixture.whenStable();
  expect(button.disabled).toBe(false);
});

it('usa o serviço global e não redireciona ao retornar após um cadastro', async () => {
  setupRegisterTesting();
  const harness = await RouterTestingHarness.create('/register');
  const service = TestBed.inject(AuthData);
  expect(harness.routeDebugElement!.injector.get(AuthData)).toBe(service);
  service.register({ name: 'Ana', email: 'ana@alunos.utfpr.edu.br', registrationNumber: '123', password: 'senha123', whatsapp: '' });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne(registrationExistsRpcUrl).flush(false);
  await flushMicrotasks();
  const request = http.expectOne(usersUrl);
  request.flush({ id: 'supabase-user-1', ...request.request.body });
  await flushMicrotasks();
  await harness.fixture.whenStable();
  expect(TestBed.inject(Router).url).toBe('/login');
  await harness.navigateByUrl('/register');
  await harness.fixture.whenStable();
  expect(TestBed.inject(Router).url).toBe('/register');
  http.verify();
});

it('cancela a resposta pendente ao sair e permite um cadastro na próxima visita', async () => {
  setupRegisterTesting();
  const harness = await RouterTestingHarness.create('/register');
  const service = TestBed.inject(AuthData);
  const data = { name: 'Ana', email: 'ana@alunos.utfpr.edu.br', registrationNumber: '123', password: 'senha123', whatsapp: '' };
  service.register(data);
  const http = TestBed.inject(HttpTestingController);
  const previous = http.expectOne(registrationExistsRpcUrl);
  await harness.navigateByUrl('/');
  expect(previous.cancelled).toBe(true);
  await harness.navigateByUrl('/register');
  service.register(data);
  http.expectOne(registrationExistsRpcUrl).flush(false);
  await flushMicrotasks();
  const current = http.expectOne(usersUrl);
  current.flush({ id: 'supabase-user-1', ...current.request.body });
  await flushMicrotasks();
  await harness.fixture.whenStable();
  expect(TestBed.inject(Router).url).toBe('/login');
  http.verify();
});

it('alerta e não cria conta quando já existe cadastro no banco', async () => {
  const fakeAuth = setupRegisterTesting();
  const harness = await RouterTestingHarness.create('/register');
  const root = harness.routeNativeElement as HTMLElement;
  for (const [name, value] of Object.entries({ name: 'Ana Silva', email: 'ana@alunos.utfpr.edu.br', registrationNumber: '1234567', password: 'senha123', confirmPassword: 'senha123' })) {
    fillField(root, name, value);
  }
  const terms = root.querySelector<HTMLInputElement>('input[formControlName="terms"]')!;
  terms.checked = true;
  terms.dispatchEvent(new Event('change', { bubbles: true }));
  root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  const http = TestBed.inject(HttpTestingController);
  const lookup = http.expectOne((request) => request.url === registrationExistsRpcUrl && request.method === 'POST');
  lookup.flush(true);
  await harness.fixture.whenStable();
  expect(fakeAuth.signUp).not.toHaveBeenCalled();
  expect(root.querySelector('[role="alert"]')?.textContent).toContain('já cadastrado');
  expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  expect(TestBed.inject(Router).url).toBe('/register');
  http.expectNone((request) => request.method === 'POST');
  http.verify();
});

it('alerta em português e não redireciona quando o Supabase informa usuário já cadastrado', async () => {
  const fakeAuth = setupRegisterTesting();
  vi.mocked(fakeAuth.signUp).mockResolvedValueOnce({
    data: { user: null, session: null },
    error: { name: 'AuthApiError', message: 'User already registered', status: 422, code: 'user_already_exists' } as never,
  });
  const harness = await RouterTestingHarness.create('/register');
  const root = harness.routeNativeElement as HTMLElement;
  for (const [name, value] of Object.entries({ name: 'Ana Silva', email: 'ana@alunos.utfpr.edu.br', registrationNumber: '1234567', password: 'senha123', confirmPassword: 'senha123' })) {
    fillField(root, name, value);
  }
  const terms = root.querySelector<HTMLInputElement>('input[formControlName="terms"]')!;
  terms.checked = true;
  terms.dispatchEvent(new Event('change', { bubbles: true }));
  root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

  const http = TestBed.inject(HttpTestingController);
  http.expectOne(registrationExistsRpcUrl).flush(false);
  await flushMicrotasks();
  await harness.fixture.whenStable();

  expect(root.querySelector('[role="alert"]')?.textContent).toContain('já cadastrado');
  expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  expect(TestBed.inject(Router).url).toBe('/register');
  http.expectNone(usersUrl);
  http.verify();
});

it('exibe alerta em português quando o Supabase retorna erro de cadastro e permite nova tentativa', async () => {
  const fakeAuth = setupRegisterTesting();
  vi.mocked(fakeAuth.signUp).mockResolvedValueOnce({
    data: { user: null, session: null },
    error: { name: 'AuthApiError', message: 'Signups not allowed for this instance', status: 403, code: 'signup_disabled' } as never,
  });
  const harness = await RouterTestingHarness.create('/register');
  const root = harness.routeNativeElement as HTMLElement;
  for (const [name, value] of Object.entries({ name: 'Ana Silva', email: 'ana@alunos.utfpr.edu.br', registrationNumber: '1234567', password: 'senha123', confirmPassword: 'senha123' })) {
    fillField(root, name, value);
  }
  const terms = root.querySelector<HTMLInputElement>('input[formControlName="terms"]')!;
  terms.checked = true;
  terms.dispatchEvent(new Event('change', { bubbles: true }));
  const submit = () => root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

  const http = TestBed.inject(HttpTestingController);
  submit();
  http.expectOne(registrationExistsRpcUrl).flush(false);
  await flushMicrotasks();
  await harness.fixture.whenStable();

  const alert = root.querySelector('[role="alert"]')?.textContent ?? '';
  expect(alert).toContain('Não foi possível concluir o cadastro');
  expect(alert).not.toContain('Signups not allowed');
  expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  expect(TestBed.inject(Router).url).toBe('/register');
  http.expectNone(usersUrl);

  submit();
  http.expectOne(registrationExistsRpcUrl).flush(false);
  await flushMicrotasks();
  const request = http.expectOne(usersUrl);
  request.flush({ id: 'supabase-user-1', ...request.request.body });
  await flushMicrotasks();
  await harness.fixture.whenStable();

  expect(TestBed.inject(Router).url).toBe('/login');
  http.verify();
});

it('informa falha de conexão no cadastro e permite tentar novamente', async () => {
  setupRegisterTesting();
  const harness = await RouterTestingHarness.create('/register');
  const root = harness.routeNativeElement as HTMLElement;
  for (const [name, value] of Object.entries({ name: 'Ana Silva', email: 'ana@alunos.utfpr.edu.br', registrationNumber: '1234567', password: 'senha123', confirmPassword: 'senha123' })) {
    fillField(root, name, value);
  }
  const terms = root.querySelector<HTMLInputElement>('input[formControlName="terms"]')!;
  terms.checked = true;
  terms.dispatchEvent(new Event('change', { bubbles: true }));
  const submit = () => root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  const http = TestBed.inject(HttpTestingController);
  submit();
  http.expectOne(registrationExistsRpcUrl).error(new ProgressEvent('error'));
  await harness.fixture.whenStable();
  expect(root.querySelector('[role="alert"]')?.textContent).toContain('conexão');
  expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  submit();
  http.expectOne(registrationExistsRpcUrl).flush(false);
  await flushMicrotasks();
  const request = http.expectOne(usersUrl);
  request.flush({ id: 'supabase-user-1', ...request.request.body });
  await flushMicrotasks();
  await harness.fixture.whenStable();
  expect(TestBed.inject(Router).url).toBe('/login');
  http.verify();
});

it('exibe alerta em português e não redireciona para /login quando signOut falha após criar o perfil em /rest/v1/users', async () => {
  const fakeAuth = setupRegisterTesting();
  vi.mocked(fakeAuth.signOut).mockResolvedValueOnce({
    error: { name: 'AuthApiError', message: 'Logout failed', status: 500 } as never,
  });
  const harness = await RouterTestingHarness.create('/register');
  const root = harness.routeNativeElement as HTMLElement;
  for (const [name, value] of Object.entries({ name: 'Ana Silva', email: 'ana@alunos.utfpr.edu.br', registrationNumber: '1234567', password: 'senha123', confirmPassword: 'senha123' })) {
    fillField(root, name, value);
  }
  const terms = root.querySelector<HTMLInputElement>('input[formControlName="terms"]')!;
  terms.checked = true;
  terms.dispatchEvent(new Event('change', { bubbles: true }));
  root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

  const http = TestBed.inject(HttpTestingController);
  http.expectOne(registrationExistsRpcUrl).flush(false);
  await flushMicrotasks();
  const request = http.expectOne(usersUrl);
  request.flush({ id: 'supabase-user-1', ...request.request.body });
  await flushMicrotasks();
  await harness.fixture.whenStable();

  expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
  expect(TestBed.inject(Router).url).toBe('/register');
  expect(root.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível concluir o cadastro');
  expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  http.verify();
});
