import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import { AuthData } from '../../../core/services/auth-data';

describe('Autenticação institucional', () => {
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
