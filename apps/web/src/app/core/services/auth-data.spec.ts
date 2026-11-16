import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AuthData } from './auth-data';

describe('AuthData', () => {
  it('disponibiliza o resultado do cadastro após a resposta', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(AuthData);
    expect(service.result()).toBeUndefined();
    service.register({ name: 'Ana', email: 'ana@alunos.utfpr.edu.br', registrationNumber: '123', password: 'senha123', whatsapp: '41987654321' });
    const http = TestBed.inject(HttpTestingController);
    const lookup = http.expectOne((request) => request.url === 'http://localhost:3000/registration-exists' && request.method === 'POST');
    expect(lookup.request.body).toEqual({ email: 'ana@alunos.utfpr.edu.br', registrationNumber: '123' });
    lookup.flush({ exists: false });
    const request = http.expectOne('http://localhost:3000/users');
    const user = { id: '1', ...request.request.body };
    request.flush(user);
    expect(service.result()).toEqual({ duplicate: false, user });
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
});

describe('classificação de falhas de autenticação', () => {
  const registration = { name: 'Ana', email: 'ana@alunos.utfpr.edu.br', registrationNumber: '123', password: 'senha123', whatsapp: '41987654321' };

  beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }));

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
    service.register(registration);
    http.expectOne((request) => request.url.endsWith('/registration-exists')).flush({ exists: true });
    expect(service.result()).toEqual({ duplicate: true });
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

  it('informa falha de conexão ao criar a conta', () => {
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    service.register(registration);
    http.expectOne((request) => request.url.endsWith('/registration-exists')).flush({ exists: false });
    http.expectOne((request) => request.url.endsWith('/users')).error(new ProgressEvent('error'));
    expect(service.result()).toEqual({ connectionError: true });
    http.verify();
  });
});

it('usa a URL configurada para cadastro e login', () => {
  const originalApiUrl = environment.apiUrl;
  environment.apiUrl = 'http://api.test';
  try {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    service.register({ name: 'Ana', email: 'ana@alunos.utfpr.edu.br', registrationNumber: '123', password: 'senha123', whatsapp: '41987654321' });
    http.expectOne('http://api.test/registration-exists').flush({ exists: false });
    http.expectOne('http://api.test/users').flush({});
    service.login('ana@alunos.utfpr.edu.br', 'senha123');
    http.expectOne((request) => request.url === 'http://api.test/users' && request.params.get('email') === 'ana@alunos.utfpr.edu.br').flush([]);
    http.verify();
  } finally {
    environment.apiUrl = originalApiUrl;
  }
});
