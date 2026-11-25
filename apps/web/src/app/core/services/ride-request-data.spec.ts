import { HttpRequest, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { Notification } from '../models/notification.model';
import { Ride } from '../models/ride.model';
import { RideRequest } from '../models/ride-request.model';
import { User } from '../models/user.model';
import { AuthData } from './auth-data';
import { ErrorNotice } from './error-notice';
import { NotificationData } from './notification-data';
import { RideData } from './ride-data';
import { RideRequestData } from './ride-request-data';
import { SUPABASE_AUTH_CLIENT, SupabaseAuthClient } from './supabase-client';

const requestsUrl = `${environment.apiUrl}/ride_requests`;
const pendingPassengerRequest: RideRequest = {
  id: '007',
  rideId: '008',
  passengerId: '009',
  status: 'pending',
  createdAt: '2026-01-01T08:00:00.000Z',
};

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

async function authenticate(http: HttpTestingController, id = 'driver-1', role: User['role'] = 'student'): Promise<void> {
  const auth = TestBed.inject(AuthData);
  auth.login('motorista@alunos.utfpr.edu.br', 'senha123');
  await flushMicrotasks();
  http.expectOne((request) => request.url === `${environment.apiUrl}/users`).flush([
    {
      id,
      name: 'Carlos Motorista',
      email: 'motorista@alunos.utfpr.edu.br',
      registrationNumber: '2020123',
      whatsapp: '41999998888',
      role,
      isBlocked: false,
      isEmailConfirmed: true,
      ratingAverage: 5,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ]);
  await flushMicrotasks();
}

describe('RideRequestData', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
  });

  describe('operações de passageiro', () => {
    let data: RideRequestData;
    const requestId = pendingPassengerRequest.id;
    const requestUrl = `${requestsUrl}/${requestId}`;
    const isCancellationPatch = (request: HttpRequest<unknown>) =>
      request.method === 'PATCH' && request.url === requestUrl;
    const restrictedAccounts = [
      { account: 'conta bloqueada', reason: 'blocked-account', role: 'student', isBlocked: true },
      { account: 'perfil de suporte', reason: 'support-profile', role: 'support', isBlocked: false },
    ] as const;

    beforeEach(() => {
      data = TestBed.inject(RideRequestData);
    });

    async function authenticateRestricted({ role, isBlocked }: (typeof restrictedAccounts)[number]) {
      const http = TestBed.inject(HttpTestingController);
      await authenticate(http, pendingPassengerRequest.passengerId, role);
      if (isBlocked) {
        const auth = TestBed.inject(AuthData);
        // Login recusa contas bloqueadas. Simula uma sessão corrente já bloqueada.
        vi.spyOn(auth, 'currentUser').mockReturnValue({ ...auth.currentUser()!, isBlocked });
      }
      return http;
    }

    it.each(restrictedAccounts)('impede solicitar vaga com $account', async (account) => {
      const http = await authenticateRestricted(account);
      const result = firstValueFrom(data.createRequest(pendingPassengerRequest.rideId));

      http.expectNone((request) => request.method === 'GET' && request.url === requestsUrl);
      http.expectNone({ method: 'POST', url: requestsUrl });
      await expect(result).resolves.toEqual({ status: 'restricted', reason: account.reason });
      http.verify();
    });

    it.each(restrictedAccounts)('impede cancelar solicitação com $account', async (account) => {
      const http = await authenticateRestricted(account);
      const result = firstValueFrom(data.cancelPassengerRequest(requestId));

      http.expectNone({ method: 'GET', url: requestUrl });
      http.expectNone(isCancellationPatch);
      await expect(result).resolves.toEqual({ status: 'restricted', reason: account.reason });
      http.verify();
    });

    it('cancela uma solicitação pendente do aluno atual preservando o ID textual', async () => {
      const http = TestBed.inject(HttpTestingController);
      await authenticate(http, pendingPassengerRequest.passengerId);
      const result = firstValueFrom(data.cancelPassengerRequest(requestId));
      http.expectOne({ method: 'GET', url: requestUrl }).flush(pendingPassengerRequest);

      const patch = http.expectOne(isCancellationPatch);
      expect(patch.request.body).toEqual({ status: 'cancelled' });
      expect(patch.request.params.get('passengerId')).toBe(pendingPassengerRequest.passengerId);
      const cancelled = { ...pendingPassengerRequest, status: 'cancelled' };
      patch.flush(cancelled);

      await expect(result).resolves.toEqual({ status: 'cancelled', request: cancelled });
      http.verify();
    });

    it('impede cancelar uma solicitação de outro aluno', async () => {
      const http = TestBed.inject(HttpTestingController);
      await authenticate(http, '9');
      const result = firstValueFrom(data.cancelPassengerRequest(requestId));
      http.expectOne({ method: 'GET', url: requestUrl }).flush(pendingPassengerRequest);

      http.expectNone(isCancellationPatch);
      await expect(result).resolves.toEqual({ status: 'not-owned' });
      http.verify();
    });

    it.each(['accepted', 'cancelled', 'rejected'] as const)(
      'impede cancelar quando o estado atual é %s',
      async (status) => {
        const http = TestBed.inject(HttpTestingController);
        await authenticate(http, pendingPassengerRequest.passengerId);
        const result = firstValueFrom(data.cancelPassengerRequest(requestId));
        http.expectOne({ method: 'GET', url: requestUrl }).flush({
          ...pendingPassengerRequest,
          status,
        });

        http.expectNone(isCancellationPatch);
        await expect(result).resolves.toEqual({ status: 'invalid-state' });
        http.verify();
      },
    );

    it('impede iniciar o cancelamento se a sessão mudou antes da inscrição', async () => {
      const http = TestBed.inject(HttpTestingController);
      await authenticate(http, pendingPassengerRequest.passengerId);
      const operation = data.cancelPassengerRequest(requestId);
      TestBed.inject(AuthData).logout();
      await authenticate(http, pendingPassengerRequest.passengerId);

      await expect(firstValueFrom(operation)).resolves.toEqual({ status: 'unauthenticated' });
      http.verify();
    });

    it('impede que uma nova sessão do mesmo aluno grave o cancelamento em andamento', async () => {
      const http = TestBed.inject(HttpTestingController);
      await authenticate(http, pendingPassengerRequest.passengerId);
      const result = firstValueFrom(data.cancelPassengerRequest(requestId));
      const read = http.expectOne({ method: 'GET', url: requestUrl });

      TestBed.inject(AuthData).logout();
      await authenticate(http, pendingPassengerRequest.passengerId);
      read.flush(pendingPassengerRequest);

      http.expectNone(isCancellationPatch);
      await expect(result).resolves.toEqual({ status: 'unauthenticated' });
      http.verify();
    });

    it('mantém um único cancelamento por sessão e pedido após sair da tela', async () => {
      const http = TestBed.inject(HttpTestingController);
      await authenticate(http, pendingPassengerRequest.passengerId);
      const first = data.cancelPassengerRequest(requestId).subscribe();
      const read = http.expectOne({ method: 'GET', url: requestUrl });
      const duplicate = firstValueFrom(data.cancelPassengerRequest(requestId));
      http.expectNone({ method: 'GET', url: requestUrl });

      first.unsubscribe();
      read.flush(pendingPassengerRequest);
      const patch = http.expectOne(isCancellationPatch);
      expect(patch.request.params.get('passengerId')).toBe(pendingPassengerRequest.passengerId);
      const cancelled = { ...pendingPassengerRequest, status: 'cancelled' };
      patch.flush(cancelled);

      await expect(duplicate).resolves.toEqual({ status: 'cancelled', request: cancelled });
      http.verify();
    });
  });

  it('consulta somente o resumo das viagens da sessão e descarta respostas de sessões anteriores', async () => {
    const http = TestBed.inject(HttpTestingController);
    const data = TestBed.inject(RideRequestData);
    const auth = TestBed.inject(AuthData);
    const url = `${environment.apiUrl}/passenger-trip-summaries`;
    const result = data.loadPassengerTrips(TestBed.inject(Injector));
    TestBed.tick();
    http.expectNone(url);

    await authenticate(http, '007');
    TestBed.tick();
    const previous = http.expectOne((request) => request.url === url && request.method === 'GET');
    expect(previous.request.params.keys()).toEqual(['passengerId']);
    expect(previous.request.params.get('passengerId')).toBe('007');
    expect(result()).toEqual({ status: 'loading' });

    // A autenticação nova com o mesmo ID também invalida a resposta anterior.
    auth.logout();
    await authenticate(http, '007');
    expect(result()).toEqual({ status: 'loading' });
    TestBed.tick();
    expect(previous.cancelled).toBe(true);
    const trip = { id: '008', status: 'accepted', ride: null, driver: null };
    http.expectOne((request) => request.url === url).flush([trip]);
    expect(result()).toEqual({ status: 'loaded', trips: [trip] });

    auth.logout();
    expect(result()).toEqual({ status: 'error' });
    await authenticate(http, '7');
    expect(result()).toEqual({ status: 'loading' });
    TestBed.tick();
    const failure = http.expectOne((request) => request.url === url && request.method === 'GET');
    expect(failure.request.params.get('passengerId')).toBe('7');
    failure.error(new ProgressEvent('error'));
    expect(result()).toEqual({ status: 'error', connectionError: true });
    http.verify();
  });

  it('consulta só o par oferta e passageiro da sessão, preservando ids textuais e isolando o resultado', async () => {
    const http = TestBed.inject(HttpTestingController);
    const requestData = TestBed.inject(RideRequestData);
    const auth = TestBed.inject(AuthData);
    const url = `${environment.apiUrl}/ride_requests`;
    const rideId = signal('008');
    const result = requestData.loadPassengerRequest(rideId, TestBed.inject(Injector));
    TestBed.tick();
    http.expectNone(url);

    await authenticate(http, '007');
    TestBed.tick();
    const oldRead = http.expectOne((request) => request.url === url);
    rideId.set('007');
    TestBed.tick();
    expect(oldRead.cancelled).toBe(true);
    expect(result()).toEqual({ status: 'loading' });
    const read = http.expectOne((request) => request.url === url);
    expect(read.request.method).toBe('GET');
    expect(JSON.parse(read.request.params.get('_where')!)).toEqual({
      rideId: { eq: '007' },
      passengerId: { eq: '007' },
    });

    const latest: RideRequest = {
      id: 'own-latest',
      rideId: '007',
      passengerId: '007',
      status: 'pending',
      createdAt: '2026-01-03T08:00:00.000Z',
    };
    read.flush([
      { ...latest, id: 'other-passenger', passengerId: '7', createdAt: '2026-01-05T08:00:00.000Z' },
      latest,
      { ...latest, id: 'other-ride', rideId: '7', createdAt: '2026-01-06T08:00:00.000Z' },
      { ...latest, id: 'own-older', status: 'cancelled', createdAt: '2026-01-02T08:00:00.000Z' },
      { ...latest, id: 'own-newer', status: 'rejected', createdAt: '2026-01-04T08:00:00.000Z' },
    ]);
    expect(result()).toEqual({ status: 'loaded', request: latest });
    expect(requestData.requests()).toEqual([]);

    auth.logout();
    TestBed.tick();
    http.expectNone(url);
    await authenticate(http, 'different-passenger');
    expect(result()).toEqual({ status: 'loading' });
    TestBed.tick();
    const newRead = http.expectOne((request) => request.url === url);
    expect(JSON.parse(newRead.request.params.get('_where')!)).toEqual({
      rideId: { eq: '007' },
      passengerId: { eq: 'different-passenger' },
    });
    newRead.flush([latest]);
    expect(result()).toEqual({ status: 'loaded', request: null });
    http.verify();
  });

  it('exibe a solicitação mais recente quando só há pedidos encerrados para a oferta', async () => {
    const http = TestBed.inject(HttpTestingController);
    const requestData = TestBed.inject(RideRequestData);
    await authenticate(http, '007');
    const result = requestData.loadPassengerRequest(signal('008'), TestBed.inject(Injector));
    TestBed.tick();

    const latest: RideRequest = {
      id: 'request-2',
      rideId: '008',
      passengerId: '007',
      status: 'cancelled',
      createdAt: '2026-02-02T08:00:00.000Z',
    };
    http.expectOne((request) => request.url === `${environment.apiUrl}/ride_requests`).flush([
      { ...latest, id: 'request-1', status: 'rejected', createdAt: '2026-02-01T08:00:00.000Z' },
      latest,
    ]);

    expect(result()).toEqual({ status: 'loaded', request: latest });
    http.verify();
  });

  it('aceita e rejeita solicitações individualmente antes da viagem, ocupa vagas, esgota a oferta na última vaga mantendo pendentes e bloqueia novos aceites', async () => {
    const rideData = TestBed.inject(RideData);
    const requestData = TestBed.inject(RideRequestData);
    const http = TestBed.inject(HttpTestingController);
    await authenticate(http);

    const futureDeparture = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    const initialRide: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: futureDeparture,
      totalSeats: 2,
      availableSeats: 1,
      pricePerSeat: 9,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    rideData.loadDriverRides();
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides` && req.params.get('driverId') === 'driver-1')
      .flush([initialRide]);

    const sampleRequests: RideRequest[] = [
      {
        id: 'req-accepted',
        rideId: 'ride-1',
        passengerId: 'Mariana Silva',
        status: 'accepted',
        createdAt: '2026-01-01T08:00:00.000Z',
      },
      {
        id: 'req-pending-1',
        rideId: 'ride-1',
        passengerId: 'Pedro Henrique',
        status: 'pending',
        createdAt: '2026-01-01T08:10:00.000Z',
      },
      {
        id: 'req-pending-2',
        rideId: 'ride-1',
        passengerId: 'Lucas Andrade',
        status: 'pending',
        createdAt: '2026-01-01T08:20:00.000Z',
      },
      {
        id: 'req-pending-3',
        rideId: 'ride-1',
        passengerId: 'Ana Beatriz',
        status: 'pending',
        createdAt: '2026-01-01T08:30:00.000Z',
      },
    ];

    requestData.loadForRide('ride-1');
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/ride_requests` && req.params.get('rideId') === 'ride-1')
      .flush(sampleRequests);

    expect(requestData.requests()).toEqual(sampleRequests);

    // 1. Rejeitar individualmente req-pending-1 sem alterar vagas nem demais pendentes
    requestData.reject(sampleRequests[1], initialRide);
    const rejectReq = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/ride_requests/req-pending-1` && req.method === 'PATCH',
    );
    expect(rejectReq.request.body).toEqual({ status: 'rejected' });
    rejectReq.flush({ ...sampleRequests[1], status: 'rejected' });

    expect(requestData.requests().find((item) => item.id === 'req-pending-1')?.status).toBe('rejected');
    expect(requestData.requests().find((item) => item.id === 'req-pending-2')?.status).toBe('pending');
    expect(requestData.requests().find((item) => item.id === 'req-pending-3')?.status).toBe('pending');
    expect(rideData.driverRides()[0].availableSeats).toBe(1);
    expect(rideData.driverRides()[0].status).toBe('active');

    // 2. Aceitar req-pending-2 (última vaga disponível) -> ocupa vaga e muda oferta para full (esgotada)
    requestData.accept(sampleRequests[2], rideData.driverRides()[0]);
    const acceptReq = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/ride_requests/req-pending-2` && req.method === 'PATCH',
    );
    expect(acceptReq.request.body).toEqual({ status: 'accepted' });
    acceptReq.flush({ ...sampleRequests[2], status: 'accepted' });

    const patchRideReq = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'PATCH',
    );
    expect(patchRideReq.request.body).toEqual({ availableSeats: 0, status: 'full' });
    const fullRide: Ride = { ...initialRide, availableSeats: 0, status: 'full' };
    patchRideReq.flush(fullRide);

    expect(rideData.driverRides()[0]).toEqual(fullRide);
    expect(requestData.requests().find((item) => item.id === 'req-pending-2')?.status).toBe('accepted');
    // Solicitação ainda pendente permanece pendente
    expect(requestData.requests().find((item) => item.id === 'req-pending-3')?.status).toBe('pending');

    // 3. Tentar aceitar req-pending-3 sem vagas disponíveis deve ser impedido
    requestData.accept(sampleRequests[3], rideData.driverRides()[0]);
    http.expectNone(`${environment.apiUrl}/ride_requests/req-pending-3`);
    http.expectNone(`${environment.apiUrl}/rides/ride-1`);
    expect(requestData.decisionResult()).toEqual({ noAvailableSeats: true });
    expect(requestData.requests().find((item) => item.id === 'req-pending-3')?.status).toBe('pending');

    http.verify();
  });

  it('impede que uma oferta esgotada aceite novos pedidos', async () => {
    const requestData = TestBed.inject(RideRequestData);
    const http = TestBed.inject(HttpTestingController);
    await authenticate(http, 'passenger-novo');

    const exhaustedRide: Ride = {
      id: 'ride-full',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      totalSeats: 3,
      availableSeats: 0,
      pricePerSeat: 9,
      status: 'full',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const result = firstValueFrom(requestData.createRequest(exhaustedRide.id));
    http
      .expectOne((request) => request.method === 'GET' && request.url === `${environment.apiUrl}/ride_requests`)
      .flush([]);
    http.expectOne({ method: 'GET', url: `${environment.apiUrl}/rides/ride-full` }).flush(exhaustedRide);
    http.expectNone({ method: 'POST', url: `${environment.apiUrl}/ride_requests` });
    expect(await result).toEqual({ status: 'unavailable', reason: 'full', ride: exhaustedRide });
    http.verify();
  });

  it('cancela a oferta antes da viagem, altera apenas pedidos pendentes para cancelados e registra um aviso interno para cada passageiro confirmado ou anteriormente pendente', async () => {
    const rideData = TestBed.inject(RideData);
    const requestData = TestBed.inject(RideRequestData);
    const notificationData = TestBed.inject(NotificationData);
    const http = TestBed.inject(HttpTestingController);
    await authenticate(http);

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

    rideData.loadDriverRides();
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides` && req.params.get('driverId') === 'driver-1')
      .flush([ride]);

    const rideRequests: RideRequest[] = [
      {
        id: 'req-accepted',
        rideId: 'ride-1',
        passengerId: 'Mariana Silva',
        status: 'accepted',
        createdAt: '2026-01-01T08:00:00.000Z',
      },
      {
        id: 'req-pending-1',
        rideId: 'ride-1',
        passengerId: 'Lucas Andrade',
        status: 'pending',
        createdAt: '2026-01-01T08:10:00.000Z',
      },
      {
        id: 'req-pending-2',
        rideId: 'ride-1',
        passengerId: 'Pedro Henrique',
        status: 'pending',
        createdAt: '2026-01-01T08:15:00.000Z',
      },
      {
        id: 'req-rejected',
        rideId: 'ride-1',
        passengerId: 'Rafael Costa',
        status: 'rejected',
        createdAt: '2026-01-01T08:20:00.000Z',
      },
      {
        id: 'req-already-cancelled',
        rideId: 'ride-1',
        passengerId: 'Camila Rocha',
        status: 'cancelled',
        createdAt: '2026-01-01T08:25:00.000Z',
      },
    ];

    requestData.cancelRide(ride);

    // 1. Oferta é cancelada
    const patchRideReq = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'PATCH',
    );
    expect(patchRideReq.request.body).toEqual({ status: 'cancelled' });
    const cancelledRide: Ride = { ...ride, status: 'cancelled' };
    patchRideReq.flush(cancelledRide);

    // 2. Busca solicitações da oferta
    const getRequestsReq = http.expectOne(
      (req) =>
        req.url === `${environment.apiUrl}/ride_requests` &&
        req.method === 'GET' &&
        req.params.get('rideId') === 'ride-1',
    );
    getRequestsReq.flush(rideRequests);

    // 3. Apenas pendentes passam para cancelled (accepted, rejected e já cancelled não mudam)
    http.expectNone(`${environment.apiUrl}/ride_requests/req-accepted`);
    http.expectNone(`${environment.apiUrl}/ride_requests/req-rejected`);
    http.expectNone(`${environment.apiUrl}/ride_requests/req-already-cancelled`);

    const patchPending1 = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/ride_requests/req-pending-1` && req.method === 'PATCH',
    );
    expect(patchPending1.request.body).toEqual({ status: 'cancelled' });
    const cancelledPending1: RideRequest = { ...rideRequests[1], status: 'cancelled' };
    patchPending1.flush(cancelledPending1);

    const patchPending2 = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/ride_requests/req-pending-2` && req.method === 'PATCH',
    );
    expect(patchPending2.request.body).toEqual({ status: 'cancelled' });
    const cancelledPending2: RideRequest = { ...rideRequests[2], status: 'cancelled' };
    patchPending2.flush(cancelledPending2);

    // 4. Um aviso interno em /notifications para cada confirmado ou anteriormente pendente
    const notifRequests = http.match(
      (req) => req.url === `${environment.apiUrl}/notifications` && req.method === 'POST',
    );
    expect(notifRequests.map((req) => (req.request.body as { recipientId: string }).recipientId)).toEqual([
      'Mariana Silva',
      'Lucas Andrade',
      'Pedro Henrique',
    ]);

    const createdNotifications: Notification[] = notifRequests.map((req, index) => {
      const body = req.request.body as Omit<Notification, 'id'>;
      expect(body.rideId).toBe('ride-1');
      expect(body.message).toContain('Batel');
      expect(body.message).toContain('UTFPR Neoville');
      const saved: Notification = { id: `notif-${index + 1}`, ...body };
      req.flush(saved);
      return saved;
    });

    expect(requestData.cancelResult()).toEqual({
      ride: cancelledRide,
      cancelledRequests: [cancelledPending1, cancelledPending2],
      notifications: createdNotifications,
    });
    expect(rideData.driverRides()[0].status).toBe('cancelled');
    expect(requestData.requests().find((r) => r.id === 'req-accepted')?.status).toBe('accepted');
    expect(requestData.requests().find((r) => r.id === 'req-pending-1')?.status).toBe('cancelled');
    expect(requestData.requests().find((r) => r.id === 'req-pending-2')?.status).toBe('cancelled');
    expect(requestData.requests().find((r) => r.id === 'req-rejected')?.status).toBe('rejected');
    expect(notificationData.notifications()).toEqual(createdNotifications);

    http.verify();
  });

  it('impede o cancelamento quando a viagem já ocorreu ou a oferta já está cancelada/concluída', async () => {
    const requestData = TestBed.inject(RideRequestData);
    const http = TestBed.inject(HttpTestingController);
    await authenticate(http);

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

    requestData.cancelRide(pastRide);
    http.expectNone(`${environment.apiUrl}/rides/ride-past`);
    http.expectNone(`${environment.apiUrl}/ride_requests`);
    http.expectNone(`${environment.apiUrl}/notifications`);
    expect(requestData.cancelResult()).toEqual({ invalidState: true });

    const alreadyCancelled: Ride = {
      ...pastRide,
      id: 'ride-cancelled',
      departureTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      status: 'cancelled',
    };

    requestData.cancelRide(alreadyCancelled);
    http.expectNone(`${environment.apiUrl}/rides/ride-cancelled`);
    expect(requestData.cancelResult()).toEqual({ invalidState: true });

    http.verify();
  });

  it('cancela oferta sem pendentes nem confirmados sem alterar rejeitados e sem criar avisos', async () => {
    const requestData = TestBed.inject(RideRequestData);
    const notificationData = TestBed.inject(NotificationData);
    const http = TestBed.inject(HttpTestingController);
    await authenticate(http);

    const ride: Ride = {
      id: 'ride-no-active',
      driverId: 'driver-1',
      origin: 'Portão',
      destination: 'UTFPR - Sede Centro',
      departureTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      totalSeats: 2,
      availableSeats: 2,
      pricePerSeat: 8,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const rejectedOnly: RideRequest = {
      id: 'req-rejected-only',
      rideId: 'ride-no-active',
      passengerId: 'Rafael Costa',
      status: 'rejected',
      createdAt: '2026-01-01T08:00:00.000Z',
    };

    requestData.cancelRide(ride);

    const patchRideReq = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/rides/ride-no-active` && req.method === 'PATCH',
    );
    const cancelledRide: Ride = { ...ride, status: 'cancelled' };
    patchRideReq.flush(cancelledRide);

    http
      .expectOne(
        (req) =>
          req.url === `${environment.apiUrl}/ride_requests` &&
          req.params.get('rideId') === 'ride-no-active',
      )
      .flush([rejectedOnly]);

    http.expectNone(`${environment.apiUrl}/ride_requests/req-rejected-only`);
    http.expectNone(`${environment.apiUrl}/notifications`);

    expect(requestData.cancelResult()).toEqual({
      ride: cancelledRide,
      cancelledRequests: [],
      notifications: [],
    });
    expect(notificationData.notifications()).toEqual([]);

    http.verify();
  });

  it('impede que outro aluno carregue, aceite, rejeite ou cancele solicitações de uma oferta', async () => {
    const requestData = TestBed.inject(RideRequestData);
    const authData = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    // Autentica outro aluno (driver-2)
    authData.login('outro@alunos.utfpr.edu.br', 'senha123');
    await flushMicrotasks();
    http.expectOne((request) => request.url === `${environment.apiUrl}/users`).flush([
      {
        id: 'driver-2',
        name: 'Outro Motorista',
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

    const futureDeparture = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const rideFromDriver1: Ride = {
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
      id: 'req-1',
      rideId: 'ride-1',
      passengerId: 'Mariana Silva',
      status: 'pending',
      createdAt: '2026-01-01T08:00:00.000Z',
    };

    // 1. Outro aluno não pode carregar solicitações de oferta alheia
    requestData.loadForRide('ride-1');
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'GET')
      .flush(rideFromDriver1);
    http.expectNone(`${environment.apiUrl}/ride_requests`);
    expect(requestData.requests()).toEqual([]);
    expect(requestData.loadResult()).toEqual({ unauthorized: true });

    // 2. Outro aluno não pode aceitar nem rejeitar solicitação
    requestData.accept(pendingRequest, rideFromDriver1);
    http.expectNone(`${environment.apiUrl}/ride_requests/req-1`);
    http.expectNone(`${environment.apiUrl}/rides/ride-1`);
    expect(requestData.decisionResult()).toEqual({ unauthorized: true });

    requestData.reject(pendingRequest, rideFromDriver1);
    http.expectNone(`${environment.apiUrl}/ride_requests/req-1`);
    expect(requestData.decisionResult()).toEqual({ unauthorized: true });

    // 3. Outro aluno não pode cancelar oferta alheia
    requestData.cancelRide(rideFromDriver1);
    http.expectNone(`${environment.apiUrl}/rides/ride-1`);
    http.expectNone(`${environment.apiUrl}/ride_requests`);
    http.expectNone(`${environment.apiUrl}/notifications`);
    expect(requestData.cancelResult()).toEqual({ unauthorized: true });

    http.verify();
  });

  it('impede que aluno bloqueado (mesmo sendo autor) carregue, aceite, rejeite ou cancele solicitações de uma oferta', () => {
    const requestData = TestBed.inject(RideRequestData);
    const authData = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    const futureDeparture = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const rideFromDriver1: Ride = {
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
      id: 'req-1',
      rideId: 'ride-1',
      passengerId: 'Mariana Silva',
      status: 'pending',
      createdAt: '2026-01-01T08:00:00.000Z',
    };

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

    requestData.loadForRide('ride-1');
    http.expectNone(`${environment.apiUrl}/rides/ride-1`);
    http.expectNone(`${environment.apiUrl}/ride_requests`);
    expect(requestData.loadResult()).toEqual({ unauthorized: true });

    requestData.accept(pendingRequest, rideFromDriver1);
    http.expectNone(`${environment.apiUrl}/ride_requests/req-1`);
    expect(requestData.decisionResult()).toEqual({ unauthorized: true });

    requestData.reject(pendingRequest, rideFromDriver1);
    http.expectNone(`${environment.apiUrl}/ride_requests/req-1`);
    expect(requestData.decisionResult()).toEqual({ unauthorized: true });

    requestData.cancelRide(rideFromDriver1);
    http.expectNone(`${environment.apiUrl}/rides/ride-1`);
    expect(requestData.cancelResult()).toEqual({ unauthorized: true });

    http.verify();
  });

  it('informa falha de conexão (status 0) ao carregar solicitações, decidir solicitação e cancelar oferta, preservando o estado e permitindo nova tentativa', async () => {
    const rideData = TestBed.inject(RideData);
    const requestData = TestBed.inject(RideRequestData);
    const errorNotice = TestBed.inject(ErrorNotice);
    const http = TestBed.inject(HttpTestingController);
    await authenticate(http);

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
      id: 'req-1',
      rideId: 'ride-1',
      passengerId: 'Lucas Andrade',
      status: 'pending',
      createdAt: '2026-01-01T08:00:00.000Z',
    };

    rideData.loadDriverRides();
    http
      .expectOne(
        (req) =>
          req.url === `${environment.apiUrl}/rides` && req.params.get('driverId') === 'driver-1',
      )
      .flush([ride]);

    // 1. Falha de conexão ao carregar solicitações + nova tentativa
    requestData.loadForRide('ride-1');
    http
      .expectOne(
        (req) =>
          req.url === `${environment.apiUrl}/ride_requests` && req.params.get('rideId') === 'ride-1',
      )
      .error(new ProgressEvent('error'));

    expect(requestData.loadResult()).toEqual({ connectionError: true });
    expect(errorNotice.message()).toContain('Falha de conexão');

    requestData.loadForRide('ride-1');
    expect(errorNotice.message()).toBe('');
    http
      .expectOne(
        (req) =>
          req.url === `${environment.apiUrl}/ride_requests` && req.params.get('rideId') === 'ride-1',
      )
      .flush([pendingRequest]);
    expect(requestData.loadResult()).toEqual({ requests: [pendingRequest] });
    expect(requestData.requests()).toEqual([pendingRequest]);

    // 2. Falha de conexão ao aceitar solicitação + preservação do estado + nova tentativa
    requestData.accept(pendingRequest, ride);
    http
      .expectOne(
        (req) => req.url === `${environment.apiUrl}/ride_requests/req-1` && req.method === 'PATCH',
      )
      .error(new ProgressEvent('error'));

    expect(requestData.decisionResult()).toEqual({ connectionError: true });
    expect(errorNotice.message()).toContain('Falha de conexão');
    expect(requestData.requests()[0].status).toBe('pending');
    expect(rideData.driverRides()[0].availableSeats).toBe(2);

    // 3. Falha de conexão ao cancelar oferta + preservação do estado + nova tentativa
    requestData.cancelRide(ride);
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'PATCH')
      .error(new ProgressEvent('error'));

    expect(requestData.cancelResult()).toEqual({ connectionError: true });
    expect(errorNotice.message()).toContain('Falha de conexão');
    expect(rideData.driverRides()[0].status).toBe('active');
    http.expectNone(`${environment.apiUrl}/ride_requests`);
    http.expectNone(`${environment.apiUrl}/notifications`);

    requestData.cancelRide(ride);
    expect(errorNotice.message()).toBe('');
    const retryCancelPatch = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'PATCH',
    );
    const cancelledRide: Ride = { ...ride, status: 'cancelled' };
    retryCancelPatch.flush(cancelledRide);
    http
      .expectOne(
        (req) =>
          req.url === `${environment.apiUrl}/ride_requests` && req.params.get('rideId') === 'ride-1',
      )
      .flush([pendingRequest]);
    http
      .expectOne(
        (req) => req.url === `${environment.apiUrl}/ride_requests/req-1` && req.method === 'PATCH',
      )
      .flush({ ...pendingRequest, status: 'cancelled' });
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/notifications` && req.method === 'POST')
      .flush({
        id: 'notif-1',
        recipientId: 'Lucas Andrade',
        rideId: 'ride-1',
        message: 'A carona Batel → UTFPR Neoville foi cancelada pelo motorista.',
        createdAt: '2026-01-01T09:00:00.000Z',
      });

    expect(rideData.driverRides()[0].status).toBe('cancelled');
    expect(requestData.requests()[0].status).toBe('cancelled');
    expect(requestData.cancelResult()).toEqual({
      ride: cancelledRide,
      cancelledRequests: [{ ...pendingRequest, status: 'cancelled' }],
      notifications: [
        {
          id: 'notif-1',
          recipientId: 'Lucas Andrade',
          rideId: 'ride-1',
          message: 'A carona Batel → UTFPR Neoville foi cancelada pelo motorista.',
          createdAt: '2026-01-01T09:00:00.000Z',
        },
      ],
    });

    http.verify();
  });
});
