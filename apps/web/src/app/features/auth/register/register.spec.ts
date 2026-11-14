import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import { AuthData } from '../../../core/services/auth-data';

describe('Cadastro institucional', () => {
  it('cria uma conta confirmada e navega para o login', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    const harness = await RouterTestingHarness.create('/register');
    const root = harness.routeNativeElement as HTMLElement;
    const fill = (name: string, value: string) => {
      const input = root.querySelector<HTMLInputElement>(`input[formControlName="${name}"]`);
      expect(input).not.toBeNull();
      input!.value = value;
      input!.dispatchEvent(new Event('input', { bubbles: true }));
    };

    fill('name', 'Ana Silva');
    fill('email', 'ana@alunos.utfpr.edu.br');
    fill('registrationNumber', '1234567');
    fill('password', 'senha123');
    fill('confirmPassword', 'senha123');
    fill('whatsapp', '(41) 98765-4321');
    const terms = root.querySelector<HTMLInputElement>('input[formControlName="terms"]')!;
    terms.checked = true;
    terms.dispatchEvent(new Event('change', { bubbles: true }));
    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne('http://localhost:3000/users');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(expect.objectContaining({
      name: 'Ana Silva',
      email: 'ana@alunos.utfpr.edu.br',
      registrationNumber: '1234567',
      password: 'senha123',
      whatsapp: '(41) 98765-4321',
      role: 'student',
      isBlocked: false,
      isEmailConfirmed: true,
      ratingAverage: 0,
      createdAt: expect.any(String),
    }));
    expect(request.request.body).not.toHaveProperty('confirmPassword');
    expect(request.request.body).not.toHaveProperty('terms');
    request.flush({ id: '1', ...request.request.body });
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/login');
    http.verify();
  });
});

  it('apresenta os campos e avisos do protótipo', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
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
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    const harness = await RouterTestingHarness.create('/register');
    const root = harness.routeNativeElement as HTMLElement;
    const fill = (name: string, value: string) => {
      const input = root.querySelector<HTMLInputElement>(`input[formControlName="${name}"]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    fill('name', 'Ana Silva');
    fill('email', 'ana@alunos.utfpr.edu.br');
    fill('registrationNumber', '1234567');
    fill('password', 'senha123');
    fill('confirmPassword', 'outraSenha');
    const terms = root.querySelector<HTMLInputElement>('input[formControlName="terms"]')!;
    const button = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    await harness.fixture.whenStable();
    expect(button.disabled).toBe(true);
    terms.checked = true;
    terms.dispatchEvent(new Event('change', { bubbles: true }));
    await harness.fixture.whenStable();
    expect(button.disabled).toBe(true);
    fill('confirmPassword', 'senha123');
    await harness.fixture.whenStable();
    expect(button.disabled).toBe(false);
  });

it('usa o serviço global e não redireciona ao retornar após um cadastro', async () => {
  TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
  const harness = await RouterTestingHarness.create('/register');
  const service = TestBed.inject(AuthData);
  expect(harness.routeDebugElement!.injector.get(AuthData)).toBe(service);
  service.register({ name: 'Ana', email: 'ana@alunos.utfpr.edu.br', registrationNumber: '123', password: 'senha123', whatsapp: '' });
  const http = TestBed.inject(HttpTestingController);
  const request = http.expectOne('http://localhost:3000/users');
  request.flush({ id: '1', ...request.request.body });
  await harness.fixture.whenStable();
  expect(TestBed.inject(Router).url).toBe('/login');
  await harness.navigateByUrl('/register');
  await harness.fixture.whenStable();
  expect(TestBed.inject(Router).url).toBe('/register');
  http.verify();
});

it('cancela a resposta pendente ao sair e permite um cadastro na próxima visita', async () => {
  TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
  const harness = await RouterTestingHarness.create('/register');
  const service = TestBed.inject(AuthData);
  const data = { name: 'Ana', email: 'ana@alunos.utfpr.edu.br', registrationNumber: '123', password: 'senha123', whatsapp: '' };
  service.register(data);
  const http = TestBed.inject(HttpTestingController);
  const previous = http.expectOne('http://localhost:3000/users');
  await harness.navigateByUrl('/');
  expect(previous.cancelled).toBe(true);
  await harness.navigateByUrl('/register');
  service.register(data);
  const current = http.expectOne('http://localhost:3000/users');
  current.flush({ id: '2', ...current.request.body });
  await harness.fixture.whenStable();
  expect(TestBed.inject(Router).url).toBe('/login');
  http.verify();
});

