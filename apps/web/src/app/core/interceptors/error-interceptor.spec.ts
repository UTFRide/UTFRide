import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { routes } from '../../app.routes';
import { AuthData } from '../services/auth-data';
import { ErrorNotice } from '../services/error-notice';
import { errorInterceptor } from './error-interceptor';

describe('errorInterceptor', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()] }));

  it('encerra a sessão e encaminha ao login ao receber 401', async () => {
    const auth = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    auth.login('ana@alunos.utfpr.edu.br', 'senha');
    http.expectOne((r) => r.url.endsWith('/users')).flush([{ id: '1', email: 'ana@alunos.utfpr.edu.br', password: 'senha', isEmailConfirmed: true, isBlocked: false }]);
    expect(auth.isAuthenticated()).toBe(true);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    TestBed.inject(HttpClient).get('/protegido').subscribe({ error: () => undefined });
    http.expectOne('/protegido').flush('', { status: 401, statusText: 'Unauthorized' });
    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it.each([[403, 'Acesso proibido'], [500, 'Falha no servidor']])('exibe aviso para erro %i', (status, message) => {
    TestBed.inject(HttpClient).get('/protegido').subscribe({ error: () => undefined });
    TestBed.inject(HttpTestingController).expectOne('/protegido').flush('', { status, statusText: 'Erro' });
    expect(TestBed.inject(ErrorNotice).message()).toContain(message);
  });
});
