import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { Ride } from '../models/ride.model';
import { AuthData } from './auth-data';
import { RideData } from './ride-data';

function authenticateStudent(http: HttpTestingController, overrides: Record<string, unknown> = {}): void {
  const auth = TestBed.inject(AuthData);
  const email = (overrides['email'] as string | undefined) ?? 'motorista@alunos.utfpr.edu.br';
  auth.login(email, 'senha123');
  http.expectOne((request) => request.url.endsWith('/users')).flush([
    {
      id: 'driver-1',
      name: 'Carlos Motorista',
      email,
      password: 'senha123',
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
}

describe('RideData', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('publica uma oferta ativa vinculada ao aluno autenticado', () => {
    const rideData = TestBed.inject(RideData);
    const http = TestBed.inject(HttpTestingController);
    authenticateStudent(http);

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

  it('carrega as ofertas do motorista autenticado e verifica se a oferta aceita novos pedidos', () => {
    const rideData = TestBed.inject(RideData);
    const http = TestBed.inject(HttpTestingController);
    authenticateStudent(http);

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

  it('atualiza uma oferta sem passageiros confirmados antes da viagem e valida novamente campos obrigatórios, vagas e data futura', () => {
    const rideData = TestBed.inject(RideData);
    const http = TestBed.inject(HttpTestingController);
    authenticateStudent(http);

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

  it('restringe edição de oferta com passageiros confirmados antes da viagem: bloqueia alterações de trajeto, data, horário, valor e redução de vagas; permite aumento dentro dos limites e retorna oferta esgotada para ativa', () => {
    const rideData = TestBed.inject(RideData);
    const http = TestBed.inject(HttpTestingController);
    authenticateStudent(http);

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
    authenticateStudent(http);

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

  it('impede que aluno bloqueado publique oferta (canOffer false e não dispara POST /rides)', () => {
    const rideData = TestBed.inject(RideData);
    const authData = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);
    authenticateStudent(http);

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

  it('impede que perfil de suporte publique oferta (canOffer false e não dispara POST /rides)', () => {
    const rideData = TestBed.inject(RideData);
    const http = TestBed.inject(HttpTestingController);
    authenticateStudent(http, {
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
    authenticateStudent(http, { id: 'driver-2', email: 'outro@alunos.utfpr.edu.br' });

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
    authenticateStudent(http);

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

  it('filtra em loadDriverRides ofertas que não pertencem ao motorista autenticado', () => {
    const rideData = TestBed.inject(RideData);
    const http = TestBed.inject(HttpTestingController);
    authenticateStudent(http);

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
    authenticateStudent(http);

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
});
