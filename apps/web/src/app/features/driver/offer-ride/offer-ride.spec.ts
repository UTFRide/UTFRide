import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../../environments/environment';
import { routes } from '../../../app.routes';
import { Ride } from '../../../core/models/ride.model';
import { AuthData } from '../../../core/services/auth-data';
import { RideData } from '../../../core/services/ride-data';

function authenticateStudent(http: HttpTestingController): void {
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

function setField(root: HTMLElement, controlName: string, value: string): void {
  const input = root.querySelector<HTMLInputElement>(`[formControlName="${controlName}"]`);
  expect(input).not.toBeNull();
  input!.value = value;
  input!.dispatchEvent(new Event('input', { bubbles: true }));
  input!.dispatchEvent(new Event('blur', { bubbles: true }));
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLocalTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

describe('Publicação de oferta de carona (OfferRide)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('redireciona visitante não autenticado para /login', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    await RouterTestingHarness.create('/driver/offer');
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('publica uma oferta ativa para o aluno autenticado e exibe aviso de responsabilidade pela capacidade do veículo', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 16, 10, 0, 0));

    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    authenticateStudent(http);

    const harness = await RouterTestingHarness.create('/driver/offer');
    const root = harness.routeNativeElement as HTMLElement;

    expect(root.textContent).toContain('capacidade do veículo');

    setField(root, 'origin', 'Praça do Japão');
    setField(root, 'destination', 'UTFPR - Sede Centro');
    setField(root, 'notes', 'Próximo à parada de ônibus');

    const future = new Date(2026, 10, 17, 7, 30, 0);
    setField(root, 'departureDate', formatLocalDate(future));
    setField(root, 'departureTime', formatLocalTime(future));

    const seatButton = root.querySelector<HTMLButtonElement>('[data-testid="seat-option-2"]');
    expect(seatButton).not.toBeNull();
    seatButton!.click();

    setField(root, 'pricePerSeat', '0');
    await harness.fixture.whenStable();

    const submitButton = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submitButton.disabled).toBe(false);
    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    const request = http.expectOne((req) => req.url === `${environment.apiUrl}/rides` && req.method === 'POST');
    expect(request.request.body).toEqual({
      driverId: 'driver-1',
      origin: 'Praça do Japão',
      destination: 'UTFPR - Sede Centro',
      departureTime: future.toISOString(),
      totalSeats: 2,
      availableSeats: 2,
      pricePerSeat: 0,
      status: 'active',
      notes: 'Próximo à parada de ônibus',
      createdAt: expect.any(String),
    });

    request.flush({ id: 'ride-1', ...request.request.body });
    await harness.fixture.whenStable();

    expect(root.textContent).toContain('Carona Publicada!');
    expect(root.textContent).toContain('2 vagas');
    expect(root.textContent).toContain('R$ 0,00');
    expect(root.textContent).toContain('Ativa');
    http.verify();
  });

  it('bloqueia o envio e aponta erros para campos obrigatórios vazios, vagas fora de 1 a 4 e valor negativo', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    authenticateStudent(http);

    const harness = await RouterTestingHarness.create('/driver/offer');
    const root = harness.routeNativeElement as HTMLElement;

    setField(root, 'origin', '');
    setField(root, 'destination', '');
    setField(root, 'departureDate', '');
    setField(root, 'departureTime', '');
    setField(root, 'totalSeats', '5');
    setField(root, 'pricePerSeat', '-1');
    await harness.fixture.whenStable();

    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await harness.fixture.whenStable();

    http.expectNone(`${environment.apiUrl}/rides`);
    const alertsText = Array.from(root.querySelectorAll('[role="alert"]'))
      .map((el) => el.textContent ?? '')
      .join(' ');
    expect(alertsText).toContain('origem');
    expect(alertsText).toContain('destino');
    expect(alertsText).toContain('1 e 4');
    expect(alertsText).toContain('maior ou igual a zero');

    setField(root, 'totalSeats', '0');
    await harness.fixture.whenStable();
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    http.verify();
  });

  it('rejeita data e horário que não são futuros no momento de salvar', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 16, 10, 0, 0));

    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    authenticateStudent(http);

    const harness = await RouterTestingHarness.create('/driver/offer');
    const root = harness.routeNativeElement as HTMLElement;

    setField(root, 'origin', 'Portão');
    setField(root, 'destination', 'UTFPR - Sede Centro');

    const initiallyFuture = new Date(2026, 10, 16, 10, 5, 0);
    setField(root, 'departureDate', formatLocalDate(initiallyFuture));
    setField(root, 'departureTime', formatLocalTime(initiallyFuture));
    setField(root, 'pricePerSeat', '8');
    await harness.fixture.whenStable();

    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);

    // Tempo avança até depois do horário escolhido antes de o aluno clicar em salvar
    vi.setSystemTime(new Date(2026, 10, 16, 10, 6, 0));
    root.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await harness.fixture.whenStable();

    http.expectNone(`${environment.apiUrl}/rides`);
    const alertsText = Array.from(root.querySelectorAll('[role="alert"]'))
      .map((el) => el.textContent ?? '')
      .join(' ');
    expect(alertsText).toContain('Data e horário inválidos');
    http.verify();
  });

  it('permite ao autor editar os campos de uma oferta sem passageiros confirmados antes da viagem e valida novamente campos obrigatórios, vagas e data futura', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 16, 10, 0, 0));

    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const rideData = TestBed.inject(RideData);
    authenticateStudent(http);

    const initialDeparture = new Date(2026, 10, 17, 7, 30, 0);
    const existingRide: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: initialDeparture.toISOString(),
      totalSeats: 2,
      availableSeats: 2,
      pricePerSeat: 9,
      status: 'active',
      notes: 'Próximo ao shopping',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    rideData.startEditing(existingRide);

    const harness = await RouterTestingHarness.create('/driver/offer?rideId=ride-1');
    const root = harness.routeNativeElement as HTMLElement;

    expect(root.querySelector<HTMLInputElement>('[formControlName="origin"]')!.value).toBe('Batel');
    expect(root.querySelector<HTMLInputElement>('[formControlName="destination"]')!.value).toBe(
      'UTFPR Neoville',
    );
    expect(root.querySelector<HTMLInputElement>('[formControlName="notes"]')!.value).toBe(
      'Próximo ao shopping',
    );
    expect(root.querySelector<HTMLInputElement>('[formControlName="totalSeats"]')!.value).toBe('2');
    expect(root.querySelector<HTMLInputElement>('[formControlName="pricePerSeat"]')!.value).toBe('9');

    // 1. Validar novamente campos obrigatórios, vagas fora do limite e data não futura na edição
    setField(root, 'origin', '');
    setField(root, 'destination', '');
    setField(root, 'totalSeats', '5');
    const pastDate = new Date(2026, 10, 16, 9, 30, 0);
    setField(root, 'departureDate', formatLocalDate(pastDate));
    setField(root, 'departureTime', formatLocalTime(pastDate));
    await harness.fixture.whenStable();

    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await harness.fixture.whenStable();

    http.expectNone(`${environment.apiUrl}/rides/ride-1`);
    const alertsText = Array.from(root.querySelectorAll('[role="alert"]'))
      .map((el) => el.textContent ?? '')
      .join(' ');
    expect(alertsText).toContain('origem');
    expect(alertsText).toContain('destino');
    expect(alertsText).toContain('1 e 4');
    expect(alertsText).toContain('Data e horário inválidos');

    // 2. Preencher dados válidos e salvar edição antes da viagem
    const updatedDeparture = new Date(2026, 10, 18, 8, 15, 0);
    setField(root, 'origin', 'Água Verde');
    setField(root, 'destination', 'UTFPR - Sede Ecoville');
    setField(root, 'notes', 'Saída em frente à praça');
    setField(root, 'departureDate', formatLocalDate(updatedDeparture));
    setField(root, 'departureTime', formatLocalTime(updatedDeparture));
    root.querySelector<HTMLButtonElement>('[data-testid="seat-option-4"]')!.click();
    setField(root, 'pricePerSeat', '11');
    await harness.fixture.whenStable();

    const submitButton = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submitButton.disabled).toBe(false);
    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    const patchReq = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'PATCH',
    );
    expect(patchReq.request.body).toEqual({
      origin: 'Água Verde',
      destination: 'UTFPR - Sede Ecoville',
      departureTime: updatedDeparture.toISOString(),
      totalSeats: 4,
      availableSeats: 4,
      pricePerSeat: 11,
      status: 'active',
      notes: 'Saída em frente à praça',
    });

    patchReq.flush({ ...existingRide, ...patchReq.request.body });
    await harness.fixture.whenStable();

    expect(root.textContent).toContain('Oferta Atualizada!');
    expect(root.textContent).toContain('4 vagas');
    expect(root.textContent).toContain('R$ 11,00');
    http.verify();
  });
});
