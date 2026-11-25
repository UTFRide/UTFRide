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
import { RideData } from './ride-data';
import { SUPABASE_AUTH_CLIENT, SupabaseAuthClient } from './supabase-client';

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
  http.expectOne((request) => request.url.endsWith('/users')).flush([
    {
      id: 'driver-1',
      name: 'Carlos Motorista',
      email,
      registrationNumber: '2020123',
      whatsapp: '41999998888',
      role: 'student',
      isBlocked: false,
      isEmailConfirmed: true,
      ratingAverage: 5,
      createdAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
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

  it('carrega a oferta por id com o resumo público e cancela a leitura anterior ao trocar o id', async () => {
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http);
    const id = signal('ride-old');
    const detail = TestBed.inject(RideData).loadRideDetail(id, TestBed.inject(Injector));
    expect(detail()).toEqual({ status: 'loading' });
    TestBed.tick();
    const oldRead = http.expectOne({ url: `${environment.apiUrl}/rides/ride-old`, method: 'GET' });

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
    http.expectOne({ url: `${environment.apiUrl}/rides/007`, method: 'GET' }).flush(ride);
    const summaries = http.expectOne(
      (request) => request.url === `${environment.apiUrl}/driver-summaries`,
    );
    expect(summaries.request.method).toBe('GET');
    expect(summaries.request.params.getAll('id')).toEqual(['driver-1']);
    expect(detail()).toEqual({ status: 'loading' });
    summaries.flush([{ id: 'driver-1', name: 'Carlos Motorista', ratingAverage: 5 }]);
    expect(detail()).toEqual({
      status: 'loaded',
      ride: { ...ride, driver: { name: 'Carlos Motorista', ratingAverage: 5 } },
    });

    id.set('ride-offline');
    expect(detail()).toEqual({ status: 'loading' });
    TestBed.tick();
    http
      .expectOne({ url: `${environment.apiUrl}/rides/ride-offline`, method: 'GET' })
      .error(new ProgressEvent('error'));
    expect(detail()).toEqual({ status: 'error', connectionError: true });
    http.verify();
  });

  it('publica uma oferta ativa vinculada ao aluno autenticado', async () => {
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

    const request = http.expectOne((req) => req.url === `${environment.apiUrl}/rides` && req.method === 'POST');
    expect(request.request.body).toEqual({
      driverId: 'driver-1',
      origin: 'Portão',
      destination: 'UTFPR - Sede Centro',
      departureTime,
      totalSeats: 3,
      availableSeats: 3,
      pricePerSeat: 0,
      status: 'active',
      notes: 'Em frente ao terminal',
      createdAt: expect.any(String),
    });

    const created: Ride = { id: 'ride-1', ...request.request.body };
    request.flush(created);

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

    http.expectNone(`${environment.apiUrl}/rides`);
    expect(rideData.publishResult()).toEqual({ unauthorized: true });
    http.verify();
  });

  it('carrega as ofertas do motorista autenticado e verifica se a oferta aceita novos pedidos', async () => {
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
        req.url === `${environment.apiUrl}/rides` &&
        req.method === 'GET' &&
        req.params.get('driverId') === 'driver-1',
    );
    request.flush([activeRide, fullRide]);

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
      .expectOne((req) => req.url === `${environment.apiUrl}/rides` && req.params.get('driverId') === 'driver-1')
      .flush([existingRide]);

    rideData.startEditing(existingRide);
    expect(rideData.editingRide()).toEqual(existingRide);

    const newDeparture = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();

    // Deve rejeitar dados inválidos (origem vazia, vagas fora de 1..4, data passada)
    rideData.update(existingRide, {
      origin: '   ',
      destination: 'UTFPR - Sede Centro',
      departureTime: newDeparture,
      totalSeats: 3,
      pricePerSeat: 10,
    });
    http.expectNone(`${environment.apiUrl}/rides/ride-1`);
    expect(rideData.updateResult()).toEqual({ invalidData: true });

    rideData.update(existingRide, {
      origin: 'Cabral',
      destination: 'UTFPR - Sede Centro',
      departureTime: newDeparture,
      totalSeats: 5,
      pricePerSeat: 10,
    });
    http.expectNone(`${environment.apiUrl}/rides/ride-1`);
    expect(rideData.updateResult()).toEqual({ invalidData: true });

    rideData.update(existingRide, {
      origin: 'Cabral',
      destination: 'UTFPR - Sede Centro',
      departureTime: new Date(Date.now() - 60 * 1000).toISOString(),
      totalSeats: 3,
      pricePerSeat: 10,
    });
    http.expectNone(`${environment.apiUrl}/rides/ride-1`);
    expect(rideData.updateResult()).toEqual({ invalidData: true });

    // Deve salvar dados válidos antes da viagem
    rideData.update(existingRide, {
      origin: 'Cabral',
      destination: 'UTFPR - Sede Centro',
      departureTime: newDeparture,
      totalSeats: 4,
      pricePerSeat: 12,
      notes: 'Em frente ao terminal do Cabral',
    });

    const patchReq = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'PATCH',
    );
    expect(patchReq.request.body).toEqual({
      origin: 'Cabral',
      destination: 'UTFPR - Sede Centro',
      departureTime: newDeparture,
      totalSeats: 4,
      availableSeats: 4,
      pricePerSeat: 12,
      status: 'active',
      notes: 'Em frente ao terminal do Cabral',
    });

    const updatedRide: Ride = {
      ...existingRide,
      ...patchReq.request.body,
    };
    patchReq.flush(updatedRide);

    expect(rideData.updateResult()).toEqual({ ride: updatedRide });
    expect(rideData.driverRides()[0]).toEqual(updatedRide);
    http.verify();
  });

  it('restringe edição de oferta com passageiros confirmados antes da viagem: bloqueia alterações de trajeto, data, horário, valor e redução de vagas; permite aumento dentro dos limites e retorna oferta esgotada para ativa', async () => {
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
      .expectOne((req) => req.url === `${environment.apiUrl}/rides` && req.params.get('driverId') === 'driver-1')
      .flush([fullRideWithPassengers]);

    // 1. Bloqueia alteração de origem
    rideData.update(fullRideWithPassengers, {
      origin: 'Cabral',
      destination: 'UTFPR Neoville',
      departureTime: initialDeparture,
      totalSeats: 3,
      pricePerSeat: 9,
      notes: 'Saída pontual',
    });
    http.expectNone(`${environment.apiUrl}/rides/ride-1`);
    expect(rideData.updateResult()).toEqual({ invalidData: true });

    // 2. Bloqueia alteração de destino
    rideData.update(fullRideWithPassengers, {
      origin: 'Batel',
      destination: 'UTFPR - Sede Centro',
      departureTime: initialDeparture,
      totalSeats: 3,
      pricePerSeat: 9,
      notes: 'Saída pontual',
    });
    http.expectNone(`${environment.apiUrl}/rides/ride-1`);
    expect(rideData.updateResult()).toEqual({ invalidData: true });

    // 3. Bloqueia alteração de data/horário
    rideData.update(fullRideWithPassengers, {
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
      totalSeats: 3,
      pricePerSeat: 9,
      notes: 'Saída pontual',
    });
    http.expectNone(`${environment.apiUrl}/rides/ride-1`);
    expect(rideData.updateResult()).toEqual({ invalidData: true });

    // 4. Bloqueia alteração de valor
    rideData.update(fullRideWithPassengers, {
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: initialDeparture,
      totalSeats: 3,
      pricePerSeat: 12,
      notes: 'Saída pontual',
    });
    http.expectNone(`${environment.apiUrl}/rides/ride-1`);
    expect(rideData.updateResult()).toEqual({ invalidData: true });

    // 5. Bloqueia redução de vagas
    rideData.update(fullRideWithPassengers, {
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: initialDeparture,
      totalSeats: 1,
      pricePerSeat: 9,
      notes: 'Saída pontual',
    });
    http.expectNone(`${environment.apiUrl}/rides/ride-1`);
    expect(rideData.updateResult()).toEqual({ invalidData: true });

    // 6. Bloqueia aumento acima do limite permitido (4)
    rideData.update(fullRideWithPassengers, {
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: initialDeparture,
      totalSeats: 5,
      pricePerSeat: 9,
      notes: 'Saída pontual',
    });
    http.expectNone(`${environment.apiUrl}/rides/ride-1`);
    expect(rideData.updateResult()).toEqual({ invalidData: true });

    // 7. Permite aumento dentro dos limites (2 -> 3) e retorna oferta esgotada para ativa com 1 vaga disponível
    rideData.update(fullRideWithPassengers, {
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: initialDeparture,
      totalSeats: 3,
      pricePerSeat: 9,
      notes: 'Saída pontual',
    });

    const patchReq = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'PATCH',
    );
    expect(patchReq.request.body).toEqual({
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: initialDeparture,
      totalSeats: 3,
      availableSeats: 1,
      pricePerSeat: 9,
      status: 'active',
      notes: 'Saída pontual',
    });

    const reopenedRide: Ride = {
      ...fullRideWithPassengers,
      ...patchReq.request.body,
    };
    patchReq.flush(reopenedRide);

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
      .expectOne((req) => req.url === `${environment.apiUrl}/rides` && req.params.get('driverId') === 'driver-1')
      .flush([activeRide]);

    const cancelPromise = firstValueFrom(rideData.cancel$(activeRide));
    const patchReq = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'PATCH',
    );
    expect(patchReq.request.body).toEqual({ status: 'cancelled' });
    const updated: Ride = { ...activeRide, status: 'cancelled' };
    patchReq.flush(updated);

    const result = await cancelPromise;
    expect(result).toEqual(updated);
    expect(rideData.driverRides()[0]).toEqual(updated);
    expect(rideData.canCancel(updated)).toBe(false);
    http.verify();
  });

  it('impede que aluno bloqueado publique oferta (canOffer false e não dispara POST /rides)', async () => {
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

    http.expectNone(`${environment.apiUrl}/rides`);
    expect(rideData.publishResult()).toEqual({ unauthorized: true });
    http.verify();
  });

  it('impede que perfil de suporte publique oferta (canOffer false e não dispara POST /rides)', async () => {
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

    http.expectNone(`${environment.apiUrl}/rides`);
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
      .expectOne((req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'GET')
      .flush(rideFromDriver1);
    expect(rideData.editingRide()).toBeNull();
    expect(rideData.editRideLoadResult()).toEqual({ unauthorized: true });

    rideData.update(rideFromDriver1, {
      origin: 'Cabral',
      destination: 'UTFPR - Sede Centro',
      departureTime: futureDeparture,
      totalSeats: 3,
      pricePerSeat: 10,
    });
    http.expectNone(`${environment.apiUrl}/rides/ride-1`);
    expect(rideData.updateResult()).toEqual({ unauthorized: true });

    await expect(firstValueFrom(rideData.cancel$(rideFromDriver1))).rejects.toThrow();
    await expect(firstValueFrom(rideData.occupySeat$(rideFromDriver1))).rejects.toThrow();
    http.expectNone(`${environment.apiUrl}/rides/ride-1`);

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
    http.expectNone(`${environment.apiUrl}/rides/ride-1`);
    expect(rideData.editRideLoadResult()).toEqual({ unauthorized: true });

    rideData.loadDriverRides();
    http.expectNone(`${environment.apiUrl}/rides`);
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
    http.expectNone(`${environment.apiUrl}/rides/ride-1`);
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
      .expectOne((req) => req.url === `${environment.apiUrl}/rides` && req.params.get('driverId') === 'driver-1')
      .flush([ownRide, foreignRide]);

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
    http.expectNone(`${environment.apiUrl}/rides`);
    expect(rideData.driverRidesResult()).toEqual({ unauthorized: true });

    rideData.loadRideForEdit('ride-1');
    http.expectNone(`${environment.apiUrl}/rides/ride-1`);
    expect(rideData.editRideLoadResult()).toEqual({ unauthorized: true });

    rideData.publish({
      origin: 'Portão',
      destination: 'UTFPR - Sede Centro',
      departureTime: futureDeparture,
      totalSeats: 2,
      pricePerSeat: 8,
    });
    http.expectNone(`${environment.apiUrl}/rides`);
    expect(rideData.publishResult()).toEqual({ unauthorized: true });

    rideData.update(ownRide, {
      origin: 'Cabral',
      destination: 'UTFPR - Sede Centro',
      departureTime: futureDeparture,
      totalSeats: 3,
      pricePerSeat: 10,
    });
    http.expectNone(`${environment.apiUrl}/rides/ride-1`);
    expect(rideData.updateResult()).toEqual({ unauthorized: true });

    await expect(firstValueFrom(rideData.cancel$(ownRide))).rejects.toThrow();
    await expect(firstValueFrom(rideData.occupySeat$(ownRide))).rejects.toThrow();
    http.expectNone(`${environment.apiUrl}/rides/ride-1`);

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

    // 1. Falha de conexão ao publicar + nova tentativa
    rideData.publish(draft);
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides` && req.method === 'POST')
      .error(new ProgressEvent('error'));

    expect(rideData.publishResult()).toEqual({ connectionError: true });
    expect(errorNotice.message()).toContain('Falha de conexão');

    rideData.publish(draft);
    expect(errorNotice.message()).toBe('');
    const retryPublish = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/rides` && req.method === 'POST',
    );
    const createdRide: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      availableSeats: 3,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      ...draft,
    };
    retryPublish.flush(createdRide);
    expect(rideData.publishResult()).toEqual({ ride: createdRide });

    // 2. Falha de conexão ao listar ofertas do motorista + nova tentativa
    rideData.loadDriverRides();
    http
      .expectOne(
        (req) =>
          req.url === `${environment.apiUrl}/rides` &&
          req.method === 'GET' &&
          req.params.get('driverId') === 'driver-1',
      )
      .error(new ProgressEvent('error'));

    expect(rideData.driverRidesResult()).toEqual({ connectionError: true });
    expect(errorNotice.message()).toContain('Falha de conexão');

    rideData.loadDriverRides();
    expect(errorNotice.message()).toBe('');
    http
      .expectOne(
        (req) =>
          req.url === `${environment.apiUrl}/rides` &&
          req.method === 'GET' &&
          req.params.get('driverId') === 'driver-1',
      )
      .flush([createdRide]);
    expect(rideData.driverRides()).toEqual([createdRide]);
    expect(rideData.driverRidesResult()).toEqual({ rides: [createdRide] });

    // 3. Falha de conexão ao carregar oferta para edição + nova tentativa
    rideData.loadRideForEdit('ride-1');
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'GET')
      .error(new ProgressEvent('error'));

    expect(rideData.editRideLoadResult()).toEqual({ connectionError: true });
    expect(rideData.editingRide()).toBeNull();
    expect(errorNotice.message()).toContain('Falha de conexão');

    rideData.loadRideForEdit('ride-1');
    expect(errorNotice.message()).toBe('');
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'GET')
      .flush(createdRide);
    expect(rideData.editRideLoadResult()).toEqual({ ride: createdRide });
    expect(rideData.editingRide()).toEqual(createdRide);

    // 4. Falha de conexão ao editar oferta + preservação do estado + nova tentativa
    const updatedDraft = {
      ...draft,
      origin: 'Água Verde',
      totalSeats: 4,
      pricePerSeat: 10,
    };
    rideData.update(createdRide, updatedDraft);
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'PATCH')
      .error(new ProgressEvent('error'));

    expect(rideData.updateResult()).toEqual({ connectionError: true });
    expect(errorNotice.message()).toContain('Falha de conexão');
    expect(rideData.editingRide()).toEqual(createdRide);
    expect(rideData.driverRides()[0]).toEqual(createdRide);

    rideData.update(createdRide, updatedDraft);
    expect(errorNotice.message()).toBe('');
    const retryUpdate = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'PATCH',
    );
    const updatedRide: Ride = {
      ...createdRide,
      ...updatedDraft,
      availableSeats: 4,
    };
    retryUpdate.flush(updatedRide);
    expect(rideData.updateResult()).toEqual({ ride: updatedRide });
    expect(rideData.editingRide()).toEqual(updatedRide);
    expect(rideData.driverRides()[0]).toEqual(updatedRide);

    http.verify();
  });
});

