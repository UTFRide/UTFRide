import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { routes } from '../../app.routes';
import { AuthData } from '../services/auth-data';
import { ErrorNotice } from '../services/error-notice';
import { errorInterceptor, SKIP_GLOBAL_ERROR_HANDLING } from './error-interceptor';

function authenticateStudent(auth: AuthData, http: HttpTestingController): void {
  auth.login('ana@alunos.utfpr.edu.br', 'senha');
  http.expectOne((request) => request.url.endsWith('/users')).flush([
    {
      id: '1',
      email: 'ana@alunos.utfpr.edu.br',
      password: 'senha',
      isEmailConfirmed: true,
      isBlocked: false,
    },
  ]);
}

describe('errorInterceptor', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()] }));

  it('encerra a sessão e encaminha ao login ao receber 401', async () => {
    const auth = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    authenticateStudent(auth, http);
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

  it('repassa o erro 401 de uma requisição silenciosa sem alterar aviso, sessão ou rota', async () => {
    const auth = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    const notice = TestBed.inject(ErrorNotice);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    authenticateStudent(auth, http);
    expect(auth.isAuthenticated()).toBe(true);
    notice.message.set('Aviso anterior');

    const result = firstValueFrom(
      TestBed.inject(HttpClient).get('/consulta-opcional', {
        context: new HttpContext().set(SKIP_GLOBAL_ERROR_HANDLING, true),
      }),
    );
    http.expectOne('/consulta-opcional').flush('Sem autorização', {
      status: 401,
      statusText: 'Unauthorized',
    });

    await expect(result).rejects.toMatchObject({ status: 401, error: 'Sem autorização' });
    expect(notice.message()).toBe('Aviso anterior');
    expect(auth.isAuthenticated()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
    http.verify();
  });
});
