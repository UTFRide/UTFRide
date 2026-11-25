import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { appConfig } from '../../app.config';
import { AuthData } from '../services/auth-data';
import { authInterceptor } from './auth-interceptor';

describe('authInterceptor', () => {
  it('acrescenta Authorization Bearer para requisições à API configurada quando há accessToken ativo', () => {
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

    http.get(`${environment.apiUrl}/rides`).subscribe();
    const ridesRequest = controller.expectOne(`${environment.apiUrl}/rides`);
    expect(ridesRequest.request.headers.get('Authorization')).toBe('Bearer jwt-token-123');
    ridesRequest.flush([]);

    http.get(environment.apiUrl).subscribe();
    const rootRequest = controller.expectOne(environment.apiUrl);
    expect(rootRequest.request.headers.get('Authorization')).toBe('Bearer jwt-token-123');
    rootRequest.flush({});

    controller.verify();
  });

  it('não envia Authorization quando não há accessToken ativo no AuthData', () => {
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

    http.get(`${environment.apiUrl}/rides`).subscribe();
    const request = controller.expectOne(`${environment.apiUrl}/rides`);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush([]);

    controller.verify();
  });

  it('não envia Authorization para APIs públicas externas como o IBGE ou domínios com prefixo semelhante', () => {
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
    expect(ibgeRequest.request.headers.has('Authorization')).toBe(false);
    ibgeRequest.flush([]);

    const spoofedDomainUrl = `${environment.apiUrl}.evil.com/rides`;
    http.get(spoofedDomainUrl).subscribe();
    const spoofedDomainRequest = controller.expectOne(spoofedDomainUrl);
    expect(spoofedDomainRequest.request.headers.has('Authorization')).toBe(false);
    spoofedDomainRequest.flush([]);

    const spoofedPortUrl = `${environment.apiUrl}1/rides`;
    http.get(spoofedPortUrl).subscribe();
    const spoofedPortRequest = controller.expectOne(spoofedPortUrl);
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

    http.get(`${environment.apiUrl}/rides`).subscribe();
    const request = controller.expectOne(`${environment.apiUrl}/rides`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer jwt-app-config');
    request.flush([]);

    controller.verify();
  });
});
