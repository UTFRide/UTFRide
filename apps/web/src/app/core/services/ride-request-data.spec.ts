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
import { OfflineCache } from './offline-cache';
import { RideData } from './ride-data';
import { PassengerTripSummary, RideRequestData } from './ride-request-data';
import { SUPABASE_AUTH_CLIENT, SupabaseAuthClient } from './supabase-client';

const usersUrl = `${environment.supabaseUrl}/rest/v1/users`;
const ridesUrl = `${environment.supabaseUrl}/rest/v1/rides`;
const requestsUrl = `${environment.supabaseUrl}/rest/v1/ride_requests`;
const notificationsUrl = `${environment.supabaseUrl}/rest/v1/notifications`;
const passengerTripsRpcUrl = `${environment.supabaseUrl}/rest/v1/rpc/get_passenger_trip_summaries`;

function toRideRow(ride: Ride) {
  return {
    id: ride.id,
    driver_id: ride.driverId,
    origin: ride.origin,
    destination: ride.destination,
    departure_time: ride.departureTime,
    total_seats: ride.totalSeats,
    available_seats: ride.availableSeats,
    price_per_seat: ride.pricePerSeat,
    status: ride.status,
    ...(ride.notes !== undefined ? { notes: ride.notes } : {}),
    created_at: ride.createdAt,
  };
}

function toRequestRow(request: RideRequest) {
  return {
    id: request.id,
    ride_id: request.rideId,
    passenger_id: request.passengerId,
    status: request.status,
    created_at: request.createdAt,
  };
}

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
  http.expectOne((request) => request.url === usersUrl).flush([
    {
      id,
      name: 'Carlos Motorista',
      email: 'motorista@alunos.utfpr.edu.br',
      registration_number: '2020123',
      whatsapp: '41999998888',
      role,
      is_blocked: false,
      is_email_confirmed: true,
      rating_average: 5,
      created_at: '2026-01-01T00:00:00.000Z',
    },
  ]);
  await flushMicrotasks();
}

