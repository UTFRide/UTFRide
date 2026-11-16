import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it } from 'vitest';
import { environment } from '../../../../environments/environment';
import { routes } from '../../../app.routes';
import { Notification } from '../../../core/models/notification.model';
import { Ride } from '../../../core/models/ride.model';
import { RideRequest } from '../../../core/models/ride-request.model';
import { AuthData } from '../../../core/services/auth-data';
import { RideRequestData } from '../../../core/services/ride-request-data';

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

describe('Minhas Ofertas e Gerenciar Solicitações (MyRides)', () => {
  it('redireciona visitante não autenticado para /login', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    await RouterTestingHarness.create('/driver/my-rides');
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('permite aceitar e rejeitar solicitações individualmente antes da viagem, atualiza vagas e status para esgotada, mantém pendentes e impede novos aceites e novos pedidos sem vaga', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const requestData = TestBed.inject(RideRequestData);
    authenticateDriver(http);

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
    requestData.createRequest(updatedFullRide, 'Novo Passageiro');
    http.expectNone(`${environment.apiUrl}/ride_requests`);
    expect(requestData.createResult()).toEqual({ rideFull: true });

    http.verify();
  });

  it('permite iniciar a edição de uma oferta sem passageiros confirmados antes da viagem a partir de Minhas Ofertas', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
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
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    authenticateDriver(http);

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
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const requestData = TestBed.inject(RideRequestData);
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
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
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
});