describe('Busca de ofertas em RideData (CA1)', () => {
  const ridesUrl = `${environment.apiUrl}/rides`;
  const usersUrl = `${environment.apiUrl}/users`;
  const driverSummariesUrl = `${environment.apiUrl}/driver-summaries`;
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

  it('aplica os três filtros e enriquece apenas as ofertas elegíveis com dados públicos do motorista', async () => {
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
    expect(ridesRequest.request.params.get('_where')).toContain('"contains":"são josé"');
    expect(ridesRequest.request.params.get('_where')).toContain('"contains":"sede centro"');
    ridesRequest.flush([
      eligible,
      another,
      { ...eligible, id: 'same-driver', departureTime: new Date(2030, 4, 10, 22).toISOString() },
      { ...eligible, id: 'full', status: 'full' },
      { ...eligible, id: 'cancelled', status: 'cancelled' },
      { ...eligible, id: 'completed', status: 'completed' },
      { ...eligible, id: 'zero-seats', status: 'active', availableSeats: 0 },
      { ...eligible, id: 'passed', departureTime: new Date(2030, 4, 9, 17).toISOString() },
      { ...eligible, id: 'own', driverId: 'driver-1' },
      { ...eligible, id: 'wrong-origin', origin: 'Pinhais' },
      { ...eligible, id: 'wrong-destination', destination: 'UTFPR Neoville' },
      { ...eligible, id: 'wrong-date', departureTime: new Date(2030, 4, 11, 0).toISOString() },
    ]);

    http.expectNone((request) => request.url === usersUrl);
    const driversRequest = http.expectOne(
      (request) => request.url === driverSummariesUrl && request.method === 'GET',
    );
    expect(driversRequest.request.params.getAll('id')).toEqual(['007', 'driver-3']);
    expect(result()).toEqual({ status: 'loading' });
    driversRequest.flush([
      { id: '007', name: 'Gabriela Silva', ratingAverage: 4.9 },
      { id: 'driver-3', name: 'Camila Rocha', ratingAverage: 4.8 },
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
    http.expectNone((request) => request.url === ridesUrl);
    criteria.set({ ...filters, origin: 'Batel' });
    TestBed.tick();
    vi.advanceTimersByTime(debounceMs - 1);
    http.expectNone((request) => request.url === ridesUrl);

    vi.advanceTimersByTime(1);
    const first = http.expectOne((request) => request.url === ridesUrl);
    expect(first.request.params.get('_where')).toContain('"contains":"batel"');

    criteria.set({ ...filters, origin: '  BATEL ' });
    runDebounce();
    http.expectNone((request) => request.url === ridesUrl);
    expect(first.cancelled).toBe(false);

    criteria.set({ ...filters, origin: 'Portão' });
    expect(result()).toEqual({ status: 'loading' });
    runDebounce();
    const second = http.expectOne((request) => request.url === ridesUrl);
    expect(second.request.params.get('_where')).toContain('"contains":"portão"');
    expect(first.cancelled).toBe(true);
    second.flush([]);

    http.expectNone((request) => request.url === driverSummariesUrl);
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