describe('RideRequestData', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('operações de passageiro', () => {
    let data: RideRequestData;
    const requestId = pendingPassengerRequest.id;
    const isCancellationPatch = (request: HttpRequest<unknown>) =>
      request.method === 'PATCH' &&
      request.url === requestsUrl &&
      request.params.get('id') === `eq.${requestId}`;
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
        vi.spyOn(auth, 'currentUser').mockReturnValue({ ...auth.currentUser()!, isBlocked });
      }
      return http;
    }

    it.each(restrictedAccounts)('impede solicitar vaga com $account', async (account) => {
      const http = await authenticateRestricted(account);
      const result = firstValueFrom(data.createRequest(pendingPassengerRequest.rideId));

      http.expectNone(requestsUrl);
      await expect(result).resolves.toEqual({ status: 'restricted', reason: account.reason });
      http.verify();
    });

    it.each(restrictedAccounts)('impede cancelar solicitação com $account', async (account) => {
      const http = await authenticateRestricted(account);
      const result = firstValueFrom(data.cancelPassengerRequest(requestId));

      http.expectNone(requestsUrl);
      await expect(result).resolves.toEqual({ status: 'restricted', reason: account.reason });
      http.verify();
    });

    it('cancela uma solicitação pendente do aluno atual via /rest/v1/ride_requests', async () => {
      const http = TestBed.inject(HttpTestingController);
      await authenticate(http, pendingPassengerRequest.passengerId);
      const result = firstValueFrom(data.cancelPassengerRequest(requestId));
      http
        .expectOne((req) => req.method === 'GET' && req.url === requestsUrl && req.params.get('id') === `eq.${requestId}`)
        .flush([toRequestRow(pendingPassengerRequest)]);

      const patch = http.expectOne(isCancellationPatch);
      expect(patch.request.headers.get('Prefer')).toBe('return=representation');
      expect(patch.request.headers.get('Accept')).toBe('application/vnd.pgrst.object+json');
      expect(patch.request.body).toEqual({ status: 'cancelled' });
      expect(patch.request.params.get('passenger_id')).toBe(`eq.${pendingPassengerRequest.passengerId}`);
      const cancelled: RideRequest = { ...pendingPassengerRequest, status: 'cancelled' };
      patch.flush(toRequestRow(cancelled));

      await expect(result).resolves.toEqual({ status: 'cancelled', request: cancelled });
      http.verify();
    });

    it('impede cancelar uma solicitação de outro aluno', async () => {
      const http = TestBed.inject(HttpTestingController);
      await authenticate(http, '9');
      const result = firstValueFrom(data.cancelPassengerRequest(requestId));
      http
        .expectOne((req) => req.method === 'GET' && req.url === requestsUrl && req.params.get('id') === `eq.${requestId}`)
        .flush([toRequestRow(pendingPassengerRequest)]);

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
        http
          .expectOne((req) => req.method === 'GET' && req.url === requestsUrl && req.params.get('id') === `eq.${requestId}`)
          .flush([toRequestRow({ ...pendingPassengerRequest, status })]);

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
      const read = http.expectOne(
        (req) => req.method === 'GET' && req.url === requestsUrl && req.params.get('id') === `eq.${requestId}`,
      );

      TestBed.inject(AuthData).logout();
      await authenticate(http, pendingPassengerRequest.passengerId);
      read.flush([toRequestRow(pendingPassengerRequest)]);

      http.expectNone(isCancellationPatch);
      await expect(result).resolves.toEqual({ status: 'unauthenticated' });
      http.verify();
    });

    it('mantém um único cancelamento por sessão e pedido após sair da tela', async () => {
      const http = TestBed.inject(HttpTestingController);
      await authenticate(http, pendingPassengerRequest.passengerId);
      const first = data.cancelPassengerRequest(requestId).subscribe();
      const read = http.expectOne(
        (req) => req.method === 'GET' && req.url === requestsUrl && req.params.get('id') === `eq.${requestId}`,
      );
      const duplicate = firstValueFrom(data.cancelPassengerRequest(requestId));
      http.expectNone(
        (req) => req.method === 'GET' && req.url === requestsUrl && req.params.get('id') === `eq.${requestId}`,
      );

      first.unsubscribe();
      read.flush([toRequestRow(pendingPassengerRequest)]);
      const patch = http.expectOne(isCancellationPatch);
      expect(patch.request.params.get('passenger_id')).toBe(`eq.${pendingPassengerRequest.passengerId}`);
      const cancelled: RideRequest = { ...pendingPassengerRequest, status: 'cancelled' };
      patch.flush(toRequestRow(cancelled));

      await expect(duplicate).resolves.toEqual({ status: 'cancelled', request: cancelled });
      http.verify();
    });
  });

  it('consulta somente o resumo das viagens via RPC get_passenger_trip_summaries e descarta respostas de sessões anteriores', async () => {
    const http = TestBed.inject(HttpTestingController);
    const data = TestBed.inject(RideRequestData);
    const auth = TestBed.inject(AuthData);
    const result = data.loadPassengerTrips(TestBed.inject(Injector));
    TestBed.tick();
    http.expectNone(passengerTripsRpcUrl);

    await authenticate(http, '007');
    TestBed.tick();
    const previous = http.expectOne((request) => request.url === passengerTripsRpcUrl && request.method === 'POST');
    expect(previous.request.body).toEqual({});
    expect(result()).toEqual({ status: 'loading' });

    auth.logout();
    await authenticate(http, '007');
    expect(result()).toEqual({ status: 'loading' });
    TestBed.tick();
    expect(previous.cancelled).toBe(true);
    const trip = { id: '008', status: 'accepted', ride: null, driver: null };
    http.expectOne((request) => request.url === passengerTripsRpcUrl).flush([trip]);
    expect(result()).toEqual({ status: 'loaded', trips: [trip] });

    auth.logout();
    expect(result()).toEqual({ status: 'error' });
    await authenticate(http, '7');
    expect(result()).toEqual({ status: 'loading' });
    TestBed.tick();
    const failure = http.expectOne((request) => request.url === passengerTripsRpcUrl && request.method === 'POST');
    failure.error(new ProgressEvent('error'));
    expect(result()).toEqual({ status: 'error', connectionError: true });
    http.verify();
  });

  it('consulta só o par oferta e passageiro via PostgREST em /rest/v1/ride_requests', async () => {
    const http = TestBed.inject(HttpTestingController);
    const requestData = TestBed.inject(RideRequestData);
    const auth = TestBed.inject(AuthData);
    const rideId = signal('008');
    const result = requestData.loadPassengerRequest(rideId, TestBed.inject(Injector));
    TestBed.tick();
    http.expectNone(requestsUrl);

    await authenticate(http, '007');
    TestBed.tick();
    const oldRead = http.expectOne((request) => request.url === requestsUrl);
    rideId.set('007');
    TestBed.tick();
    expect(oldRead.cancelled).toBe(true);
    expect(result()).toEqual({ status: 'loading' });
    const read = http.expectOne((request) => request.url === requestsUrl);
    expect(read.request.method).toBe('GET');
    expect(read.request.params.get('ride_id')).toBe('eq.007');
    expect(read.request.params.get('passenger_id')).toBe('eq.007');

    const latest: RideRequest = {
      id: 'own-latest',
      rideId: '007',
      passengerId: '007',
      status: 'pending',
      createdAt: '2026-01-03T08:00:00.000Z',
    };
    read.flush([
      toRequestRow({ ...latest, id: 'other-passenger', passengerId: '7', createdAt: '2026-01-05T08:00:00.000Z' }),
      toRequestRow(latest),
      toRequestRow({ ...latest, id: 'other-ride', rideId: '7', createdAt: '2026-01-06T08:00:00.000Z' }),
      toRequestRow({ ...latest, id: 'own-older', status: 'cancelled', createdAt: '2026-01-02T08:00:00.000Z' }),
      toRequestRow({ ...latest, id: 'own-newer', status: 'rejected', createdAt: '2026-01-04T08:00:00.000Z' }),
    ]);
    expect(result()).toEqual({ status: 'loaded', request: latest });
    expect(requestData.requests()).toEqual([]);

    auth.logout();
    TestBed.tick();
    http.expectNone(requestsUrl);
    await authenticate(http, 'different-passenger');
    expect(result()).toEqual({ status: 'loading' });
    TestBed.tick();
    const newRead = http.expectOne((request) => request.url === requestsUrl);
    expect(newRead.request.params.get('ride_id')).toBe('eq.007');
    expect(newRead.request.params.get('passenger_id')).toBe('eq.different-passenger');
    newRead.flush([toRequestRow(latest)]);
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
    http.expectOne((request) => request.url === requestsUrl).flush([
      toRequestRow({ ...latest, id: 'request-1', status: 'rejected', createdAt: '2026-02-01T08:00:00.000Z' }),
      toRequestRow(latest),
    ]);

    expect(result()).toEqual({ status: 'loaded', request: latest });
    http.verify();
  });

  it('aceita e rejeita solicitações individualmente antes da viagem, ocupa vagas e bloqueia novos aceites', async () => {
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
      .expectOne((req) => req.url === ridesUrl && req.params.get('driver_id') === 'eq.driver-1')
      .flush([toRideRow(initialRide)]);

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
      .expectOne((req) => req.url === requestsUrl && req.params.get('ride_id') === 'eq.ride-1')
      .flush(sampleRequests.map(toRequestRow));

    expect(requestData.requests()).toEqual(sampleRequests);

    requestData.reject(sampleRequests[1], initialRide);
    const rejectReq = http.expectOne(
      (req) => req.url === requestsUrl && req.method === 'PATCH' && req.params.get('id') === 'eq.req-pending-1',
    );
    expect(rejectReq.request.body).toEqual({ status: 'rejected' });
    rejectReq.flush(toRequestRow({ ...sampleRequests[1], status: 'rejected' }));

    expect(requestData.requests().find((item) => item.id === 'req-pending-1')?.status).toBe('rejected');
    expect(requestData.requests().find((item) => item.id === 'req-pending-2')?.status).toBe('pending');
    expect(requestData.requests().find((item) => item.id === 'req-pending-3')?.status).toBe('pending');
    expect(rideData.driverRides()[0].availableSeats).toBe(1);
    expect(rideData.driverRides()[0].status).toBe('active');

    requestData.accept(sampleRequests[2], rideData.driverRides()[0]);
    const acceptReq = http.expectOne(
      (req) => req.url === requestsUrl && req.method === 'PATCH' && req.params.get('id') === 'eq.req-pending-2',
    );
    expect(acceptReq.request.body).toEqual({ status: 'accepted' });
    acceptReq.flush(toRequestRow({ ...sampleRequests[2], status: 'accepted' }));

    const patchRideReq = http.expectOne(
      (req) => req.url === ridesUrl && req.method === 'PATCH' && req.params.get('id') === 'eq.ride-1',
    );
    expect(patchRideReq.request.body).toEqual({ available_seats: 0, status: 'full' });
    const fullRide: Ride = { ...initialRide, availableSeats: 0, status: 'full' };
    patchRideReq.flush(toRideRow(fullRide));

    expect(rideData.driverRides()[0]).toEqual(fullRide);
    expect(requestData.requests().find((item) => item.id === 'req-pending-2')?.status).toBe('accepted');
    expect(requestData.requests().find((item) => item.id === 'req-pending-3')?.status).toBe('pending');

    requestData.accept(sampleRequests[3], rideData.driverRides()[0]);
    http.expectNone(requestsUrl);
    http.expectNone(ridesUrl);
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
      .expectOne((request) => request.method === 'GET' && request.url === requestsUrl)
      .flush([]);
    http
      .expectOne((req) => req.method === 'GET' && req.url === ridesUrl && req.params.get('id') === 'eq.ride-full')
      .flush([toRideRow(exhaustedRide)]);
    http.expectNone({ method: 'POST', url: requestsUrl });
    expect(await result).toEqual({ status: 'unavailable', reason: 'full', ride: exhaustedRide });
    http.verify();
  });

  it('recupera solicitação existente quando POST /rest/v1/ride_requests retorna conflito 409 (23505)', async () => {
    const requestData = TestBed.inject(RideRequestData);
    const http = TestBed.inject(HttpTestingController);
    await authenticate(http, 'passenger-1');

    const futureRide: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      totalSeats: 3,
      availableSeats: 2,
      pricePerSeat: 9,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const existing: RideRequest = {
      id: 'req-dup',
      rideId: 'ride-1',
      passengerId: 'passenger-1',
      status: 'pending',
      createdAt: '2026-01-01T09:00:00.000Z',
    };

    const result = firstValueFrom(requestData.createRequest('ride-1'));
    http
      .expectOne((req) => req.method === 'GET' && req.url === requestsUrl)
      .flush([]);
    http
      .expectOne((req) => req.method === 'GET' && req.url === ridesUrl && req.params.get('id') === 'eq.ride-1')
      .flush([toRideRow(futureRide)]);

    const postReq = http.expectOne((req) => req.method === 'POST' && req.url === requestsUrl);
    expect(postReq.request.body).toEqual({
      ride_id: 'ride-1',
      passenger_id: 'passenger-1',
      status: 'pending',
      created_at: expect.any(String),
    });
    postReq.flush({ code: '23505', message: 'duplicate key value' }, { status: 409, statusText: 'Conflict' });

    http
      .expectOne((req) => req.method === 'GET' && req.url === requestsUrl)
      .flush([toRequestRow(existing)]);
    http
      .expectOne((req) => req.method === 'GET' && req.url === ridesUrl && req.params.get('id') === 'eq.ride-1')
      .flush([toRideRow(futureRide)]);

    expect(await result).toEqual({ status: 'duplicate', request: existing, ride: futureRide });
    http.verify();
  });

  it('cancela a oferta antes da viagem, altera apenas pedidos pendentes para cancelados e registra avisos internos', async () => {
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
      .expectOne((req) => req.url === ridesUrl && req.params.get('driver_id') === 'eq.driver-1')
      .flush([toRideRow(ride)]);

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

    const patchRideReq = http.expectOne(
      (req) => req.url === ridesUrl && req.method === 'PATCH' && req.params.get('id') === 'eq.ride-1',
    );
    expect(patchRideReq.request.body).toEqual({ status: 'cancelled' });
    const cancelledRide: Ride = { ...ride, status: 'cancelled' };
    patchRideReq.flush(toRideRow(cancelledRide));

    const getRequestsReq = http.expectOne(
      (req) =>
        req.url === requestsUrl &&
        req.method === 'GET' &&
        req.params.get('ride_id') === 'eq.ride-1',
    );
    getRequestsReq.flush(rideRequests.map(toRequestRow));

    http.expectNone((req) => req.method === 'PATCH' && req.params.get('id') === 'eq.req-accepted');
    http.expectNone((req) => req.method === 'PATCH' && req.params.get('id') === 'eq.req-rejected');
    http.expectNone((req) => req.method === 'PATCH' && req.params.get('id') === 'eq.req-already-cancelled');

    const patchPending1 = http.expectOne(
      (req) => req.url === requestsUrl && req.method === 'PATCH' && req.params.get('id') === 'eq.req-pending-1',
    );
    expect(patchPending1.request.body).toEqual({ status: 'cancelled' });
    const cancelledPending1: RideRequest = { ...rideRequests[1], status: 'cancelled' };
    patchPending1.flush(toRequestRow(cancelledPending1));

    const patchPending2 = http.expectOne(
      (req) => req.url === requestsUrl && req.method === 'PATCH' && req.params.get('id') === 'eq.req-pending-2',
    );
    expect(patchPending2.request.body).toEqual({ status: 'cancelled' });
    const cancelledPending2: RideRequest = { ...rideRequests[2], status: 'cancelled' };
    patchPending2.flush(toRequestRow(cancelledPending2));

    const notifRequests = http.match(
      (req) => req.url === notificationsUrl && req.method === 'POST',
    );
    expect(notifRequests.map((req) => (req.request.body as { recipient_id: string }).recipient_id)).toEqual([
      'Mariana Silva',
      'Lucas Andrade',
      'Pedro Henrique',
    ]);

    const createdNotifications: Notification[] = notifRequests.map((req, index) => {
      const body = req.request.body as {
        recipient_id: string;
        ride_id: string;
        message: string;
        created_at: string;
      };
      expect(body.ride_id).toBe('ride-1');
      expect(body.message).toContain('Batel');
      expect(body.message).toContain('UTFPR Neoville');
      const id = `notif-${index + 1}`;
      req.flush({ id, ...body });
      return {
        id,
        recipientId: body.recipient_id,
        rideId: body.ride_id,
        message: body.message,
        createdAt: body.created_at,
      };
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
    http.expectNone(ridesUrl);
    http.expectNone(requestsUrl);
    http.expectNone(notificationsUrl);
    expect(requestData.cancelResult()).toEqual({ invalidState: true });

    const alreadyCancelled: Ride = {
      ...pastRide,
      id: 'ride-cancelled',
      departureTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      status: 'cancelled',
    };

    requestData.cancelRide(alreadyCancelled);
    http.expectNone(ridesUrl);
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
      (req) => req.url === ridesUrl && req.method === 'PATCH' && req.params.get('id') === 'eq.ride-no-active',
    );
    const cancelledRide: Ride = { ...ride, status: 'cancelled' };
    patchRideReq.flush(toRideRow(cancelledRide));

    http
      .expectOne(
        (req) =>
          req.url === requestsUrl &&
          req.params.get('ride_id') === 'eq.ride-no-active',
      )
      .flush([toRequestRow(rejectedOnly)]);

    http.expectNone((req) => req.method === 'PATCH' && req.url === requestsUrl);
    http.expectNone(notificationsUrl);

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

    authData.login('outro@alunos.utfpr.edu.br', 'senha123');
    await flushMicrotasks();
    http.expectOne((request) => request.url === usersUrl).flush([
      {
        id: 'driver-2',
        name: 'Outro Motorista',
        email: 'outro@alunos.utfpr.edu.br',
        registration_number: '2020999',
        whatsapp: '41988887777',
        role: 'student',
        is_blocked: false,
        is_email_confirmed: true,
        rating_average: 5,
        created_at: '2026-01-01T00:00:00.000Z',
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

    requestData.loadForRide('ride-1');
    http
      .expectOne((req) => req.url === ridesUrl && req.method === 'GET' && req.params.get('id') === 'eq.ride-1')
      .flush([toRideRow(rideFromDriver1)]);
    http.expectNone(requestsUrl);
    expect(requestData.requests()).toEqual([]);
    expect(requestData.loadResult()).toEqual({ unauthorized: true });

    requestData.accept(pendingRequest, rideFromDriver1);
    http.expectNone(requestsUrl);
    http.expectNone(ridesUrl);
    expect(requestData.decisionResult()).toEqual({ unauthorized: true });

    requestData.reject(pendingRequest, rideFromDriver1);
    http.expectNone(requestsUrl);
    expect(requestData.decisionResult()).toEqual({ unauthorized: true });

    requestData.cancelRide(rideFromDriver1);
    http.expectNone(ridesUrl);
    http.expectNone(requestsUrl);
    http.expectNone(notificationsUrl);
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
    http.expectNone(ridesUrl);
    http.expectNone(requestsUrl);
    expect(requestData.loadResult()).toEqual({ unauthorized: true });

    requestData.accept(pendingRequest, rideFromDriver1);
    http.expectNone(requestsUrl);
    expect(requestData.decisionResult()).toEqual({ unauthorized: true });

    requestData.reject(pendingRequest, rideFromDriver1);
    http.expectNone(requestsUrl);
    expect(requestData.decisionResult()).toEqual({ unauthorized: true });

    requestData.cancelRide(rideFromDriver1);
    http.expectNone(ridesUrl);
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
      .expectOne((req) => req.url === ridesUrl && req.params.get('driver_id') === 'eq.driver-1')
      .flush([toRideRow(ride)]);

    requestData.loadForRide('ride-1');
    http
      .expectOne((req) => req.url === requestsUrl && req.params.get('ride_id') === 'eq.ride-1')
      .error(new ProgressEvent('error'));

    expect(requestData.loadResult()).toEqual({ connectionError: true });
    expect(errorNotice.message()).toContain('Falha de conexão');

    requestData.loadForRide('ride-1');
    expect(errorNotice.message()).toBe('');
    http
      .expectOne((req) => req.url === requestsUrl && req.params.get('ride_id') === 'eq.ride-1')
      .flush([toRequestRow(pendingRequest)]);
    expect(requestData.loadResult()).toEqual({ requests: [pendingRequest] });
    expect(requestData.requests()).toEqual([pendingRequest]);

    requestData.accept(pendingRequest, ride);
    http
      .expectOne((req) => req.url === requestsUrl && req.method === 'PATCH' && req.params.get('id') === 'eq.req-1')
      .error(new ProgressEvent('error'));

    expect(requestData.decisionResult()).toEqual({ connectionError: true });
    expect(errorNotice.message()).toContain('Falha de conexão');
    expect(requestData.requests()[0].status).toBe('pending');
    expect(rideData.driverRides()[0].availableSeats).toBe(2);

    requestData.cancelRide(ride);
    http
      .expectOne((req) => req.url === ridesUrl && req.method === 'PATCH' && req.params.get('id') === 'eq.ride-1')
      .error(new ProgressEvent('error'));

    expect(requestData.cancelResult()).toEqual({ connectionError: true });
    expect(errorNotice.message()).toContain('Falha de conexão');
    expect(rideData.driverRides()[0].status).toBe('active');
    http.expectNone(requestsUrl);
    http.expectNone(notificationsUrl);

    requestData.cancelRide(ride);
    expect(errorNotice.message()).toBe('');
    const retryCancelPatch = http.expectOne(
      (req) => req.url === ridesUrl && req.method === 'PATCH' && req.params.get('id') === 'eq.ride-1',
    );
    const cancelledRide: Ride = { ...ride, status: 'cancelled' };
    retryCancelPatch.flush(toRideRow(cancelledRide));
    http
      .expectOne((req) => req.url === requestsUrl && req.params.get('ride_id') === 'eq.ride-1')
      .flush([toRequestRow(pendingRequest)]);
    http
      .expectOne((req) => req.url === requestsUrl && req.method === 'PATCH' && req.params.get('id') === 'eq.req-1')
      .flush(toRequestRow({ ...pendingRequest, status: 'cancelled' }));
    http
      .expectOne((req) => req.url === notificationsUrl && req.method === 'POST')
      .flush({
        id: 'notif-1',
        recipient_id: 'Lucas Andrade',
        ride_id: 'ride-1',
        message: 'A carona Batel → UTFPR Neoville foi cancelada pelo motorista.',
        created_at: '2026-01-01T09:00:00.000Z',
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

  describe('cache local e bloqueio offline (CA4, CA5, CA7)', () => {
    it('persiste passengerTrips e solicitação por oferta escopados por userId, lê offline sem HTTP e limpa no logout', async () => {
      const http = TestBed.inject(HttpTestingController);
      const requestData = TestBed.inject(RideRequestData);

      await authenticate(http, 'passenger-1');

      const trip: PassengerTripSummary = {
        id: 'req-trip-1',
        status: 'accepted',
        ride: {
          origin: 'Batel',
          destination: 'UTFPR Neoville',
          departureTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          pricePerSeat: 10,
          status: 'active',
        },
        driver: { name: 'Carlos Motorista', ratingAverage: 5 },
        whatsapp: '41999998888',
      };
      const tripsSignal = requestData.loadPassengerTrips(TestBed.inject(Injector));
      TestBed.tick();
      http
        .expectOne((req) => req.url === passengerTripsRpcUrl && req.method === 'POST')
        .flush([trip]);
      expect(tripsSignal()).toEqual({ status: 'loaded', trips: [trip] });

      const cachedRequest: RideRequest = {
        id: 'req-detail-1',
        rideId: 'ride-1',
        passengerId: 'passenger-1',
        status: 'pending',
        createdAt: '2026-01-01T08:00:00.000Z',
      };
      const rideId = signal('ride-1');
      const passengerRequestSignal = requestData.loadPassengerRequest(rideId, TestBed.inject(Injector));
      TestBed.tick();
      http
        .expectOne(
          (req) =>
            req.url === requestsUrl &&
            req.method === 'GET' &&
            req.params.get('ride_id') === 'eq.ride-1' &&
            req.params.get('passenger_id') === 'eq.passenger-1',
        )
        .flush([toRequestRow(cachedRequest)]);
      expect(passengerRequestSignal()).toEqual({ status: 'loaded', request: cachedRequest });

      rideId.set('ride-sem-pedido');
      TestBed.tick();
      http
        .expectOne(
          (req) =>
            req.url === requestsUrl &&
            req.method === 'GET' &&
            req.params.get('ride_id') === 'eq.ride-sem-pedido' &&
            req.params.get('passenger_id') === 'eq.passenger-1',
        )
        .flush([]);
      expect(passengerRequestSignal()).toEqual({ status: 'loaded', request: null });
      http.verify();

      // Reabre o aplicativo offline com sessão em cache da mesma usuária.
      TestBed.resetTestingModule();
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      const passengerSupabaseUser: SupabaseUser = {
        ...fakeSupabaseUser,
        id: 'passenger-1',
        email: 'motorista@alunos.utfpr.edu.br',
      };
      const offlineAuthClient = createFakeAuthClient();
      vi.mocked(offlineAuthClient.getSession).mockResolvedValue({
        data: { session: { ...fakeSession, user: passengerSupabaseUser } },
        error: null,
      });
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: SUPABASE_AUTH_CLIENT, useValue: offlineAuthClient },
        ],
      });

      const offlineAuth = TestBed.inject(AuthData);
      const offlineRequestData = TestBed.inject(RideRequestData);
      const offlineHttp = TestBed.inject(HttpTestingController);
      await expect(offlineAuth.ensureSessionRestored()).resolves.toBe(true);

      const offlineTrips = offlineRequestData.loadPassengerTrips(TestBed.inject(Injector));
      TestBed.tick();
      offlineHttp.expectNone(passengerTripsRpcUrl);
      expect(offlineTrips()).toEqual({ status: 'loaded', trips: [trip] });

      const offlineRideId = signal('ride-1');
      const offlinePassengerReq = offlineRequestData.loadPassengerRequest(
        offlineRideId,
        TestBed.inject(Injector),
      );
      TestBed.tick();
      offlineHttp.expectNone(requestsUrl);
      expect(offlinePassengerReq()).toEqual({ status: 'loaded', request: cachedRequest });

      offlineRideId.set('ride-sem-pedido');
      TestBed.tick();
      offlineHttp.expectNone(requestsUrl);
      expect(offlinePassengerReq()).toEqual({ status: 'loaded', request: null });

      offlineRideId.set('ride-nao-consultada');
      TestBed.tick();
      offlineHttp.expectNone(requestsUrl);
      expect(offlinePassengerReq()).toEqual({ status: 'error', connectionError: true });

      // Logout limpa caches privados e outra conta não lê dados da anterior offline.
      await offlineAuth.logout();
      const offlineCache = TestBed.inject(OfflineCache);
      expect(offlineCache.getUserItem('passenger-1', 'passenger-trips')).toBeNull();
      expect(offlineCache.getUserItem('passenger-1', 'passenger-requests-by-ride')).toBeNull();

      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
      window.dispatchEvent(new Event('online'));
      await authenticate(offlineHttp, 'passenger-2');
      TestBed.tick();
      offlineHttp
        .expectOne((req) => req.url === passengerTripsRpcUrl && req.method === 'POST')
        .error(new ProgressEvent('error'));
      offlineHttp
        .expectOne(
          (req) =>
            req.url === requestsUrl &&
            req.method === 'GET' &&
            req.params.get('ride_id') === 'eq.ride-nao-consultada' &&
            req.params.get('passenger_id') === 'eq.passenger-2',
        )
        .error(new ProgressEvent('error'));

      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      window.dispatchEvent(new Event('offline'));
      offlineRequestData.refreshPassengerTrips();
      TestBed.tick();
      offlineHttp.expectNone(passengerTripsRpcUrl);
      expect(offlineTrips()).toEqual({ status: 'error', connectionError: true });

      offlineRideId.set('ride-1');
      TestBed.tick();
      offlineHttp.expectNone(requestsUrl);
      expect(offlinePassengerReq()).toEqual({ status: 'error', connectionError: true });
      offlineHttp.verify();
    });

    it('persiste solicitações por oferta do motorista e lê do cache sem HTTP quando offline, isolando contas', async () => {
      const http = TestBed.inject(HttpTestingController);
      const auth = TestBed.inject(AuthData);
      const rideData = TestBed.inject(RideData);
      const requestData = TestBed.inject(RideRequestData);
      const cache = TestBed.inject(OfflineCache);

      await authenticate(http, 'driver-1');

      const futureDeparture = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
      const ride: Ride = {
        id: 'ride-driver-1',
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
          id: 'req-1',
          rideId: 'ride-driver-1',
          passengerId: 'passenger-1',
          status: 'pending',
          createdAt: '2026-01-01T08:00:00.000Z',
        },
      ];

      rideData.loadDriverRides();
      http
        .expectOne((req) => req.url === ridesUrl && req.params.get('driver_id') === 'eq.driver-1')
        .flush([toRideRow(ride)]);

      requestData.loadForRide('ride-driver-1');
      http
        .expectOne((req) => req.url === requestsUrl && req.params.get('ride_id') === 'eq.ride-driver-1')
        .flush(requests.map(toRequestRow));
      expect(requestData.requests()).toEqual(requests);

      requestData.reset();
      expect(requestData.requests()).toEqual([]);

      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      window.dispatchEvent(new Event('offline'));

      requestData.loadForRide('ride-driver-1');
      http.expectNone(ridesUrl);
      http.expectNone(requestsUrl);
      expect(requestData.requests()).toEqual(requests);
      expect(requestData.loadResult()).toEqual({ requests });

      requestData.loadForRide('ride-sem-cache');
      http.expectNone(ridesUrl);
      http.expectNone(requestsUrl);
      expect(requestData.requests()).toEqual([]);
      expect(requestData.loadResult()).toEqual({ connectionError: true });

      // Logout limpa cache de driver-1 e driver-2 offline não herda solicitações de driver-1.
      rideData.resetDriverRides();
      await auth.logout();
      expect(cache.getUserItem('driver-1', 'ride-requests-by-ride')).toBeNull();

      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
      window.dispatchEvent(new Event('online'));
      await authenticate(http, 'driver-2');

      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      window.dispatchEvent(new Event('offline'));
      requestData.loadForRide('ride-driver-1');
      http.expectNone(ridesUrl);
      http.expectNone(requestsUrl);
      expect(requestData.requests()).toEqual([]);
      expect(requestData.loadResult()).toEqual({ connectionError: true });
      http.verify();
    });

    it('bloqueia createRequest e cancelPassengerRequest sem HTTP quando offline e reabilita quando online', async () => {
      const http = TestBed.inject(HttpTestingController);
      const requestData = TestBed.inject(RideRequestData);
      await authenticate(http, 'passenger-1');

      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      window.dispatchEvent(new Event('offline'));

      await expect(firstValueFrom(requestData.createRequest('ride-1'))).resolves.toEqual({
        status: 'connection-error',
      });
      await expect(firstValueFrom(requestData.cancelPassengerRequest('req-1'))).resolves.toEqual({
        status: 'connection-error',
      });
      http.expectNone(requestsUrl);
      http.expectNone(ridesUrl);

      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
      window.dispatchEvent(new Event('online'));

      const futureRide: Ride = {
        id: 'ride-1',
        driverId: 'driver-1',
        origin: 'Batel',
        destination: 'UTFPR Neoville',
        departureTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        totalSeats: 3,
        availableSeats: 2,
        pricePerSeat: 9,
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      const createdRequest: RideRequest = {
        id: 'req-created',
        rideId: 'ride-1',
        passengerId: 'passenger-1',
        status: 'pending',
        createdAt: '2026-01-01T09:00:00.000Z',
      };

      const createdPromise = firstValueFrom(requestData.createRequest('ride-1'));
      http
        .expectOne((req) => req.method === 'GET' && req.url === requestsUrl)
        .flush([]);
      http
        .expectOne((req) => req.method === 'GET' && req.url === ridesUrl && req.params.get('id') === 'eq.ride-1')
        .flush([toRideRow(futureRide)]);
      http
        .expectOne((req) => req.method === 'POST' && req.url === requestsUrl)
        .flush(toRequestRow(createdRequest));

      await expect(createdPromise).resolves.toEqual({
        status: 'created',
        ride: futureRide,
        request: createdRequest,
      });
      http.verify();
    });

    it('bloqueia accept, reject e cancelRide sem HTTP quando offline e reabilita quando online', async () => {
      const http = TestBed.inject(HttpTestingController);
      const requestData = TestBed.inject(RideRequestData);
      await authenticate(http, 'driver-1');

      const futureRide: Ride = {
        id: 'ride-1',
        driverId: 'driver-1',
        origin: 'Batel',
        destination: 'UTFPR Neoville',
        departureTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        totalSeats: 3,
        availableSeats: 2,
        pricePerSeat: 9,
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      const pendingRequest: RideRequest = {
        id: 'req-pending',
        rideId: 'ride-1',
        passengerId: 'passenger-1',
        status: 'pending',
        createdAt: '2026-01-01T08:00:00.000Z',
      };

      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      window.dispatchEvent(new Event('offline'));

      requestData.accept(pendingRequest, futureRide);
      expect(requestData.decisionResult()).toEqual({ connectionError: true });

      requestData.reject(pendingRequest, futureRide);
      expect(requestData.decisionResult()).toEqual({ connectionError: true });

      requestData.cancelRide(futureRide);
      expect(requestData.cancelResult()).toEqual({ connectionError: true });

      http.expectNone(requestsUrl);
      http.expectNone(ridesUrl);
      http.expectNone(notificationsUrl);

      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
      window.dispatchEvent(new Event('online'));

      requestData.reject(pendingRequest, futureRide);
      const rejectReq = http.expectOne(
        (req) => req.url === requestsUrl && req.method === 'PATCH' && req.params.get('id') === 'eq.req-pending',
      );
      const rejected = { ...pendingRequest, status: 'rejected' as const };
      rejectReq.flush(toRequestRow(rejected));
      expect(requestData.decisionResult()).toEqual({ request: rejected, ride: futureRide });
      http.verify();
    });
  });
});
