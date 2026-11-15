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
