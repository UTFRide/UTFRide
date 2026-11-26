import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { appConfig } from '../../app.config';
import { AuthData } from '../services/auth-data';
import { authInterceptor } from './auth-interceptor';

describe('authInterceptor', () => {
  it('acrescenta apikey e Authorization Bearer para requisições ao Supabase quando há accessToken ativo', () => {
    const accessToken = signal<string | null>('jwt-token-123');
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthData, useValue: { accessToken: accessToken.asReadonly() } },
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    const http = TestBed.inject(HttpClient);
    const controller = TestBed.inject(HttpTestingController);

    http.get(`${environment.supabaseUrl}/rest/v1/rides`).subscribe();
    const ridesRequest = controller.expectOne(`${environment.supabaseUrl}/rest/v1/rides`);
    expect(ridesRequest.request.headers.get('apikey')).toBe(environment.supabasePublishableKey);
    expect(ridesRequest.request.headers.get('Authorization')).toBe('Bearer jwt-token-123');
    ridesRequest.flush([]);

    http.get(environment.supabaseUrl).subscribe();
    const rootRequest = controller.expectOne(environment.supabaseUrl);
    expect(rootRequest.request.headers.get('apikey')).toBe(environment.supabasePublishableKey);
    expect(rootRequest.request.headers.get('Authorization')).toBe('Bearer jwt-token-123');
    rootRequest.flush({});

    controller.verify();
  });

  it('envia apikey sem Authorization quando não há accessToken ativo no AuthData', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    const auth = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpClient);
    const controller = TestBed.inject(HttpTestingController);

    expect(auth.accessToken()).toBeNull();

    http.post(`${environment.supabaseUrl}/rest/v1/rpc/check_registration_exists`, {}).subscribe();
    const request = controller.expectOne(`${environment.supabaseUrl}/rest/v1/rpc/check_registration_exists`);
    expect(request.request.headers.get('apikey')).toBe(environment.supabasePublishableKey);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(false);

    controller.verify();
  });

  it('preserva Authorization explícito enviado na requisição ao Supabase mesmo antes de a sessão ficar ativa', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    const http = TestBed.inject(HttpClient);
    const controller = TestBed.inject(HttpTestingController);

    http
      .post(`${environment.supabaseUrl}/rest/v1/users`, {}, { headers: { Authorization: 'Bearer transient-jwt' } })
      .subscribe();
    const request = controller.expectOne(`${environment.supabaseUrl}/rest/v1/users`);
    expect(request.request.headers.get('apikey')).toBe(environment.supabasePublishableKey);
    expect(request.request.headers.get('Authorization')).toBe('Bearer transient-jwt');
    request.flush({});

    controller.verify();
  });

  it('não envia apikey nem Authorization para APIs públicas externas como o IBGE ou domínios com prefixo semelhante', () => {
    const accessToken = signal<string | null>('jwt-token-123');
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthData, useValue: { accessToken: accessToken.asReadonly() } },
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    const http = TestBed.inject(HttpClient);
    const controller = TestBed.inject(HttpTestingController);

    const ibgeUrl =
      'https://servicodados.ibge.gov.br/api/v1/localidades/estados/PR/municipios?orderBy=nome';
    http.get(ibgeUrl).subscribe();
    const ibgeRequest = controller.expectOne(ibgeUrl);
    expect(ibgeRequest.request.headers.has('apikey')).toBe(false);
    expect(ibgeRequest.request.headers.has('Authorization')).toBe(false);
    ibgeRequest.flush([]);

    const spoofedDomainUrl = `${environment.supabaseUrl}.evil.com/rest/v1/rides`;
    http.get(spoofedDomainUrl).subscribe();
    const spoofedDomainRequest = controller.expectOne(spoofedDomainUrl);
    expect(spoofedDomainRequest.request.headers.has('apikey')).toBe(false);
    expect(spoofedDomainRequest.request.headers.has('Authorization')).toBe(false);
    spoofedDomainRequest.flush([]);

    const spoofedPortUrl = `${environment.supabaseUrl}1/rest/v1/rides`;
    http.get(spoofedPortUrl).subscribe();
    const spoofedPortRequest = controller.expectOne(spoofedPortUrl);
    expect(spoofedPortRequest.request.headers.has('apikey')).toBe(false);
    expect(spoofedPortRequest.request.headers.has('Authorization')).toBe(false);
    spoofedPortRequest.flush([]);

    controller.verify();
  });

  it('está registrado na configuração da aplicação (appConfig)', () => {
    const accessToken = signal<string | null>('jwt-app-config');
    TestBed.configureTestingModule({
      providers: [
        ...appConfig.providers,
        provideHttpClientTesting(),
        {
          provide: AuthData,
          useValue: {
            accessToken: accessToken.asReadonly(),
            currentUser: signal(null).asReadonly(),
            logout: () => undefined,
          },
        },
      ],
    });

    const http = TestBed.inject(HttpClient);
    const controller = TestBed.inject(HttpTestingController);

    http.get(`${environment.supabaseUrl}/rest/v1/rides`).subscribe();
    const request = controller.expectOne(`${environment.supabaseUrl}/rest/v1/rides`);
    expect(request.request.headers.get('apikey')).toBe(environment.supabasePublishableKey);
    expect(request.request.headers.get('Authorization')).toBe('Bearer jwt-app-config');
    request.flush([]);

    controller.verify();
  });
});
