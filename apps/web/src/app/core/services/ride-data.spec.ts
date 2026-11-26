import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { Ride } from '../models/ride.model';
import { AuthData } from './auth-data';
import { ErrorNotice } from './error-notice';
import { RideData, RideDetailResult } from './ride-data';
import { SUPABASE_AUTH_CLIENT, SupabaseAuthClient } from './supabase-client';

const ridesUrl = `${environment.supabaseUrl}/rest/v1/rides`;
const usersUrl = `${environment.supabaseUrl}/rest/v1/users`;
const driverSummariesRpcUrl = `${environment.supabaseUrl}/rest/v1/rpc/get_driver_summaries`;

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

async function authenticateStudent(http: HttpTestingController, overrides: Record<string, unknown> = {}): Promise<void> {
  const auth = TestBed.inject(AuthData);
  const email = (overrides['email'] as string | undefined) ?? 'motorista@alunos.utfpr.edu.br';
  auth.login(email, 'senha123');
  await flushMicrotasks();
  http.expectOne((request) => request.url === usersUrl).flush([
    {
      id: (overrides['id'] as string | undefined) ?? 'driver-1',
      name: 'Carlos Motorista',
      email,
      registration_number: '2020123',
      whatsapp: '41999998888',
      role: (overrides['role'] as string | undefined) ?? 'student',
      is_blocked: (overrides['isBlocked'] as boolean | undefined) ?? false,
      is_email_confirmed: true,
      rating_average: 5,
      created_at: '2026-01-01T00:00:00.000Z',
    },
  ]);
  await flushMicrotasks();
}

