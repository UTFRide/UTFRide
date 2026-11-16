import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { Ride } from '../models/ride.model';
import { AuthData } from './auth-data';
import { RideData } from './ride-data';

function authenticateStudent(http: HttpTestingController, overrides: Record<string, unknown> = {}): void {
  const auth = TestBed.inject(AuthData);
  auth.login('motorista@alunos.utfpr.edu.br', 'senha123');
  http.expectOne((request) => request.url.endsWith('/users')).flush([
    {
      id: 'driver-1',
      name: 'Carlos Motorista',
      email: 'motorista@alunos.utfpr.edu.br',
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
});
