import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthData } from './auth-data';

describe('AuthData', () => {
  it('disponibiliza o resultado do cadastro após a resposta', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(AuthData);
    expect(service.result()).toBeUndefined();
    service.register({ name: 'Ana', email: 'ana@alunos.utfpr.edu.br', registrationNumber: '123', password: 'senha123', whatsapp: '41987654321' });
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne('http://localhost:3000/users');
    const user = { id: '1', ...request.request.body };
    request.flush(user);
    expect(service.result()).toEqual(user);
    http.verify();
  });
});
