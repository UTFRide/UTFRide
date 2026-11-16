import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { Ride } from '../models/ride.model';
import { RideRequest } from '../models/ride-request.model';
import { AuthData } from './auth-data';
import { RideData } from './ride-data';
import { RideRequestData } from './ride-request-data';

function authenticateDriver(http: HttpTestingController): void {
  const auth = TestBed.inject(AuthData);
  auth.login('motorista@alunos.utfpr.edu.br', 'senha123');
  http.expectOne((request) => request.url === `${environment.apiUrl}/users`).flush([
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
    },
  ]);
}

describe('RideRequestData', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('aceita e rejeita solicitações individualmente antes da viagem, ocupa vagas, esgota a oferta na última vaga mantendo pendentes e bloqueia novos aceites', () => {
    const rideData = TestBed.inject(RideData);
    const requestData = TestBed.inject(RideRequestData);
    const http = TestBed.inject(HttpTestingController);
    authenticateDriver(http);

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

  it('impede que uma oferta esgotada aceite novos pedidos', () => {
    const requestData = TestBed.inject(RideRequestData);
    const http = TestBed.inject(HttpTestingController);

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

    requestData.createRequest(exhaustedRide, 'passenger-novo');
    http.expectNone(`${environment.apiUrl}/ride_requests`);
    expect(requestData.createResult()).toEqual({ rideFull: true });
    http.verify();
  });
});
