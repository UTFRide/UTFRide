import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { routes } from '../../app.routes';
import { environment } from '../../../environments/environment';
import { AuthData } from '../services/auth-data';
import { ErrorNotice } from '../services/error-notice';
import { SUPABASE_AUTH_CLIENT, SupabaseAuthClient } from '../services/supabase-client';
import { errorInterceptor, HANDLE_SESSION_EXPIRATION_ONLY, SKIP_GLOBAL_ERROR_HANDLING } from './error-interceptor';

const fakeSupabaseUser: SupabaseUser = {
  id: '1',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
  email: 'ana@alunos.utfpr.edu.br',
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

async function authenticateStudent(auth: AuthData, http: HttpTestingController): Promise<void> {
  auth.login('ana@alunos.utfpr.edu.br', 'senha');
  await flushMicrotasks();
  http.expectOne((request) => request.url === `${environment.supabaseUrl}/rest/v1/users`).flush([
    {
      id: '1',
      name: 'Ana',
      email: 'ana@alunos.utfpr.edu.br',
      registration_number: '123',
      whatsapp: '41999998888',
      role: 'student',
      is_email_confirmed: true,
      is_blocked: false,
      rating_average: 5,
      created_at: '2026-01-01T00:00:00.000Z',
    },
  ]);
  await flushMicrotasks();
}

describe('errorInterceptor', () => {
  let fakeAuth: SupabaseAuthClient;

  beforeEach(() => {
    fakeAuth = createFakeAuthClient();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: fakeAuth },
      ],
    });
  });

  it('encerra a sessão e encaminha ao login ao receber 401', async () => {
    const auth = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(auth, http);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.accessToken()).toBe('jwt-token');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    TestBed.inject(HttpClient).get('/protegido').subscribe({ error: () => undefined });
    http.expectOne('/protegido').flush('', { status: 401, statusText: 'Unauthorized' });
    await flushMicrotasks();
    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.currentUser()).toBeNull();
    expect(auth.accessToken()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('encerra a sessão local e navega para /login ao receber 401 mesmo se signOut falhar por rede', async () => {
    const auth = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(auth, http);
    vi.mocked(fakeAuth.signOut).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    TestBed.inject(HttpClient).get('/protegido').subscribe({ error: () => undefined });
    http.expectOne('/protegido').flush('', { status: 401, statusText: 'Unauthorized' });
    await flushMicrotasks();

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.currentUser()).toBeNull();
    expect(auth.accessToken()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it.each([[403, 'Acesso proibido'], [500, 'Falha no servidor']])('exibe aviso para erro %i', (status, message) => {
    TestBed.inject(HttpClient).get('/protegido').subscribe({ error: () => undefined });
    TestBed.inject(HttpTestingController).expectOne('/protegido').flush('', { status, statusText: 'Erro' });
    expect(TestBed.inject(ErrorNotice).message()).toContain(message);
  });

  it('exibe mensagem compreensível quando o servidor está fora do ar (status 0)', () => {
    TestBed.inject(HttpClient).get('/protegido').subscribe({ error: () => undefined });
    TestBed.inject(HttpTestingController).expectOne('/protegido').error(new ProgressEvent('error'));
    expect(TestBed.inject(ErrorNotice).message()).toContain('Servidor fora do ar');
  });

  it('não sobrescreve aviso quando status 0 ocorre em requisição marcada com HANDLE_SESSION_EXPIRATION_ONLY', () => {
    const notice = TestBed.inject(ErrorNotice);
    notice.message.set('Aviso anterior');

    TestBed.inject(HttpClient)
      .get('/consulta', { context: new HttpContext().set(HANDLE_SESSION_EXPIRATION_ONLY, true) })
      .subscribe({ error: () => undefined });
    TestBed.inject(HttpTestingController).expectOne('/consulta').error(new ProgressEvent('error'));

    expect(notice.message()).toBe('Aviso anterior');
  });

  it('repassa o erro 401 de uma requisição silenciosa sem alterar aviso, sessão ou rota', async () => {
    const auth = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    const notice = TestBed.inject(ErrorNotice);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await authenticateStudent(auth, http);
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