describe('RideData', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
  });

  it('carrega a oferta por id via /rest/v1/rides com o resumo público do motorista e cancela a leitura anterior ao trocar o id', async () => {
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http);
    const id = signal('ride-old');
    const detail = TestBed.inject(RideData).loadRideDetail(id, TestBed.inject(Injector));
    expect(detail()).toEqual({ status: 'loading' });
    TestBed.tick();
    const oldRead = http.expectOne(
      (req) => req.url === ridesUrl && req.method === 'GET' && req.params.get('id') === 'eq.ride-old',
    );

    id.set('007');
    TestBed.tick();
    expect(oldRead.cancelled).toBe(true);
    const ride: Ride = {
      id: '007',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: '2026-01-01T08:00:00.000Z',
      totalSeats: 2,
      availableSeats: 0,
      pricePerSeat: 9,
      status: 'completed',
      createdAt: '2025-12-30T10:00:00.000Z',
    };
    http
      .expectOne((req) => req.url === ridesUrl && req.method === 'GET' && req.params.get('id') === 'eq.007')
      .flush([toRideRow(ride)]);

    const summaries = http.expectOne(
      (request) => request.url === driverSummariesRpcUrl && request.method === 'POST',
    );
    expect(summaries.request.body).toEqual({ p_driver_ids: ['driver-1'] });
    expect(detail()).toEqual({ status: 'loading' });
    summaries.flush([{ id: 'driver-1', name: 'Carlos Motorista', rating_average: 5 }]);
    expect(detail()).toEqual({
      status: 'loaded',
      ride: { ...ride, driver: { name: 'Carlos Motorista', ratingAverage: 5 } },
    });

    id.set('999999');
    expect(detail()).toEqual({ status: 'loading' });
    TestBed.tick();
    http
      .expectOne((req) => req.url === ridesUrl && req.method === 'GET' && req.params.get('id') === 'eq.999999')
      .flush({ code: '22P02', message: 'invalid input syntax for type uuid' }, { status: 400, statusText: 'Bad Request' });
    expect(detail()).toEqual({ status: 'not-found' });

    id.set('ride-offline');
    expect(detail()).toEqual({ status: 'loading' });
    TestBed.tick();
    http
      .expectOne((req) => req.url === ridesUrl && req.method === 'GET' && req.params.get('id') === 'eq.ride-offline')
      .error(new ProgressEvent('error'));
    expect(detail()).toEqual({ status: 'error', connectionError: true });
    http.verify();
  });

  it('resolveRideDetail pré-carrega oferta e resumo do motorista e trata ausência, 22P02, erro e troca de sessão', async () => {
    const http = TestBed.inject(HttpTestingController);
    const rideData = TestBed.inject(RideData);
    const errorNotice = TestBed.inject(ErrorNotice);
    const auth = TestBed.inject(AuthData);

    await expect(firstValueFrom(rideData.resolveRideDetail(null))).resolves.toEqual({ status: 'not-found' });
    await expect(firstValueFrom(rideData.resolveRideDetail('   '))).resolves.toEqual({ status: 'not-found' });
    http.expectNone(ridesUrl);

    await authenticateStudent(http);

    const ride: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: '2026-01-01T08:00:00.000Z',
      totalSeats: 2,
      availableSeats: 1,
      pricePerSeat: 9,
      status: 'active',
      createdAt: '2025-12-30T10:00:00.000Z',
    };

    const loadedPromise = firstValueFrom(rideData.resolveRideDetail('ride-1'));
    http
      .expectOne((req) => req.url === ridesUrl && req.method === 'GET' && req.params.get('id') === 'eq.ride-1')
      .flush([toRideRow(ride)]);
    http
      .expectOne((req) => req.url === driverSummariesRpcUrl && req.method === 'POST')
      .flush([{ id: 'driver-1', name: 'Carlos Motorista', rating_average: 5 }]);
    await expect(loadedPromise).resolves.toEqual({
      status: 'loaded',
      ride: { ...ride, driver: { name: 'Carlos Motorista', ratingAverage: 5 } },
    });

    const emptyPromise = firstValueFrom(rideData.resolveRideDetail('missing'));
    http
      .expectOne((req) => req.url === ridesUrl && req.method === 'GET' && req.params.get('id') === 'eq.missing')
      .flush([]);
    await expect(emptyPromise).resolves.toEqual({ status: 'not-found' });

    const invalidUuidPromise = firstValueFrom(rideData.resolveRideDetail('not-a-uuid'));
    http
      .expectOne((req) => req.url === ridesUrl && req.method === 'GET' && req.params.get('id') === 'eq.not-a-uuid')
      .flush({ code: '22P02', message: 'invalid input syntax for type uuid' }, { status: 400, statusText: 'Bad Request' });
    await expect(invalidUuidPromise).resolves.toEqual({ status: 'not-found' });

    const offlinePromise = firstValueFrom(rideData.resolveRideDetail('ride-offline'));
    http
      .expectOne((req) => req.url === ridesUrl && req.method === 'GET' && req.params.get('id') === 'eq.ride-offline')
      .error(new ProgressEvent('error'));
    await expect(offlinePromise).resolves.toEqual({ status: 'error', connectionError: true });

    const serverErrorPromise = firstValueFrom(rideData.resolveRideDetail('ride-1'));
    http
      .expectOne((req) => req.url === ridesUrl && req.method === 'GET' && req.params.get('id') === 'eq.ride-1')
      .flush([toRideRow(ride)]);
    http
      .expectOne((req) => req.url === driverSummariesRpcUrl && req.method === 'POST')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await expect(serverErrorPromise).resolves.toEqual({ status: 'error' });
    expect(errorNotice.message()).toBe('');

    const emissions: RideDetailResult[] = [];
    const sub = rideData.resolveRideDetail('ride-1').subscribe((value) => emissions.push(value));
    const pendingOffer = http.expectOne(
      (req) => req.url === ridesUrl && req.method === 'GET' && req.params.get('id') === 'eq.ride-1',
    );
    auth.logout();
    pendingOffer.flush([toRideRow(ride)]);
    http.expectNone(driverSummariesRpcUrl);
    expect(emissions).toEqual([]);
    sub.unsubscribe();

    http.verify();
  });

  it('loadRideDetail reutiliza initialDetail sem duplicar leitura e recarrega em retry, troca de id sem initialDetail ou mudança de sessão', async () => {
    const http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthData);
    await authenticateStudent(http);

    const ride: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: '2026-01-01T08:00:00.000Z',
      totalSeats: 2,
      availableSeats: 1,
      pricePerSeat: 9,
      status: 'active',
      createdAt: '2025-12-30T10:00:00.000Z',
    };

    const id = signal('ride-1');
    const retry = signal(0);
    const initialDetail = signal<RideDetailResult | undefined>({
      status: 'loaded',
      ride: { ...ride, driver: { name: 'Carlos Motorista', ratingAverage: 5 } },
    });

    const detail = TestBed.inject(RideData).loadRideDetail(id, TestBed.inject(Injector), retry, initialDetail);
    TestBed.tick();
    http.expectNone(ridesUrl);
    http.expectNone(driverSummariesRpcUrl);
    expect(detail()).toEqual(initialDetail());

    // Novo initialDetail ao trocar para outra oferta também não duplica leitura.
    const otherRide: Ride = { ...ride, id: 'ride-2', origin: 'Centro' };
    id.set('ride-2');
    initialDetail.set({
      status: 'loaded',
      ride: { ...otherRide, driver: { name: 'Carlos Motorista', ratingAverage: 5 } },
    });
    TestBed.tick();
    http.expectNone(ridesUrl);
    expect(detail()).toEqual(initialDetail());

    // Retry força nova leitura HTTP.
    retry.set(1);
    expect(detail()).toEqual({ status: 'loading' });
    TestBed.tick();
    http
      .expectOne((req) => req.url === ridesUrl && req.method === 'GET' && req.params.get('id') === 'eq.ride-2')
      .flush([toRideRow(otherRide)]);
    http
      .expectOne((req) => req.url === driverSummariesRpcUrl && req.method === 'POST')
      .flush([{ id: 'driver-1', name: 'Carlos Motorista', rating_average: 5 }]);
    expect(detail()).toEqual({
      status: 'loaded',
      ride: { ...otherRide, driver: { name: 'Carlos Motorista', ratingAverage: 5 } },
    });

    // Logout seguido de nova sessão não reutiliza initialDetail antigo.
    retry.set(0);
    auth.logout();
    await authenticateStudent(http, { id: 'passenger-2', email: 'outro@alunos.utfpr.edu.br' });
    expect(detail()).toEqual({ status: 'loading' });
    TestBed.tick();
    http
      .expectOne((req) => req.url === ridesUrl && req.method === 'GET' && req.params.get('id') === 'eq.ride-2')
      .flush([toRideRow({ ...otherRide, origin: 'Água Verde' })]);
    http
      .expectOne((req) => req.url === driverSummariesRpcUrl && req.method === 'POST')
      .flush([{ id: 'driver-1', name: 'Carlos Motorista', rating_average: 5 }]);
    expect(detail()).toEqual({
      status: 'loaded',
      ride: { ...otherRide, origin: 'Água Verde', driver: { name: 'Carlos Motorista', ratingAverage: 5 } },
    });

    http.verify();
  });

  it('publica uma oferta ativa em /rest/v1/rides vinculada ao aluno autenticado', async () => {
    const rideData = TestBed.inject(RideData);
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http);

    expect(rideData.publishResult()).toBeUndefined();

    const departureTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    rideData.publish({
      origin: 'Portão',
      destination: 'UTFPR - Sede Centro',
      departureTime,
      totalSeats: 3,
      pricePerSeat: 0,
      notes: 'Em frente ao terminal',
    });

    const request = http.expectOne((req) => req.url === ridesUrl && req.method === 'POST');
    expect(request.request.headers.get('Prefer')).toBe('return=representation');
    expect(request.request.headers.get('Accept')).toBe('application/vnd.pgrst.object+json');
    expect(request.request.body).toEqual({
      driver_id: 'driver-1',
      origin: 'Portão',
      destination: 'UTFPR - Sede Centro',
      departure_time: departureTime,
      total_seats: 3,
      available_seats: 3,
      price_per_seat: 0,
      status: 'active',
      notes: 'Em frente ao terminal',
      created_at: expect.any(String),
    });

    const row = { id: 'ride-1', ...request.request.body };
    request.flush(row);

    const created: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Portão',
      destination: 'UTFPR - Sede Centro',
      departureTime,
      totalSeats: 3,
      availableSeats: 3,
      pricePerSeat: 0,
      status: 'active',
      notes: 'Em frente ao terminal',
      createdAt: row.created_at,
    };
    expect(rideData.publishResult()).toEqual({ ride: created });
    http.verify();
  });

  it('impede publicação quando não há aluno autenticado', () => {
    const rideData = TestBed.inject(RideData);
    const http = TestBed.inject(HttpTestingController);

    rideData.publish({
      origin: 'Portão',
      destination: 'UTFPR - Sede Centro',
      departureTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      totalSeats: 2,
      pricePerSeat: 8,
    });

    http.expectNone(ridesUrl);
    expect(rideData.publishResult()).toEqual({ unauthorized: true });
    http.verify();
  });

  it('carrega as ofertas do motorista autenticado em /rest/v1/rides e verifica se a oferta aceita novos pedidos', async () => {
    const rideData = TestBed.inject(RideData);
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http);

    const futureDeparture = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const activeRide: Ride = {
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
    const fullRide: Ride = {
      ...activeRide,
      id: 'ride-2',
      availableSeats: 0,
      status: 'full',
    };

    rideData.loadDriverRides();

    const request = http.expectOne(
      (req) =>
        req.url === ridesUrl &&
        req.method === 'GET' &&
        req.params.get('driver_id') === 'eq.driver-1',
    );
    request.flush([toRideRow(activeRide), toRideRow(fullRide)]);

    expect(rideData.driverRides()).toEqual([activeRide, fullRide]);
    expect(rideData.canAcceptNewRequests(activeRide)).toBe(true);
    expect(rideData.canAcceptNewRequests(fullRide)).toBe(false);
    http.verify();
  });

  it('atualiza uma oferta sem passageiros confirmados antes da viagem e valida novamente campos obrigatórios, vagas e data futura', async () => {
    const rideData = TestBed.inject(RideData);
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http);

    const initialDeparture = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const existingRide: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: initialDeparture,
      totalSeats: 2,
      availableSeats: 2,
      pricePerSeat: 9,
      status: 'active',
      notes: 'Saída pontual',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    rideData.loadDriverRides();
    http
      .expectOne((req) => req.url === ridesUrl && req.params.get('driver_id') === 'eq.driver-1')
      .flush([toRideRow(existingRide)]);

    rideData.startEditing(existingRide);
    expect(rideData.editingRide()).toEqual(existingRide);

    const newDeparture = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();

    rideData.update(existingRide, {
      origin: '   ',
      destination: 'UTFPR - Sede Centro',
      departureTime: newDeparture,
      totalSeats: 3,
      pricePerSeat: 10,
    });
    http.expectNone(ridesUrl);
    expect(rideData.updateResult()).toEqual({ invalidData: true });

    rideData.update(existingRide, {
      origin: 'Cabral',
      destination: 'UTFPR - Sede Centro',
      departureTime: newDeparture,
      totalSeats: 5,
      pricePerSeat: 10,
    });
    http.expectNone(ridesUrl);
    expect(rideData.updateResult()).toEqual({ invalidData: true });

    rideData.update(existingRide, {
      origin: 'Cabral',
      destination: 'UTFPR - Sede Centro',
      departureTime: new Date(Date.now() - 60 * 1000).toISOString(),
      totalSeats: 3,
      pricePerSeat: 10,
    });
    http.expectNone(ridesUrl);
    expect(rideData.updateResult()).toEqual({ invalidData: true });

    rideData.update(existingRide, {
      origin: 'Cabral',
      destination: 'UTFPR - Sede Centro',
      departureTime: newDeparture,
      totalSeats: 4,
      pricePerSeat: 12,
      notes: 'Em frente ao terminal do Cabral',
    });

    const patchReq = http.expectOne(
      (req) => req.url === ridesUrl && req.method === 'PATCH' && req.params.get('id') === 'eq.ride-1',
    );
    expect(patchReq.request.headers.get('Prefer')).toBe('return=representation');
    expect(patchReq.request.headers.get('Accept')).toBe('application/vnd.pgrst.object+json');
    expect(patchReq.request.body).toEqual({
      origin: 'Cabral',
      destination: 'UTFPR - Sede Centro',
      departure_time: newDeparture,
      total_seats: 4,
      available_seats: 4,
      price_per_seat: 12,
      status: 'active',
      notes: 'Em frente ao terminal do Cabral',
    });

    const updatedRide: Ride = {
      ...existingRide,
      origin: 'Cabral',
      destination: 'UTFPR - Sede Centro',
      departureTime: newDeparture,
      totalSeats: 4,
      availableSeats: 4,
      pricePerSeat: 12,
      status: 'active',
      notes: 'Em frente ao terminal do Cabral',
    };
    patchReq.flush(toRideRow(updatedRide));

    expect(rideData.updateResult()).toEqual({ ride: updatedRide });
    expect(rideData.driverRides()[0]).toEqual(updatedRide);
    http.verify();
  });

  it('restringe edição de oferta com passageiros confirmados antes da viagem e retorna oferta esgotada para ativa', async () => {
    const rideData = TestBed.inject(RideData);
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http);

    const initialDeparture = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const fullRideWithPassengers: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: initialDeparture,
      totalSeats: 2,
      availableSeats: 0,
      pricePerSeat: 9,
      status: 'full',
      notes: 'Saída pontual',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    rideData.loadDriverRides();
    http
      .expectOne((req) => req.url === ridesUrl && req.params.get('driver_id') === 'eq.driver-1')
      .flush([toRideRow(fullRideWithPassengers)]);

    rideData.update(fullRideWithPassengers, {
      origin: 'Cabral',
      destination: 'UTFPR Neoville',
      departureTime: initialDeparture,
      totalSeats: 3,
      pricePerSeat: 9,
      notes: 'Saída pontual',
    });
    http.expectNone(ridesUrl);
    expect(rideData.updateResult()).toEqual({ invalidData: true });

    rideData.update(fullRideWithPassengers, {
      origin: 'Batel',
      destination: 'UTFPR - Sede Centro',
      departureTime: initialDeparture,
      totalSeats: 3,
      pricePerSeat: 9,
      notes: 'Saída pontual',
    });
    http.expectNone(ridesUrl);
    expect(rideData.updateResult()).toEqual({ invalidData: true });

    rideData.update(fullRideWithPassengers, {
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
      totalSeats: 3,
      pricePerSeat: 9,
      notes: 'Saída pontual',
    });
    http.expectNone(ridesUrl);
    expect(rideData.updateResult()).toEqual({ invalidData: true });

    rideData.update(fullRideWithPassengers, {
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: initialDeparture,
      totalSeats: 3,
      pricePerSeat: 12,
      notes: 'Saída pontual',
    });
    http.expectNone(ridesUrl);
    expect(rideData.updateResult()).toEqual({ invalidData: true });

    rideData.update(fullRideWithPassengers, {
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: initialDeparture,
      totalSeats: 1,
      pricePerSeat: 9,
      notes: 'Saída pontual',
    });
    http.expectNone(ridesUrl);
    expect(rideData.updateResult()).toEqual({ invalidData: true });

    rideData.update(fullRideWithPassengers, {
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: initialDeparture,
      totalSeats: 5,
      pricePerSeat: 9,
      notes: 'Saída pontual',
    });
    http.expectNone(ridesUrl);
    expect(rideData.updateResult()).toEqual({ invalidData: true });

    rideData.update(fullRideWithPassengers, {
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: initialDeparture,
      totalSeats: 3,
      pricePerSeat: 9,
      notes: 'Saída pontual',
    });

    const patchReq = http.expectOne(
      (req) => req.url === ridesUrl && req.method === 'PATCH' && req.params.get('id') === 'eq.ride-1',
    );
    expect(patchReq.request.body).toEqual({
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departure_time: initialDeparture,
      total_seats: 3,
      available_seats: 1,
      price_per_seat: 9,
      status: 'active',
      notes: 'Saída pontual',
    });

    const reopenedRide: Ride = {
      ...fullRideWithPassengers,
      totalSeats: 3,
      availableSeats: 1,
      status: 'active',
    };
    patchReq.flush(toRideRow(reopenedRide));

    expect(rideData.updateResult()).toEqual({ ride: reopenedRide });
    expect(rideData.driverRides()[0]).toEqual(reopenedRide);
    expect(rideData.canAcceptNewRequests(reopenedRide)).toBe(true);
    http.verify();
  });

  it('permite cancelar oferta ativa ou esgotada apenas antes da viagem e atualiza seu status para cancelled', async () => {
    const rideData = TestBed.inject(RideData);
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http);

    const futureDeparture = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const pastDeparture = new Date(Date.now() - 60 * 1000).toISOString();

    const activeRide: Ride = {
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
    const fullRide: Ride = { ...activeRide, id: 'ride-2', availableSeats: 0, status: 'full' };
    const cancelledRide: Ride = { ...activeRide, id: 'ride-3', status: 'cancelled' };
    const completedRide: Ride = { ...activeRide, id: 'ride-4', status: 'completed' };
    const pastRide: Ride = { ...activeRide, id: 'ride-5', departureTime: pastDeparture };

    expect(rideData.canCancel(activeRide)).toBe(true);
    expect(rideData.canCancel(fullRide)).toBe(true);
    expect(rideData.canCancel(cancelledRide)).toBe(false);
    expect(rideData.canCancel(completedRide)).toBe(false);
    expect(rideData.canCancel(pastRide)).toBe(false);

    rideData.loadDriverRides();
    http
      .expectOne((req) => req.url === ridesUrl && req.params.get('driver_id') === 'eq.driver-1')
      .flush([toRideRow(activeRide)]);

    const cancelPromise = firstValueFrom(rideData.cancel$(activeRide));
    const patchReq = http.expectOne(
      (req) => req.url === ridesUrl && req.method === 'PATCH' && req.params.get('id') === 'eq.ride-1',
    );
    expect(patchReq.request.body).toEqual({ status: 'cancelled' });
    const updated: Ride = { ...activeRide, status: 'cancelled' };
    patchReq.flush(toRideRow(updated));

    const result = await cancelPromise;
    expect(result).toEqual(updated);
    expect(rideData.driverRides()[0]).toEqual(updated);
    expect(rideData.canCancel(updated)).toBe(false);
    http.verify();
  });

  it('impede que aluno bloqueado publique oferta (canOffer false e não dispara POST /rest/v1/rides)', async () => {
    const rideData = TestBed.inject(RideData);
    const authData = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http);

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

    expect(rideData.canOffer()).toBe(false);
    rideData.publish({
      origin: 'Portão',
      destination: 'UTFPR - Sede Centro',
      departureTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      totalSeats: 2,
      pricePerSeat: 8,
    });

    http.expectNone(ridesUrl);
    expect(rideData.publishResult()).toEqual({ unauthorized: true });
    http.verify();
  });

  it('impede que perfil de suporte publique oferta (canOffer false e não dispara POST /rest/v1/rides)', async () => {
    const rideData = TestBed.inject(RideData);
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http, {
      id: 'support-1',
      email: 'suporte@alunos.utfpr.edu.br',
      role: 'support',
    });

    expect(rideData.canOffer()).toBe(false);
    rideData.publish({
      origin: 'Portão',
      destination: 'UTFPR - Sede Centro',
      departureTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      totalSeats: 2,
      pricePerSeat: 8,
    });

    http.expectNone(ridesUrl);
    expect(rideData.publishResult()).toEqual({ unauthorized: true });
    http.verify();
  });

  it('impede que outro aluno inicie edição, carregue edição, atualize, ocupe vaga ou cancele oferta', async () => {
    const rideData = TestBed.inject(RideData);
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http, { id: 'driver-2', email: 'outro@alunos.utfpr.edu.br' });

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

    expect(rideData.canManageRide(rideFromDriver1)).toBe(false);
    expect(rideData.canCancel(rideFromDriver1)).toBe(false);
    expect(rideData.startEditing(rideFromDriver1)).toBe(false);
    expect(rideData.editingRide()).toBeNull();
    expect(rideData.editRideLoadResult()).toEqual({ unauthorized: true });

    rideData.loadRideForEdit('ride-1');
    http
      .expectOne((req) => req.url === ridesUrl && req.method === 'GET' && req.params.get('id') === 'eq.ride-1')
      .flush([toRideRow(rideFromDriver1)]);
    expect(rideData.editingRide()).toBeNull();
    expect(rideData.editRideLoadResult()).toEqual({ unauthorized: true });

    rideData.update(rideFromDriver1, {
      origin: 'Cabral',
      destination: 'UTFPR - Sede Centro',
      departureTime: futureDeparture,
      totalSeats: 3,
      pricePerSeat: 10,
    });
    http.expectNone(ridesUrl);
    expect(rideData.updateResult()).toEqual({ unauthorized: true });

    await expect(firstValueFrom(rideData.cancel$(rideFromDriver1))).rejects.toThrow();
    await expect(firstValueFrom(rideData.occupySeat$(rideFromDriver1))).rejects.toThrow();
    http.expectNone(ridesUrl);

    http.verify();
  });

  it('impede que aluno bloqueado (mesmo sendo o autor) inicie edição, carregue edição, carregue ofertas, atualize, ocupe vaga ou cancele oferta', async () => {
    const rideData = TestBed.inject(RideData);
    const authData = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http);

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

    expect(rideData.canManageRide(rideFromDriver1)).toBe(false);
    expect(rideData.canCancel(rideFromDriver1)).toBe(false);
    expect(rideData.startEditing(rideFromDriver1)).toBe(false);
    expect(rideData.editingRide()).toBeNull();

    rideData.loadRideForEdit('ride-1');
    http.expectNone(ridesUrl);
    expect(rideData.editRideLoadResult()).toEqual({ unauthorized: true });

    rideData.loadDriverRides();
    http.expectNone(ridesUrl);
    expect(rideData.driverRidesResult()).toEqual({ unauthorized: true });

    rideData.update(rideFromDriver1, {
      origin: 'Cabral',
      destination: 'UTFPR - Sede Centro',
      departureTime: futureDeparture,
      totalSeats: 3,
      pricePerSeat: 10,
    });
    await expect(firstValueFrom(rideData.cancel$(rideFromDriver1))).rejects.toThrow();
    await expect(firstValueFrom(rideData.occupySeat$(rideFromDriver1))).rejects.toThrow();
    http.expectNone(ridesUrl);
    expect(rideData.updateResult()).toEqual({ unauthorized: true });

    http.verify();
  });

  it('filtra em loadDriverRides ofertas que não pertencem ao motorista autenticado', async () => {
    const rideData = TestBed.inject(RideData);
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http);

    const futureDeparture = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const ownRide: Ride = {
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
    const foreignRide: Ride = {
      ...ownRide,
      id: 'ride-2',
      driverId: 'driver-2',
    };

    rideData.loadDriverRides();
    http
      .expectOne((req) => req.url === ridesUrl && req.params.get('driver_id') === 'eq.driver-1')
      .flush([toRideRow(ownRide), toRideRow(foreignRide)]);

    expect(rideData.driverRides()).toEqual([ownRide]);
    expect(rideData.driverRidesResult()).toEqual({ rides: [ownRide] });
    http.verify();
  });

  it('delega a elegibilidade de motorista para AuthData.canOffer em canOffer, canOperateAsDriver e nas operações', async () => {
    const authData = TestBed.inject(AuthData);
    const canOfferSpy = vi.spyOn(authData, 'canOffer');
    const rideData = TestBed.inject(RideData);
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http);

    const futureDeparture = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const ownRide: Ride = {
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

    expect(rideData.canOffer).toBe(authData.canOffer);
    expect(rideData.canOffer()).toBe(true);
    expect(rideData.canOperateAsDriver()).toBe(true);
    expect(rideData.canManageRide(ownRide)).toBe(true);

    canOfferSpy.mockReturnValue(false);

    expect(rideData.canOffer()).toBe(false);
    expect(rideData.canOperateAsDriver()).toBe(false);
    expect(rideData.canManageRide(ownRide)).toBe(false);
    expect(rideData.canCancel(ownRide)).toBe(false);
    expect(rideData.startEditing(ownRide)).toBe(false);

    rideData.loadDriverRides();
    http.expectNone(ridesUrl);
    expect(rideData.driverRidesResult()).toEqual({ unauthorized: true });

    rideData.loadRideForEdit('ride-1');
    http.expectNone(ridesUrl);
    expect(rideData.editRideLoadResult()).toEqual({ unauthorized: true });

    rideData.publish({
      origin: 'Portão',
      destination: 'UTFPR - Sede Centro',
      departureTime: futureDeparture,
      totalSeats: 2,
      pricePerSeat: 8,
    });
    http.expectNone(ridesUrl);
    expect(rideData.publishResult()).toEqual({ unauthorized: true });

    rideData.update(ownRide, {
      origin: 'Cabral',
      destination: 'UTFPR - Sede Centro',
      departureTime: futureDeparture,
      totalSeats: 3,
      pricePerSeat: 10,
    });
    http.expectNone(ridesUrl);
    expect(rideData.updateResult()).toEqual({ unauthorized: true });

    await expect(firstValueFrom(rideData.cancel$(ownRide))).rejects.toThrow();
    await expect(firstValueFrom(rideData.occupySeat$(ownRide))).rejects.toThrow();
    http.expectNone(ridesUrl);

    http.verify();
  });

  it('informa falha de conexão (status 0) ao publicar, editar, carregar para edição e listar ofertas e permite nova tentativa preservando o estado', async () => {
    const rideData = TestBed.inject(RideData);
    const errorNotice = TestBed.inject(ErrorNotice);
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http);

    const futureDeparture = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const draft = {
      origin: 'Portão',
      destination: 'UTFPR - Sede Centro',
      departureTime: futureDeparture,
      totalSeats: 3,
      pricePerSeat: 7,
      notes: 'Terminal do Portão',
    };

    rideData.publish(draft);
    http
      .expectOne((req) => req.url === ridesUrl && req.method === 'POST')
      .error(new ProgressEvent('error'));

    expect(rideData.publishResult()).toEqual({ connectionError: true });
    expect(errorNotice.message()).toContain('Falha de conexão');

    rideData.publish(draft);
    expect(errorNotice.message()).toBe('');
    const retryPublish = http.expectOne(
      (req) => req.url === ridesUrl && req.method === 'POST',
    );
    const createdRide: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      availableSeats: 3,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      ...draft,
    };
    retryPublish.flush(toRideRow(createdRide));
    expect(rideData.publishResult()).toEqual({ ride: createdRide });

    rideData.loadDriverRides();
    http
      .expectOne(
        (req) =>
          req.url === ridesUrl &&
          req.method === 'GET' &&
          req.params.get('driver_id') === 'eq.driver-1',
      )
      .error(new ProgressEvent('error'));

    expect(rideData.driverRidesResult()).toEqual({ connectionError: true });
    expect(errorNotice.message()).toContain('Falha de conexão');

    rideData.loadDriverRides();
    expect(errorNotice.message()).toBe('');
    http
      .expectOne(
        (req) =>
          req.url === ridesUrl &&
          req.method === 'GET' &&
          req.params.get('driver_id') === 'eq.driver-1',
      )
      .flush([toRideRow(createdRide)]);
    expect(rideData.driverRides()).toEqual([createdRide]);
    expect(rideData.driverRidesResult()).toEqual({ rides: [createdRide] });

    rideData.loadRideForEdit('ride-1');
    http
      .expectOne((req) => req.url === ridesUrl && req.method === 'GET' && req.params.get('id') === 'eq.ride-1')
      .error(new ProgressEvent('error'));

    expect(rideData.editRideLoadResult()).toEqual({ connectionError: true });
    expect(rideData.editingRide()).toBeNull();
    expect(errorNotice.message()).toContain('Falha de conexão');

    rideData.loadRideForEdit('ride-1');
    expect(errorNotice.message()).toBe('');
    http
      .expectOne((req) => req.url === ridesUrl && req.method === 'GET' && req.params.get('id') === 'eq.ride-1')
      .flush([toRideRow(createdRide)]);
    expect(rideData.editRideLoadResult()).toEqual({ ride: createdRide });
    expect(rideData.editingRide()).toEqual(createdRide);

    const updatedDraft = {
      ...draft,
      origin: 'Água Verde',
      totalSeats: 4,
      pricePerSeat: 10,
    };
    rideData.update(createdRide, updatedDraft);
    http
      .expectOne((req) => req.url === ridesUrl && req.method === 'PATCH' && req.params.get('id') === 'eq.ride-1')
      .error(new ProgressEvent('error'));

    expect(rideData.updateResult()).toEqual({ connectionError: true });
    expect(errorNotice.message()).toContain('Falha de conexão');
    expect(rideData.editingRide()).toEqual(createdRide);
    expect(rideData.driverRides()[0]).toEqual(createdRide);

    rideData.update(createdRide, updatedDraft);
    expect(errorNotice.message()).toBe('');
    const retryUpdate = http.expectOne(
      (req) => req.url === ridesUrl && req.method === 'PATCH' && req.params.get('id') === 'eq.ride-1',
    );
    const updatedRide: Ride = {
      ...createdRide,
      ...updatedDraft,
      availableSeats: 4,
    };
    retryUpdate.flush(toRideRow(updatedRide));
    expect(rideData.updateResult()).toEqual({ ride: updatedRide });
    expect(rideData.editingRide()).toEqual(updatedRide);
    expect(rideData.driverRides()[0]).toEqual(updatedRide);

    http.verify();
  });

  it('permite excluir apenas oferta cancelada do motorista autor ativo via DELETE /rest/v1/rides?id=eq.<id> e atualiza driverRides e editingRide', async () => {
    const rideData = TestBed.inject(RideData);
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http);

    const futureDeparture = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const cancelledRide: Ride = {
      id: 'ride-cancelled',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: futureDeparture,
      totalSeats: 2,
      availableSeats: 2,
      pricePerSeat: 9,
      status: 'cancelled',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const activeRide: Ride = { ...cancelledRide, id: 'ride-active', status: 'active' };
    const fullRide: Ride = { ...cancelledRide, id: 'ride-full', availableSeats: 0, status: 'full' };
    const completedRide: Ride = { ...cancelledRide, id: 'ride-completed', status: 'completed' };

    expect(rideData.canDelete(cancelledRide)).toBe(true);
    expect(rideData.canDelete(activeRide)).toBe(false);
    expect(rideData.canDelete(fullRide)).toBe(false);
    expect(rideData.canDelete(completedRide)).toBe(false);
    expect(rideData.deleteResult()).toBeUndefined();

    rideData.loadDriverRides();
    http
      .expectOne((req) => req.url === ridesUrl && req.params.get('driver_id') === 'eq.driver-1')
      .flush([toRideRow(cancelledRide), toRideRow(activeRide)]);

    rideData.startEditing(cancelledRide);
    expect(rideData.editingRide()).toEqual(cancelledRide);

    rideData.deleteRide(cancelledRide);

    const deleteReq = http.expectOne(
      (req) =>
        req.url === ridesUrl &&
        req.method === 'DELETE' &&
        req.params.get('id') === 'eq.ride-cancelled',
    );
    deleteReq.flush(null);

    expect(rideData.deleteResult()).toEqual({ deletedRideId: 'ride-cancelled' });
    expect(rideData.driverRides()).toEqual([activeRide]);
    expect(rideData.editingRide()).toBeNull();

    rideData.resetDelete();
    expect(rideData.deleteResult()).toBeUndefined();

    http.verify();
  });

  it('bloqueia exclusão sem requisição HTTP para ofertas active, full e completed', async () => {
    const rideData = TestBed.inject(RideData);
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http);

    const futureDeparture = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const baseRide: Ride = {
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
    const activeRide: Ride = { ...baseRide, id: 'ride-active', status: 'active' };
    const fullRide: Ride = { ...baseRide, id: 'ride-full', availableSeats: 0, status: 'full' };
    const completedRide: Ride = { ...baseRide, id: 'ride-completed', status: 'completed' };

    rideData.loadDriverRides();
    http
      .expectOne((req) => req.url === ridesUrl && req.params.get('driver_id') === 'eq.driver-1')
      .flush([toRideRow(activeRide), toRideRow(fullRide), toRideRow(completedRide)]);

    for (const ride of [activeRide, fullRide, completedRide]) {
      expect(rideData.canDelete(ride)).toBe(false);
      rideData.deleteRide(ride);
      http.expectNone(ridesUrl);
      expect(rideData.deleteResult()).toEqual({ invalidState: true });
    }

    expect(rideData.driverRides()).toEqual([activeRide, fullRide, completedRide]);
    http.verify();
  });

  it('bloqueia exclusão sem requisição HTTP para usuário não autenticado ou outro autor', async () => {
    const rideData = TestBed.inject(RideData);
    const http = TestBed.inject(HttpTestingController);

    const cancelledRideOfDriver1: Ride = {
      id: 'ride-cancelled-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      totalSeats: 2,
      availableSeats: 2,
      pricePerSeat: 9,
      status: 'cancelled',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    expect(rideData.canDelete(cancelledRideOfDriver1)).toBe(false);
    rideData.deleteRide(cancelledRideOfDriver1);
    http.expectNone(ridesUrl);
    expect(rideData.deleteResult()).toEqual({ unauthorized: true });

    await authenticateStudent(http, { id: 'driver-2', email: 'outro@alunos.utfpr.edu.br' });
    expect(rideData.canDelete(cancelledRideOfDriver1)).toBe(false);
    rideData.deleteRide(cancelledRideOfDriver1);
    http.expectNone(ridesUrl);
    expect(rideData.deleteResult()).toEqual({ unauthorized: true });

    http.verify();
  });

  it('bloqueia exclusão sem requisição HTTP para conta bloqueada mesmo sendo o autor', async () => {
    const rideData = TestBed.inject(RideData);
    const authData = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http);

    const cancelledRideOfDriver1: Ride = {
      id: 'ride-cancelled-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      totalSeats: 2,
      availableSeats: 2,
      pricePerSeat: 9,
      status: 'cancelled',
      createdAt: '2026-01-01T00:00:00.000Z',
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

    expect(rideData.canDelete(cancelledRideOfDriver1)).toBe(false);
    rideData.deleteRide(cancelledRideOfDriver1);
    http.expectNone(ridesUrl);
    expect(rideData.deleteResult()).toEqual({ unauthorized: true });

    http.verify();
  });

  it('bloqueia exclusão sem requisição HTTP para perfil support', async () => {
    const rideData = TestBed.inject(RideData);
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http, {
      id: 'support-1',
      email: 'suporte@alunos.utfpr.edu.br',
      role: 'support',
    });

    const cancelledRideOfSupportId: Ride = {
      id: 'ride-cancelled-support',
      driverId: 'support-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      totalSeats: 2,
      availableSeats: 2,
      pricePerSeat: 9,
      status: 'cancelled',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    expect(rideData.canDelete(cancelledRideOfSupportId)).toBe(false);
    rideData.deleteRide(cancelledRideOfSupportId);
    http.expectNone(ridesUrl);
    expect(rideData.deleteResult()).toEqual({ unauthorized: true });

    http.verify();
  });

  it('trata falha de conexão (status 0) e erro do servidor na exclusão preservando estado e permitindo nova tentativa', async () => {
    const rideData = TestBed.inject(RideData);
    const errorNotice = TestBed.inject(ErrorNotice);
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http);

    const cancelledRide: Ride = {
      id: 'ride-cancelled',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      totalSeats: 2,
      availableSeats: 2,
      pricePerSeat: 9,
      status: 'cancelled',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    rideData.loadDriverRides();
    http
      .expectOne((req) => req.url === ridesUrl && req.params.get('driver_id') === 'eq.driver-1')
      .flush([toRideRow(cancelledRide)]);
    rideData.startEditing(cancelledRide);

    rideData.deleteRide(cancelledRide);
    http
      .expectOne(
        (req) =>
          req.url === ridesUrl &&
          req.method === 'DELETE' &&
          req.params.get('id') === 'eq.ride-cancelled',
      )
      .error(new ProgressEvent('error'));

    expect(rideData.deleteResult()).toEqual({ connectionError: true });
    expect(errorNotice.message()).toContain('Falha de conexão');
    expect(rideData.driverRides()).toEqual([cancelledRide]);
    expect(rideData.editingRide()).toEqual(cancelledRide);

    rideData.deleteRide(cancelledRide);
    expect(errorNotice.message()).toBe('');
    http
      .expectOne(
        (req) =>
          req.url === ridesUrl &&
          req.method === 'DELETE' &&
          req.params.get('id') === 'eq.ride-cancelled',
      )
      .flush('Erro no servidor', { status: 500, statusText: 'Internal Server Error' });

    expect(rideData.deleteResult()).toEqual({ requestError: true });
    expect(rideData.driverRides()).toEqual([cancelledRide]);
    expect(rideData.editingRide()).toEqual(cancelledRide);

    rideData.deleteRide(cancelledRide);
    http
      .expectOne(
        (req) =>
          req.url === ridesUrl &&
          req.method === 'DELETE' &&
          req.params.get('id') === 'eq.ride-cancelled',
      )
      .flush(null);

    expect(rideData.deleteResult()).toEqual({ deletedRideId: 'ride-cancelled' });
    expect(rideData.driverRides()).toEqual([]);
    expect(rideData.editingRide()).toBeNull();

    http.verify();
  });

  it('cancela exclusão pendente em resetDelete e isola troca de sessão durante DELETE em andamento', async () => {
    const rideData = TestBed.inject(RideData);
    const authData = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http);

    const cancelledRide: Ride = {
      id: 'ride-cancelled',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      totalSeats: 2,
      availableSeats: 2,
      pricePerSeat: 9,
      status: 'cancelled',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    rideData.loadDriverRides();
    http
      .expectOne((req) => req.url === ridesUrl && req.params.get('driver_id') === 'eq.driver-1')
      .flush([toRideRow(cancelledRide)]);

    rideData.deleteRide(cancelledRide);
    const firstDelete = http.expectOne(
      (req) =>
        req.url === ridesUrl &&
        req.method === 'DELETE' &&
        req.params.get('id') === 'eq.ride-cancelled',
    );
    rideData.resetDelete();
    expect(firstDelete.cancelled).toBe(true);
    expect(rideData.deleteResult()).toBeUndefined();
    expect(rideData.driverRides()).toEqual([cancelledRide]);

    rideData.deleteRide(cancelledRide);
    const pendingDelete = http.expectOne(
      (req) =>
        req.url === ridesUrl &&
        req.method === 'DELETE' &&
        req.params.get('id') === 'eq.ride-cancelled',
    );
    authData.logout();
    pendingDelete.flush(null);

    expect(rideData.deleteResult()).toBeUndefined();
    expect(rideData.driverRides()).toEqual([cancelledRide]);

    http.verify();
  });
});

