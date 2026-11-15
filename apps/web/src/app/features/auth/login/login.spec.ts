import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import { AuthData } from '../../../core/services/auth-data';
import { ErrorNotice } from '../../../core/services/error-notice';
import { errorInterceptor } from '../../../core/interceptors/error-interceptor';

describe('Autenticação institucional', () => {
  it('informa a mesma mensagem para e-mail inexistente e senha incorreta', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    const harness = await RouterTestingHarness.create('/login');
    const root = harness.routeNativeElement as HTMLElement;
    const http = TestBed.inject(HttpTestingController);
    const email = root.querySelector<HTMLInputElement>('input[formControlName="email"]')!;
    const password = root.querySelector<HTMLInputElement>('input[formControlName="password"]')!;
    const submit = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const user = { id: '1', name: 'Ana', email: 'ana@alunos.utfpr.edu.br', password: 'senha123', registrationNumber: '123', whatsapp: '', role: 'student', isBlocked: false, isEmailConfirmed: true, ratingAverage: 0, createdAt: '2026-01-01' };

    for (const [address, users] of [['ausente@alunos.utfpr.edu.br', []], [user.email, [user]], [user.email, [user]]] as const) {
      email.value = address;
      email.dispatchEvent(new Event('input', { bubbles: true }));
      password.value = 'senha-incorreta';
      password.dispatchEvent(new Event('input', { bubbles: true }));
      root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      http.expectOne((req) => req.url === 'http://localhost:3000/users' && req.params.get('email') === address).flush(users);
      await harness.fixture.whenStable();
      expect(root.querySelector('[role="alert"]')?.textContent?.replace(/\s+/g, ''))
        .toBe('Falha na autenticação E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.'.replace(/\s+/g, ''));
      expect(submit.disabled).toBe(false);
      expect(TestBed.inject(AuthData).isAuthenticated()).toBe(false);
      expect(TestBed.inject(Router).url).toBe('/login');
    }
    http.verify();
  });

  it('não exibe a falha anterior ao sair e voltar para o login', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    const harness = await RouterTestingHarness.create('/login');
    const root = harness.routeNativeElement as HTMLElement;
    for (const [name, value] of [['email', 'ana@alunos.utfpr.edu.br'], ['password', 'incorreta']]) {
      const input = root.querySelector<HTMLInputElement>(`input[formControlName="${name}"]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((request) => request.url === 'http://localhost:3000/users').flush([]);
    await harness.fixture.whenStable();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();

    await harness.navigateByUrl('/register');
    await harness.navigateByUrl('/login');
    await harness.fixture.whenStable();
    const returned = harness.routeNativeElement as HTMLElement;
    expect(returned.querySelector('[role="alert"]')).toBeNull();
    expect(returned.querySelector<HTMLInputElement>('input[formControlName="email"]')?.value).toBe('');
    expect(returned.querySelector<HTMLInputElement>('input[formControlName="password"]')?.value).toBe('');
    http.verify();
  });

  it('autentica uma conta ativa e confirmada e entra no sistema', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    const harness = await RouterTestingHarness.create('/login');
    const root = harness.routeNativeElement as HTMLElement;
    for (const [name, value] of [['email', 'ana@alunos.utfpr.edu.br'], ['password', 'senha123']]) {
      const input = root.querySelector<HTMLInputElement>(`input[formControlName="${name}"]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne((req) => req.url === 'http://localhost:3000/users' && req.method === 'GET');
    request.flush([{ id: '1', name: 'Ana', email: 'ana@alunos.utfpr.edu.br', password: 'senha123', registrationNumber: '123', whatsapp: '', role: 'student', isBlocked: false, isEmailConfirmed: true, ratingAverage: 0, createdAt: '2026-01-01' }]);
    await harness.fixture.whenStable();
    expect(TestBed.inject(AuthData).isAuthenticated()).toBe(true);
    expect(TestBed.inject(Router).url).toBe('/rides');
    http.verify();
  });
});

it('redireciona visitantes que tentam acessar a área protegida', async () => {
  TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
  await RouterTestingHarness.create('/rides');
  expect(TestBed.inject(Router).url).toBe('/login');
});

it('informa falha de conexão no login e permite tentar novamente', async () => {
  TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
  const harness = await RouterTestingHarness.create('/login');
  const root = harness.routeNativeElement as HTMLElement;
  for (const [name, value] of [['email', 'ana@alunos.utfpr.edu.br'], ['password', 'senha123']]) {
    const input = root.querySelector<HTMLInputElement>(`input[formControlName="${name}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const submit = () => root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  const http = TestBed.inject(HttpTestingController);
  submit();
  http.expectOne((request) => request.url === 'http://localhost:3000/users').error(new ProgressEvent('error'));
  await harness.fixture.whenStable();
  expect(root.querySelector('[role="alert"]')?.textContent).toContain('conexão');
  expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  submit();
  http.expectOne((request) => request.url === 'http://localhost:3000/users').flush([{ id: '1', name: 'Ana', email: 'ana@alunos.utfpr.edu.br', password: 'senha123', registrationNumber: '123', whatsapp: '', role: 'student', isBlocked: false, isEmailConfirmed: true, ratingAverage: 0, createdAt: '2026-01-01' }]);
  await harness.fixture.whenStable();
  expect(TestBed.inject(Router).url).toBe('/rides');
  http.verify();
});

it.each([401, 500])('informa erro %i no login e remove o aviso ao entrar após nova tentativa', async (status) => {
  TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()] });
  const harness = await RouterTestingHarness.create('/login');
  const root = harness.routeNativeElement as HTMLElement;
  for (const [name, value] of [['email', 'ana@alunos.utfpr.edu.br'], ['password', 'senha123']]) {
    const input = root.querySelector<HTMLInputElement>(`input[formControlName="${name}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const submit = () => root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  const http = TestBed.inject(HttpTestingController);
  const notice = TestBed.inject(ErrorNotice);
  submit();
  http.expectOne((request) => request.url.endsWith('/users')).flush('', { status, statusText: 'Erro' });
  await harness.fixture.whenStable();
  expect(TestBed.inject(Router).url).toBe('/login');
  expect(notice.message()).not.toBe('');
  expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  submit();
  http.expectOne((request) => request.url.endsWith('/users')).flush([{ id: '1', name: 'Ana', email: 'ana@alunos.utfpr.edu.br', password: 'senha123', registrationNumber: '123', whatsapp: '', role: 'student', isBlocked: false, isEmailConfirmed: true, ratingAverage: 0, createdAt: '2026-01-01' }]);
  await harness.fixture.whenStable();
  expect(TestBed.inject(Router).url).toBe('/rides');
  expect(notice.message()).toBe('');
  http.verify();
});
