import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it } from 'vitest';
import { environment } from '../../../../environments/environment';
import { routes } from '../../../app.routes';
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
});