describe('Busca de ofertas em RideData (CA1)', () => {
  const filters = { origin: '', destination: '', date: '' };
  const debounceMs = 250;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(2030, 4, 9, 18));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  async function startSearch(http: HttpTestingController) {
    await authenticateStudent(http);
    const criteria = signal(filters);
    const rideData = TestBed.inject(RideData);
    const result = rideData.searchAvailableRides(criteria, TestBed.inject(Injector));
    return { criteria, result };
  }

  function runDebounce(): void {
    TestBed.tick();
    vi.advanceTimersByTime(debounceMs);
  }

  it('aplica os três filtros via PostgREST e enriquece apenas as ofertas elegíveis com RPC get_driver_summaries', async () => {
    const http = TestBed.inject(HttpTestingController);
    const { criteria, result } = await startSearch(http);
    const eligible: Ride = {
      id: 'ride-available',
      driverId: '007',
      origin: 'São José dos Pinhais (Centro)',
      destination: 'UTFPR - Sede Centro',
      departureTime: new Date(2030, 4, 10, 23, 30).toISOString(),
      totalSeats: 2,
      availableSeats: 1,
      pricePerSeat: 12,
      status: 'active',
      createdAt: new Date(2030, 4, 9, 16).toISOString(),
    };
    const another = { ...eligible, id: 'ride-another', driverId: 'driver-3' };

    criteria.set({ origin: '  SÃO JOSÉ ', destination: 'sede centro', date: '2030-05-10' });
    expect(result()).toEqual({ status: 'loading' });
    runDebounce();
    const ridesRequest = http.expectOne((request) => request.url === ridesUrl && request.method === 'GET');
    expect(ridesRequest.request.params.get('status')).toBe('eq.active');
    expect(ridesRequest.request.params.get('available_seats')).toBe('gt.0');
    expect(ridesRequest.request.params.get('driver_id')).toBe('neq.driver-1');
    expect(ridesRequest.request.params.get('origin')).toBe('ilike.*são josé*');
    expect(ridesRequest.request.params.get('destination')).toBe('ilike.*sede centro*');
    ridesRequest.flush([
      toRideRow(eligible),
      toRideRow(another),
      toRideRow({ ...eligible, id: 'same-driver', departureTime: new Date(2030, 4, 10, 22).toISOString() }),
      toRideRow({ ...eligible, id: 'full', status: 'full' }),
      toRideRow({ ...eligible, id: 'cancelled', status: 'cancelled' }),
      toRideRow({ ...eligible, id: 'completed', status: 'completed' }),
      toRideRow({ ...eligible, id: 'zero-seats', status: 'active', availableSeats: 0 }),
      toRideRow({ ...eligible, id: 'passed', departureTime: new Date(2030, 4, 9, 17).toISOString() }),
      toRideRow({ ...eligible, id: 'own', driverId: 'driver-1' }),
      toRideRow({ ...eligible, id: 'wrong-origin', origin: 'Pinhais' }),
      toRideRow({ ...eligible, id: 'wrong-destination', destination: 'UTFPR Neoville' }),
      toRideRow({ ...eligible, id: 'wrong-date', departureTime: new Date(2030, 4, 11, 0).toISOString() }),
    ]);

    http.expectNone((request) => request.url === usersUrl);
    const driversRequest = http.expectOne(
      (request) => request.url === driverSummariesRpcUrl && request.method === 'POST',
    );
    expect(driversRequest.request.body).toEqual({ p_driver_ids: ['007', 'driver-3'] });
    expect(result()).toEqual({ status: 'loading' });
    driversRequest.flush([
      { id: '007', name: 'Gabriela Silva', rating_average: 4.9 },
      { id: 'driver-3', name: 'Camila Rocha', rating_average: 4.8 },
    ]);

    expect(result()).toEqual({
      status: 'loaded',
      rides: [
        { ...eligible, driver: { name: 'Gabriela Silva', ratingAverage: 4.9 } },
        { ...another, driver: { name: 'Camila Rocha', ratingAverage: 4.8 } },
        {
          ...eligible,
          id: 'same-driver',
          departureTime: new Date(2030, 4, 10, 22).toISOString(),
          driver: { name: 'Gabriela Silva', ratingAverage: 4.9 },
        },
      ],
    });
    http.verify();
  });

  it('agrupa mudanças rápidas, ignora filtros equivalentes e cancela a consulta anterior', async () => {
    const http = TestBed.inject(HttpTestingController);
    const { criteria, result } = await startSearch(http);

    TestBed.tick();
    vi.advanceTimersByTime(debounceMs - 1);
    http.expectNone(ridesUrl);
    criteria.set({ ...filters, origin: 'Batel' });
    TestBed.tick();
    vi.advanceTimersByTime(debounceMs - 1);
    http.expectNone(ridesUrl);

    vi.advanceTimersByTime(1);
    const first = http.expectOne((request) => request.url === ridesUrl);
    expect(first.request.params.get('origin')).toBe('ilike.*batel*');

    criteria.set({ ...filters, origin: '  BATEL ' });
    runDebounce();
    http.expectNone(ridesUrl);
    expect(first.cancelled).toBe(false);

    criteria.set({ ...filters, origin: 'Portão' });
    expect(result()).toEqual({ status: 'loading' });
    runDebounce();
    const second = http.expectOne((request) => request.url === ridesUrl);
    expect(second.request.params.get('origin')).toBe('ilike.*portão*');
    expect(first.cancelled).toBe(true);
    second.flush([]);

    http.expectNone(driverSummariesRpcUrl);
    expect(result()).toEqual({ status: 'loaded', rides: [] });
    http.verify();
  });

  it('oculta a resposta anterior durante a espera e aceita novas buscas após falha', async () => {
    const http = TestBed.inject(HttpTestingController);
    const { criteria, result } = await startSearch(http);

    runDebounce();
    const first = http.expectOne((request) => request.url === ridesUrl);
    criteria.set({ ...filters, origin: 'Batel' });
    first.flush([]);
    expect(result()).toEqual({ status: 'loading' });

    runDebounce();
    http.expectOne((request) => request.url === ridesUrl).error(new ProgressEvent('error'));
    expect(result()).toEqual({ status: 'error', connectionError: true });

    criteria.set({ ...filters, origin: 'Portão' });
    expect(result()).toEqual({ status: 'loading' });
    runDebounce();
    http.expectOne((request) => request.url === ridesUrl).flush([]);
    expect(result()).toEqual({ status: 'loaded', rides: [] });
    http.verify();
  });
});
