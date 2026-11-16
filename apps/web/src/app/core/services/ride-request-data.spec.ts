import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { Notification } from '../models/notification.model';
import { Ride } from '../models/ride.model';
import { RideRequest } from '../models/ride-request.model';
import { AuthData } from './auth-data';
import { NotificationData } from './notification-data';
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

  it('cancela a oferta antes da viagem, altera apenas pedidos pendentes para cancelados e registra um aviso interno para cada passageiro confirmado ou anteriormente pendente', () => {
    const rideData = TestBed.inject(RideData);
    const requestData = TestBed.inject(RideRequestData);
    const notificationData = TestBed.inject(NotificationData);
    const http = TestBed.inject(HttpTestingController);
    authenticateDriver(http);

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

  it('impede o cancelamento quando a viagem já ocorreu ou a oferta já está cancelada/concluída', () => {
    const requestData = TestBed.inject(RideRequestData);
    const http = TestBed.inject(HttpTestingController);
    authenticateDriver(http);

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

  it('cancela oferta sem pendentes nem confirmados sem alterar rejeitados e sem criar avisos', () => {
    const requestData = TestBed.inject(RideRequestData);
    const notificationData = TestBed.inject(NotificationData);
    const http = TestBed.inject(HttpTestingController);
    authenticateDriver(http);

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
});
