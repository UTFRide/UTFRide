import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { environment } from '../../../../environments/environment';
import { routes } from '../../../app.routes';
import { Notification } from '../../../core/models/notification.model';
import { Ride } from '../../../core/models/ride.model';
import { RideRequest } from '../../../core/models/ride-request.model';
import { AuthData } from '../../../core/services/auth-data';
import { RideData } from '../../../core/services/ride-data';
import { RideRequestData } from '../../../core/services/ride-request-data';
import { SUPABASE_AUTH_CLIENT, SupabaseAuthClient } from '../../../core/services/supabase-client';
import { MyRides } from './my-rides';

const fakeSupabaseUser: SupabaseUser = {
  id: 'driver-1',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
  email: 'motorista@alunos.utfpr.edu.br',
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

async function authenticateDriver(http: HttpTestingController): Promise<void> {
  const auth = TestBed.inject(AuthData);
  auth.login('motorista@alunos.utfpr.edu.br', 'senha123');
  await flushMicrotasks();
  http.expectOne((request) => request.url === `${environment.apiUrl}/users`).flush([
    {
      id: 'driver-1',
      name: 'Carlos Motorista',
      email: 'motorista@alunos.utfpr.edu.br',
      registrationNumber: '2020123',
      whatsapp: '41999998888',
      role: 'student',
      isBlocked: false,
      isEmailConfirmed: true,
      ratingAverage: 5,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ]);
  await flushMicrotasks();
}

describe('Minhas Ofertas e Gerenciar Solicitações (MyRides)', () => {
  it('redireciona visitante não autenticado para /login', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    await RouterTestingHarness.create('/driver/my-rides');
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('permite aceitar e rejeitar solicitações individualmente antes da viagem, atualiza vagas e status para esgotada, mantém pendentes e impede novos aceites e novos pedidos sem vaga', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const requestData = TestBed.inject(RideRequestData);
    await authenticateDriver(http);

    const futureDeparture = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const ride: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: futureDeparture,
      totalSeats: 3,
      availableSeats: 1,
      pricePerSeat: 9,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const requests: RideRequest[] = [
      {
        id: 'req-1',
        rideId: 'ride-1',
        passengerId: 'Mariana Silva',
        status: 'accepted',
        createdAt: '2026-01-01T07:00:00.000Z',
      },
      {
        id: 'req-2',
        rideId: 'ride-1',
        passengerId: 'Pedro Henrique',
        status: 'accepted',
        createdAt: '2026-01-01T07:05:00.000Z',
      },
      {
        id: 'req-3',
        rideId: 'ride-1',
        passengerId: 'Lucas Andrade',
        status: 'pending',
        createdAt: '2026-01-01T07:10:00.000Z',
      },
      {
        id: 'req-4',
        rideId: 'ride-1',
        passengerId: 'Rafael Costa',
        status: 'pending',
        createdAt: '2026-01-01T07:15:00.000Z',
      },
      {
        id: 'req-5',
        rideId: 'ride-1',
        passengerId: 'Camila Rocha',
        status: 'pending',
        createdAt: '2026-01-01T07:20:00.000Z',
      },
    ];

    const harness = await RouterTestingHarness.create('/driver/my-rides');
    const root = harness.routeNativeElement as HTMLElement;

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides` && req.params.get('driverId') === 'driver-1')
      .flush([ride]);
    await harness.fixture.whenStable();

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/ride_requests` && req.params.get('rideId') === 'ride-1')
      .flush(requests);
    await harness.fixture.whenStable();

    expect(root.textContent).toContain('Batel → UTFPR Neoville');
    expect(root.textContent).toContain('R$ 9,00');
    expect(root.textContent).toContain('Ativa • 2 de 3 vagas ocupadas');
    expect(root.textContent).toContain('2 confirmados');
    expect(root.textContent).toContain('3 aguardando');

    // 1. Rejeitar individualmente req-4 (Rafael Costa)
    const rejectBtn4 = root.querySelector<HTMLButtonElement>('[data-testid="reject-request-req-4"]');
    expect(rejectBtn4).not.toBeNull();
    rejectBtn4!.click();

    const rejectReq4 = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/ride_requests/req-4` && req.method === 'PATCH',
    );
    expect(rejectReq4.request.body).toEqual({ status: 'rejected' });
    rejectReq4.flush({ ...requests[3], status: 'rejected' });
    await harness.fixture.whenStable();

    expect(root.querySelector('[data-testid="reject-request-req-4"]')).toBeNull();
    expect(root.textContent).toContain('2 aguardando');
    expect(root.textContent).toContain('Ativa • 2 de 3 vagas ocupadas');

    // 2. Aceitar req-3 (Lucas Andrade) -> última vaga ocupada -> status passa a Esgotada (full)
    const acceptBtn3 = root.querySelector<HTMLButtonElement>('[data-testid="accept-request-req-3"]');
    expect(acceptBtn3).not.toBeNull();
    expect(acceptBtn3!.disabled).toBe(false);
    acceptBtn3!.click();

    const acceptReq3 = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/ride_requests/req-3` && req.method === 'PATCH',
    );
    expect(acceptReq3.request.body).toEqual({ status: 'accepted' });
    acceptReq3.flush({ ...requests[2], status: 'accepted' });

    const patchRide = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'PATCH',
    );
    expect(patchRide.request.body).toEqual({ availableSeats: 0, status: 'full' });
    const updatedFullRide: Ride = { ...ride, availableSeats: 0, status: 'full' };
    patchRide.flush(updatedFullRide);
    await harness.fixture.whenStable();

    // Oferta passa a esgotada e informa que não aceita novos pedidos
    expect(root.textContent).toContain('Esgotada • 3 de 3 vagas ocupadas');
    expect(root.textContent).toContain('Não aceita novos pedidos');
    expect(root.textContent).toContain('3 confirmados');

    // Solicitação req-5 (Camila Rocha) permanece pendente, mas botão de aceitar fica desabilitado
    expect(root.textContent).toContain('1 aguardando');
    expect(root.textContent).toContain('Camila Rocha');
    const acceptBtn5 = root.querySelector<HTMLButtonElement>('[data-testid="accept-request-req-5"]');
    expect(acceptBtn5).not.toBeNull();
    expect(acceptBtn5!.disabled).toBe(true);

    // Mesmo tentando clicar no botão desabilitado, nenhuma requisição é disparada
    acceptBtn5!.click();
    await harness.fixture.whenStable();
    http.expectNone(`${environment.apiUrl}/ride_requests/req-5`);

    // Verificar que a oferta esgotada não aceita novos pedidos
    const auth = TestBed.inject(AuthData);
    const driver = auth.currentUser()!;
    auth.login(driver.email, 'senha123');
    await flushMicrotasks();
    http.expectOne((req) => req.url === `${environment.apiUrl}/users`).flush([
      { ...driver, id: 'passenger-1', name: 'Novo Passageiro' },
    ]);
    await flushMicrotasks();
    const result = firstValueFrom(requestData.createRequest(updatedFullRide.id));
    http
      .expectOne((req) => req.method === 'GET' && req.url === `${environment.apiUrl}/ride_requests`)
      .flush([]);
    http.expectOne({ method: 'GET', url: `${environment.apiUrl}/rides/ride-1` }).flush(updatedFullRide);
    http.expectNone({ method: 'POST', url: `${environment.apiUrl}/ride_requests` });
    expect(await result).toEqual({ status: 'unavailable', reason: 'full', ride: updatedFullRide });

    http.verify();
  });

  it('permite iniciar a edição de uma oferta sem passageiros confirmados antes da viagem a partir de Minhas Ofertas', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    await authenticateDriver(http);

    const futureDeparture = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const ride: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: futureDeparture,
      totalSeats: 3,
      availableSeats: 3,
      pricePerSeat: 9,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const harness = await RouterTestingHarness.create('/driver/my-rides');
    const root = harness.routeNativeElement as HTMLElement;

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides` && req.params.get('driverId') === 'driver-1')
      .flush([ride]);
    await harness.fixture.whenStable();

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/ride_requests` && req.params.get('rideId') === 'ride-1')
      .flush([]);
    await harness.fixture.whenStable();

    const editBtn = root.querySelector<HTMLButtonElement>('[data-testid="edit-ride-button"]');
    expect(editBtn).not.toBeNull();
    expect(editBtn!.disabled).toBe(false);
    editBtn!.click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/driver/offer?rideId=ride-1');
    http.verify();
  });

  it('permite iniciar a edição de uma oferta com passageiros confirmados (inclusive esgotada) antes da viagem a partir de Minhas Ofertas', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    await authenticateDriver(http);

    const futureDeparture = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const fullRide: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: futureDeparture,
      totalSeats: 2,
      availableSeats: 0,
      pricePerSeat: 9,
      status: 'full',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const confirmedRequests: RideRequest[] = [
      {
        id: 'req-1',
        rideId: 'ride-1',
        passengerId: 'Mariana Silva',
        status: 'accepted',
        createdAt: '2026-01-01T07:00:00.000Z',
      },
      {
        id: 'req-2',
        rideId: 'ride-1',
        passengerId: 'Pedro Henrique',
        status: 'accepted',
        createdAt: '2026-01-01T07:05:00.000Z',
      },
    ];

    const harness = await RouterTestingHarness.create('/driver/my-rides');
    const root = harness.routeNativeElement as HTMLElement;

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides` && req.params.get('driverId') === 'driver-1')
      .flush([fullRide]);
    await harness.fixture.whenStable();

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/ride_requests` && req.params.get('rideId') === 'ride-1')
      .flush(confirmedRequests);
    await harness.fixture.whenStable();

    const editBtn = root.querySelector<HTMLButtonElement>('[data-testid="edit-ride-button"]');
    expect(editBtn).not.toBeNull();
    expect(editBtn!.disabled).toBe(false);
    editBtn!.click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/driver/offer?rideId=ride-1');
    http.verify();
  });

  it('exige confirmação antes de cancelar a oferta, altera pedidos pendentes para cancelados e registra avisos internos para confirmados e anteriormente pendentes', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const requestData = TestBed.inject(RideRequestData);
    await authenticateDriver(http);

    const futureDeparture = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const ride: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: futureDeparture,
      totalSeats: 3,
      availableSeats: 2,
      pricePerSeat: 9,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const requests: RideRequest[] = [
      {
        id: 'req-accepted',
        rideId: 'ride-1',
        passengerId: 'Mariana Silva',
        status: 'accepted',
        createdAt: '2026-01-01T07:00:00.000Z',
      },
      {
        id: 'req-pending',
        rideId: 'ride-1',
        passengerId: 'Lucas Andrade',
        status: 'pending',
        createdAt: '2026-01-01T07:10:00.000Z',
      },
      {
        id: 'req-rejected',
        rideId: 'ride-1',
        passengerId: 'Rafael Costa',
        status: 'rejected',
        createdAt: '2026-01-01T07:20:00.000Z',
      },
    ];

    const harness = await RouterTestingHarness.create('/driver/my-rides');
    const root = harness.routeNativeElement as HTMLElement;

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides` && req.params.get('driverId') === 'driver-1')
      .flush([ride]);
    await harness.fixture.whenStable();

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/ride_requests` && req.params.get('rideId') === 'ride-1')
      .flush(requests);
    await harness.fixture.whenStable();

    // 1. Clicar em "Cancelar" apenas abre o diálogo de confirmação, sem enviar requisições
    const cancelBtn = root.querySelector<HTMLButtonElement>('[data-testid="cancel-ride-button"]');
    expect(cancelBtn).not.toBeNull();
    expect(cancelBtn!.disabled).toBe(false);
    cancelBtn!.click();
    await harness.fixture.whenStable();

    http.expectNone((req) => req.method === 'PATCH' || req.method === 'POST');
    const dialog = root.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.textContent).toContain('Tem certeza que deseja cancelar?');
    expect(dialog!.textContent).toContain('Mariana Silva');
    expect(dialog!.textContent).toContain('Lucas Andrade');
    expect(dialog!.textContent?.toUpperCase()).not.toContain('SMS');

    // 2. Desistir fecha o diálogo sem cancelar a oferta
    const keepBtn = root.querySelector<HTMLButtonElement>('[data-testid="keep-ride-button"]');
    expect(keepBtn).not.toBeNull();
    keepBtn!.click();
    await harness.fixture.whenStable();

    expect(root.querySelector('[role="dialog"]')).toBeNull();
    http.expectNone((req) => req.method === 'PATCH' || req.method === 'POST');

    // 3. Reabrir e confirmar cancelamento
    cancelBtn!.click();
    await harness.fixture.whenStable();

    const confirmBtn = root.querySelector<HTMLButtonElement>('[data-testid="confirm-cancel-ride-button"]');
    expect(confirmBtn).not.toBeNull();
    confirmBtn!.click();

    const patchRide = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'PATCH',
    );
    expect(patchRide.request.body).toEqual({ status: 'cancelled' });
    patchRide.flush({ ...ride, status: 'cancelled' });

    const getRideRequests = http.expectOne(
      (req) =>
        req.url === `${environment.apiUrl}/ride_requests` &&
        req.method === 'GET' &&
        req.params.get('rideId') === 'ride-1',
    );
    getRideRequests.flush(requests);

    http.expectNone(`${environment.apiUrl}/ride_requests/req-accepted`);
    http.expectNone(`${environment.apiUrl}/ride_requests/req-rejected`);

    const patchPending = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/ride_requests/req-pending` && req.method === 'PATCH',
    );
    expect(patchPending.request.body).toEqual({ status: 'cancelled' });
    patchPending.flush({ ...requests[1], status: 'cancelled' });

    const notifReqs = http.match(
      (req) => req.url === `${environment.apiUrl}/notifications` && req.method === 'POST',
    );
    expect(notifReqs.map((req) => (req.request.body as { recipientId: string }).recipientId)).toEqual([
      'Mariana Silva',
      'Lucas Andrade',
    ]);
    notifReqs.forEach((req, index) => {
      const body = req.request.body as Omit<Notification, 'id'>;
      req.flush({ id: `notif-${index + 1}`, ...body });
    });

    await harness.fixture.whenStable();

    expect(root.querySelector('[role="dialog"]')).toBeNull();
    expect(root.textContent).toContain('Cancelada');
    expect(root.textContent).toContain('0 aguardando');
    expect(root.querySelector<HTMLButtonElement>('[data-testid="edit-ride-button"]')?.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('[data-testid="cancel-ride-button"]')?.disabled).toBe(true);
    expect(requestData.requests().find((r) => r.id === 'req-pending')?.status).toBe('cancelled');
    expect(requestData.requests().find((r) => r.id === 'req-accepted')?.status).toBe('accepted');

    http.verify();
  });

  it('desabilita o cancelamento para oferta passada ou já cancelada', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    await authenticateDriver(http);

    const pastRide: Ride = {
      id: 'ride-past',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: new Date(Date.now() - 60 * 1000).toISOString(),
      totalSeats: 2,
      availableSeats: 2,
      pricePerSeat: 9,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const harness = await RouterTestingHarness.create('/driver/my-rides');
    const root = harness.routeNativeElement as HTMLElement;

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides` && req.params.get('driverId') === 'driver-1')
      .flush([pastRide]);
    await harness.fixture.whenStable();

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/ride_requests` && req.params.get('rideId') === 'ride-past')
      .flush([]);
    await harness.fixture.whenStable();

    const cancelBtn = root.querySelector<HTMLButtonElement>('[data-testid="cancel-ride-button"]');
    expect(cancelBtn).not.toBeNull();
    expect(cancelBtn!.disabled).toBe(true);
    http.verify();
  });

  it('impede que outro aluno edite, cancele ou decida solicitações mesmo em chamadas diretas e exibe alerta acessível', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const authData = TestBed.inject(AuthData);
    const requestData = TestBed.inject(RideRequestData);
    await authenticateDriver(http);

    const futureDeparture = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const ride: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: futureDeparture,
      totalSeats: 3,
      availableSeats: 2,
      pricePerSeat: 9,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const pendingRequest: RideRequest = {
      id: 'req-pending',
      rideId: 'ride-1',
      passengerId: 'Lucas Andrade',
      status: 'pending',
      createdAt: '2026-01-01T07:10:00.000Z',
    };

    const harness = await RouterTestingHarness.create('/driver/my-rides');
    const root = harness.routeNativeElement as HTMLElement;
    const component = harness.routeDebugElement?.componentInstance as MyRides;

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides` && req.params.get('driverId') === 'driver-1')
      .flush([ride]);
    await harness.fixture.whenStable();

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/ride_requests` && req.params.get('rideId') === 'ride-1')
      .flush([pendingRequest]);
    await harness.fixture.whenStable();

    // Outro aluno assume a sessão após o carregamento da tela
    authData.login('outro@alunos.utfpr.edu.br', 'senha123');
    await flushMicrotasks();
    http.expectOne((request) => request.url === `${environment.apiUrl}/users`).flush([
      {
        id: 'driver-2',
        name: 'Outro Aluno',
        email: 'outro@alunos.utfpr.edu.br',
        registrationNumber: '2020999',
        whatsapp: '41988887777',
        role: 'student',
        isBlocked: false,
        isEmailConfirmed: true,
        ratingAverage: 5,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    await flushMicrotasks();
    await harness.fixture.whenStable();

    expect(root.querySelector<HTMLButtonElement>('[data-testid="edit-ride-button"]')!.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('[data-testid="cancel-ride-button"]')!.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('[data-testid="accept-request-req-pending"]')!.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('[data-testid="reject-request-req-pending"]')!.disabled).toBe(true);
    expect(root.textContent).not.toContain('Sem vagas disponíveis');

    // Tentativas diretas das operações reais
    component.editSelectedRide();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/driver/my-rides');
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('autor');

    component.confirmCancelRide();
    await harness.fixture.whenStable();
    http.expectNone(`${environment.apiUrl}/rides/ride-1`);
    http.expectNone(`${environment.apiUrl}/ride_requests`);
    http.expectNone(`${environment.apiUrl}/notifications`);
    expect(requestData.cancelResult()).toEqual({ unauthorized: true });
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('autor');

    component.acceptRequest(pendingRequest);
    await harness.fixture.whenStable();
    http.expectNone(`${environment.apiUrl}/ride_requests/req-pending`);
    http.expectNone(`${environment.apiUrl}/rides/ride-1`);
    expect(requestData.decisionResult()).toEqual({ unauthorized: true });
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('autor');

    component.rejectRequest(pendingRequest);
    await harness.fixture.whenStable();
    http.expectNone(`${environment.apiUrl}/ride_requests/req-pending`);
    expect(requestData.decisionResult()).toEqual({ unauthorized: true });
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('autor');

    http.verify();
  });

  it('impede gerenciamento em Minhas Ofertas quando o aluno está bloqueado e exibe alerta acessível', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const authData = TestBed.inject(AuthData);
    const rideData = TestBed.inject(RideData);
    await authenticateDriver(http);

    vi.spyOn(authData, 'currentUser').mockReturnValue({
      id: 'driver-1',
      name: 'Carlos Motorista',
      email: 'motorista@alunos.utfpr.edu.br',
      registrationNumber: '2020123',
      whatsapp: '41999998888',
      role: 'student',
      isBlocked: true,
      isEmailConfirmed: true,
      ratingAverage: 5,
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const harness = await RouterTestingHarness.create('/driver/my-rides');
    const root = harness.routeNativeElement as HTMLElement;
    await harness.fixture.whenStable();

    http.expectNone(`${environment.apiUrl}/rides`);
    expect(rideData.driverRidesResult()).toEqual({ unauthorized: true });
    expect(root.querySelector('[role="alert"]')?.textContent?.toLowerCase()).toContain('bloquead');
    http.verify();
  });

  it('informa falha de conexão dentro do modal ao cancelar oferta, mantém confirmação aberta sem inert no alerta e permite nova tentativa', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const requestData = TestBed.inject(RideRequestData);
    await authenticateDriver(http);

    const futureDeparture = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const ride: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: futureDeparture,
      totalSeats: 3,
      availableSeats: 2,
      pricePerSeat: 9,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const pendingRequest: RideRequest = {
      id: 'req-pending',
      rideId: 'ride-1',
      passengerId: 'Lucas Andrade',
      status: 'pending',
      createdAt: '2026-01-01T07:10:00.000Z',
    };

    const harness = await RouterTestingHarness.create('/driver/my-rides');
    const root = harness.routeNativeElement as HTMLElement;

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides` && req.params.get('driverId') === 'driver-1')
      .flush([ride]);
    await harness.fixture.whenStable();

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/ride_requests` && req.params.get('rideId') === 'ride-1')
      .flush([pendingRequest]);
    await harness.fixture.whenStable();

    root.querySelector<HTMLButtonElement>('[data-testid="cancel-ride-button"]')!.click();
    await harness.fixture.whenStable();

    const confirmBtn = root.querySelector<HTMLButtonElement>('[data-testid="confirm-cancel-ride-button"]')!;
    confirmBtn.click();

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'PATCH')
      .error(new ProgressEvent('error'));
    await harness.fixture.whenStable();

    const dialog = root.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    const cancelErrorAlert = dialog!.querySelector('[data-testid="cancel-ride-error"]');
    expect(cancelErrorAlert).not.toBeNull();
    expect(cancelErrorAlert!.getAttribute('role')).toBe('alert');
    expect(cancelErrorAlert!.closest('[inert]')).toBeNull();
    expect(cancelErrorAlert!.textContent?.toLowerCase()).toContain('conexão');

    expect(confirmBtn.disabled).toBe(false);
    expect(confirmBtn.textContent).toContain('Sim, Cancelar Carona');
    expect(root.querySelector<HTMLButtonElement>('[data-testid="keep-ride-button"]')!.disabled).toBe(false);

    // Nova tentativa pelo botão dentro do modal
    confirmBtn.click();

    const retryPatchRide = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'PATCH',
    );
    retryPatchRide.flush({ ...ride, status: 'cancelled' });

    http
      .expectOne(
        (req) =>
          req.url === `${environment.apiUrl}/ride_requests` &&
          req.method === 'GET' &&
          req.params.get('rideId') === 'ride-1',
      )
      .flush([pendingRequest]);

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/ride_requests/req-pending` && req.method === 'PATCH')
      .flush({ ...pendingRequest, status: 'cancelled' });

    const notifReq = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/notifications` && req.method === 'POST',
    );
    notifReq.flush({ id: 'notif-1', ...(notifReq.request.body as Omit<Notification, 'id'>) });
    await harness.fixture.whenStable();

    expect(root.querySelector('[role="dialog"]')).toBeNull();
    expect(root.textContent).toContain('Cancelada');
    expect(requestData.requests()[0].status).toBe('cancelled');
    http.verify();
  });

  it('informa falha de conexão ao carregar ofertas ou decidir solicitação e permite nova tentativa', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    await authenticateDriver(http);

    const futureDeparture = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const ride: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: futureDeparture,
      totalSeats: 3,
      availableSeats: 2,
      pricePerSeat: 9,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const pendingRequest: RideRequest = {
      id: 'req-pending',
      rideId: 'ride-1',
      passengerId: 'Lucas Andrade',
      status: 'pending',
      createdAt: '2026-01-01T07:10:00.000Z',
    };

    const harness = await RouterTestingHarness.create('/driver/my-rides');
    const root = harness.routeNativeElement as HTMLElement;

    // 1. Falha de conexão ao carregar ofertas
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides` && req.params.get('driverId') === 'driver-1')
      .error(new ProgressEvent('error'));
    await harness.fixture.whenStable();

    const loadError = root.querySelector('[data-testid="my-rides-load-error"]');
    expect(loadError).not.toBeNull();
    expect(loadError!.getAttribute('role')).toBe('alert');
    expect(loadError!.textContent?.toLowerCase()).toContain('conexão');
    expect(root.textContent).not.toContain('Você ainda não possui ofertas de carona cadastradas');

    const retryLoadBtn = root.querySelector<HTMLButtonElement>('[data-testid="retry-load-rides-button"]')!;
    expect(retryLoadBtn).not.toBeNull();
    retryLoadBtn.click();

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides` && req.params.get('driverId') === 'driver-1')
      .flush([ride]);
    await harness.fixture.whenStable();

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/ride_requests` && req.params.get('rideId') === 'ride-1')
      .flush([pendingRequest]);
    await harness.fixture.whenStable();

    expect(root.querySelector('[data-testid="my-rides-load-error"]')).toBeNull();
    expect(root.textContent).toContain('Batel → UTFPR Neoville');

    // 2. Falha de conexão ao aceitar solicitação e nova tentativa
    const acceptBtn = root.querySelector<HTMLButtonElement>('[data-testid="accept-request-req-pending"]')!;
    acceptBtn.click();

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/ride_requests/req-pending` && req.method === 'PATCH')
      .error(new ProgressEvent('error'));
    await harness.fixture.whenStable();

    const decisionError = root.querySelector('[data-testid="request-decision-error"]');
    expect(decisionError).not.toBeNull();
    expect(decisionError!.getAttribute('role')).toBe('alert');
    expect(decisionError!.textContent?.toLowerCase()).toContain('conexão');
    expect(root.querySelector<HTMLButtonElement>('[data-testid="accept-request-req-pending"]')!.disabled).toBe(false);

    root.querySelector<HTMLButtonElement>('[data-testid="accept-request-req-pending"]')!.click();
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/ride_requests/req-pending` && req.method === 'PATCH')
      .flush({ ...pendingRequest, status: 'accepted' });
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'PATCH')
      .flush({ ...ride, availableSeats: 1 });
    await harness.fixture.whenStable();

    expect(root.querySelector('[data-testid="request-decision-error"]')).toBeNull();
    expect(root.textContent).toContain('1 confirmado');
    expect(root.textContent).toContain('0 aguardando');
    http.verify();
  });

  it('exibe o botão Sair ao lado do avatar, executa signOut, limpa sessão e bloqueia /driver/my-rides após sair', async () => {
    const fakeAuth = createFakeAuthClient();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: fakeAuth },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthData);
    const router = TestBed.inject(Router);
    await authenticateDriver(http);

    const harness = await RouterTestingHarness.create('/driver/my-rides');
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides` && req.params.get('driverId') === 'driver-1')
      .flush([]);
    await harness.fixture.whenStable();

    const root = harness.routeNativeElement as HTMLElement;
    const header = root.querySelector('header');
    expect(header).not.toBeNull();
    const avatar = header!.querySelector('[data-testid="student-avatar"]');
    const logoutButton = header!.querySelector<HTMLButtonElement>('[data-testid="logout-button"]');
    expect(avatar).not.toBeNull();
    expect(logoutButton).not.toBeNull();
    expect(logoutButton!.textContent).toContain('Sair');
    expect(avatar!.parentElement?.contains(logoutButton!)).toBe(true);

    logoutButton!.click();
    await flushMicrotasks();
    await harness.fixture.whenStable();

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(auth.currentUser()).toBeNull();
    expect(auth.accessToken()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
    expect(router.url).toBe('/login');

    await harness.navigateByUrl('/driver/my-rides');
    expect(router.url).toBe('/login');
    http.verify();
  });

  it('limpa sessão local e redireciona para /login em MyRides mesmo se signOut falhar por rede', async () => {
    const fakeAuth = createFakeAuthClient();
    vi.mocked(fakeAuth.signOut).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: fakeAuth },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthData);
    const router = TestBed.inject(Router);
    await authenticateDriver(http);

    const harness = await RouterTestingHarness.create('/driver/my-rides');
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides` && req.params.get('driverId') === 'driver-1')
      .flush([]);
    await harness.fixture.whenStable();

    const root = harness.routeNativeElement as HTMLElement;
    const logoutButton = root.querySelector<HTMLButtonElement>('header [data-testid="logout-button"]');
    expect(logoutButton).not.toBeNull();

    logoutButton!.click();
    await flushMicrotasks();
    await harness.fixture.whenStable();

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(auth.currentUser()).toBeNull();
    expect(auth.accessToken()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
    expect(router.url).toBe('/login');
    http.verify();
  });
});
