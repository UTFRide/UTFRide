import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../../environments/environment';
import { routes } from '../../../app.routes';
import { Ride } from '../../../core/models/ride.model';
import { AuthData } from '../../../core/services/auth-data';
import { RideData } from '../../../core/services/ride-data';
import { SUPABASE_AUTH_CLIENT, SupabaseAuthClient } from '../../../core/services/supabase-client';

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

async function authenticateStudent(http: HttpTestingController): Promise<void> {
  const auth = TestBed.inject(AuthData);
  auth.login('motorista@alunos.utfpr.edu.br', 'senha123');
  await flushMicrotasks();
  http.expectOne((request) => request.url === `${environment.apiUrl}/users`).flush([
    {
      id: 'driver-1',
      name: 'Carlos Motorista',
      email: 'motorista@alunos.utfpr.edu.br',
      registrationNumber: '2020123',
      whatsapp: '41999998888',
      role: 'student',
      isBlocked: false,
      isEmailConfirmed: true,
      ratingAverage: 5,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ]);
  await flushMicrotasks();
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
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    await RouterTestingHarness.create('/driver/offer');
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('publica uma oferta ativa para o aluno autenticado e exibe aviso de responsabilidade pela capacidade do veículo', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 16, 10, 0, 0));

    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http);

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
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http);

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
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http);

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
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const rideData = TestBed.inject(RideData);
    await authenticateStudent(http);

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

  it('restringe a edição quando há passageiros confirmados: bloqueia alterações de trajeto, data, horário, valor e redução de vagas, permite aumento dentro dos limites e retorna oferta esgotada ao status ativa', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 16, 10, 0, 0));

    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const rideData = TestBed.inject(RideData);
    await authenticateStudent(http);

    const initialDeparture = new Date(2026, 10, 17, 7, 30, 0);
    const fullRideWithPassengers: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: initialDeparture.toISOString(),
      totalSeats: 2,
      availableSeats: 0,
      pricePerSeat: 9,
      status: 'full',
      notes: 'Próximo ao shopping',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    rideData.startEditing(fullRideWithPassengers);

    const harness = await RouterTestingHarness.create('/driver/offer?rideId=ride-1');
    const root = harness.routeNativeElement as HTMLElement;

    const originInput = root.querySelector<HTMLInputElement>('[formControlName="origin"]')!;
    const destinationInput = root.querySelector<HTMLInputElement>('[formControlName="destination"]')!;
    const notesInput = root.querySelector<HTMLInputElement>('[formControlName="notes"]')!;
    const dateInput = root.querySelector<HTMLInputElement>('[formControlName="departureDate"]')!;
    const timeInput = root.querySelector<HTMLInputElement>('[formControlName="departureTime"]')!;
    const priceInput = root.querySelector<HTMLInputElement>('[formControlName="pricePerSeat"]')!;
    const seatBtn1 = root.querySelector<HTMLButtonElement>('[data-testid="seat-option-1"]')!;
    const seatBtn2 = root.querySelector<HTMLButtonElement>('[data-testid="seat-option-2"]')!;
    const seatBtn3 = root.querySelector<HTMLButtonElement>('[data-testid="seat-option-3"]')!;
    const seatBtn4 = root.querySelector<HTMLButtonElement>('[data-testid="seat-option-4"]')!;

    // 1. Campos de trajeto, data, horário e valor, além da opção de reduzir vagas (1 < 2), ficam bloqueados
    expect(originInput.disabled).toBe(true);
    expect(destinationInput.disabled).toBe(true);
    expect(notesInput.disabled).toBe(true);
    expect(dateInput.disabled).toBe(true);
    expect(timeInput.disabled).toBe(true);
    expect(priceInput.disabled).toBe(true);
    expect(seatBtn1.disabled).toBe(true);
    expect(seatBtn2.disabled).toBe(false);
    expect(seatBtn3.disabled).toBe(false);
    expect(seatBtn4.disabled).toBe(false);

    // 2. Tentativa de reduzir vagas pelo campo numérico ou exceder limite de 4 é bloqueada
    setField(root, 'totalSeats', '1');
    await harness.fixture.whenStable();

    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await harness.fixture.whenStable();
    http.expectNone(`${environment.apiUrl}/rides/ride-1`);

    const reductionAlerts = Array.from(root.querySelectorAll('[role="alert"]'))
      .map((el) => el.textContent ?? '')
      .join(' ');
    expect(reductionAlerts).toContain('reduzir');

    setField(root, 'totalSeats', '5');
    await harness.fixture.whenStable();
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    http.expectNone(`${environment.apiUrl}/rides/ride-1`);

    // 3. Aumentar vagas dentro do limite permitido (2 -> 3) disponibiliza 1 vaga e retorna oferta esgotada para ativa
    seatBtn3.click();
    await harness.fixture.whenStable();

    const submitButton = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submitButton.disabled).toBe(false);
    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    const patchReq = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'PATCH',
    );
    expect(patchReq.request.body).toEqual({
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: initialDeparture.toISOString(),
      totalSeats: 3,
      availableSeats: 1,
      pricePerSeat: 9,
      status: 'active',
      notes: 'Próximo ao shopping',
    });

    patchReq.flush({ ...fullRideWithPassengers, ...patchReq.request.body });
    await harness.fixture.whenStable();

    expect(root.textContent).toContain('Oferta Atualizada!');
    expect(root.textContent).toContain('3 vagas');
    expect(root.textContent).toContain('Ativa');
    http.verify();
  });

  it('impede que aluno bloqueado publique oferta, inclusive em tentativa direta de submit, e exibe alerta acessível', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 16, 10, 0, 0));

    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const authData = TestBed.inject(AuthData);
    const rideData = TestBed.inject(RideData);
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

    const harness = await RouterTestingHarness.create('/driver/offer');
    const root = harness.routeNativeElement as HTMLElement;

    const initialAlerts = Array.from(root.querySelectorAll('[role="alert"]'))
      .map((el) => el.textContent ?? '')
      .join(' ');
    expect(initialAlerts.toLowerCase()).toContain('bloquead');

    setField(root, 'origin', 'Portão');
    setField(root, 'destination', 'UTFPR - Sede Centro');
    const future = new Date(2026, 10, 17, 7, 30, 0);
    setField(root, 'departureDate', formatLocalDate(future));
    setField(root, 'departureTime', formatLocalTime(future));
    setField(root, 'pricePerSeat', '8');
    await harness.fixture.whenStable();

    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);

    // Tentativa direta (além do botão desabilitado)
    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await harness.fixture.whenStable();

    http.expectNone(`${environment.apiUrl}/rides`);
    expect(rideData.publishResult()).toEqual({ unauthorized: true });
    expect(root.textContent).not.toContain('Carona Publicada!');
    const alertsAfterSubmit = Array.from(root.querySelectorAll('[role="alert"]'))
      .map((el) => el.textContent ?? '')
      .join(' ');
    expect(alertsAfterSubmit.length).toBeGreaterThan(0);
    http.verify();
  });

  it('impede edição ao navegar para /driver/offer?rideId=... de oferta de outro aluno e exibe alerta acessível', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const rideData = TestBed.inject(RideData);
    await authenticateStudent(http); // driver-1

    const harness = await RouterTestingHarness.create('/driver/offer?rideId=ride-other');
    const root = harness.routeNativeElement as HTMLElement;

    const foreignRide: Ride = {
      id: 'ride-other',
      driverId: 'driver-2',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      totalSeats: 3,
      availableSeats: 2,
      pricePerSeat: 10,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides/ride-other` && req.method === 'GET')
      .flush(foreignRide);
    await harness.fixture.whenStable();

    expect(rideData.editingRide()).toBeNull();
    expect(rideData.editRideLoadResult()).toEqual({ unauthorized: true });
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);

    const alertsText = Array.from(root.querySelectorAll('[role="alert"]'))
      .map((el) => el.textContent ?? '')
      .join(' ');
    expect(alertsText).toContain('permissão');

    // Tentativa direta de submit não deve criar nova oferta nem editar a alheia
    setField(root, 'origin', 'Portão');
    setField(root, 'destination', 'UTFPR - Sede Centro');
    await harness.fixture.whenStable();
    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await harness.fixture.whenStable();

    http.expectNone(`${environment.apiUrl}/rides`);
    http.expectNone(`${environment.apiUrl}/rides/ride-other`);
    http.verify();
  });

  it('impede atualização quando o aluno deixa de ser o autor antes de salvar edição já aberta', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 16, 10, 0, 0));

    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const authData = TestBed.inject(AuthData);
    const rideData = TestBed.inject(RideData);
    await authenticateStudent(http);

    const existingRide: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: new Date(2026, 10, 17, 7, 30, 0).toISOString(),
      totalSeats: 3,
      availableSeats: 3,
      pricePerSeat: 9,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    rideData.startEditing(existingRide);

    const harness = await RouterTestingHarness.create('/driver/offer?rideId=ride-1');
    const root = harness.routeNativeElement as HTMLElement;

    authData.login('outro@alunos.utfpr.edu.br', 'senha123');
    await flushMicrotasks();
    http.expectOne((request) => request.url === `${environment.apiUrl}/users`).flush([
      {
        id: 'driver-2',
        name: 'Outro Aluno',
        email: 'outro@alunos.utfpr.edu.br',
        registrationNumber: '2020999',
        whatsapp: '41988887777',
        role: 'student',
        isBlocked: false,
        isEmailConfirmed: true,
        ratingAverage: 5,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    await flushMicrotasks();
    await harness.fixture.whenStable();

    setField(root, 'origin', 'Água Verde');
    await harness.fixture.whenStable();
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);

    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await harness.fixture.whenStable();

    http.expectNone(`${environment.apiUrl}/rides/ride-1`);
    expect(rideData.updateResult()).toEqual({ unauthorized: true });
    const alertsText = Array.from(root.querySelectorAll('[role="alert"]'))
      .map((el) => el.textContent ?? '')
      .join(' ');
    expect(alertsText.toLowerCase()).toContain('autor');
    http.verify();
  });

  it('informa falha de conexão ao publicar oferta, preserva os dados preenchidos enquanto a tela permanece aberta e permite nova tentativa', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 16, 10, 0, 0));

    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http);

    const harness = await RouterTestingHarness.create('/driver/offer');
    const root = harness.routeNativeElement as HTMLElement;

    const future = new Date(2026, 10, 17, 7, 30, 0);
    setField(root, 'origin', 'Praça do Japão');
    setField(root, 'destination', 'UTFPR - Sede Centro');
    setField(root, 'notes', 'Em frente à banca');
    setField(root, 'departureDate', formatLocalDate(future));
    setField(root, 'departureTime', formatLocalTime(future));
    root.querySelector<HTMLButtonElement>('[data-testid="seat-option-2"]')!.click();
    setField(root, 'pricePerSeat', '12');
    await harness.fixture.whenStable();

    const submit = () =>
      root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    submit();
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides` && req.method === 'POST')
      .error(new ProgressEvent('error'));
    await harness.fixture.whenStable();

    const alert = root.querySelector('[data-testid="offer-operation-error"]');
    expect(alert).not.toBeNull();
    expect(alert!.getAttribute('role')).toBe('alert');
    expect(alert!.textContent?.toLowerCase()).toContain('conexão');
    expect(root.textContent).not.toContain('Carona Publicada!');

    const submitButton = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submitButton.disabled).toBe(false);
    expect(submitButton.textContent).toContain('Publicar Oferta de Carona');

    // Dados preenchidos permanecem disponíveis na tela
    expect(root.querySelector<HTMLInputElement>('[formControlName="origin"]')!.value).toBe('Praça do Japão');
    expect(root.querySelector<HTMLInputElement>('[formControlName="destination"]')!.value).toBe(
      'UTFPR - Sede Centro',
    );
    expect(root.querySelector<HTMLInputElement>('[formControlName="notes"]')!.value).toBe('Em frente à banca');
    expect(root.querySelector<HTMLInputElement>('[formControlName="departureDate"]')!.value).toBe(
      formatLocalDate(future),
    );
    expect(root.querySelector<HTMLInputElement>('[formControlName="departureTime"]')!.value).toBe(
      formatLocalTime(future),
    );
    expect(root.querySelector<HTMLInputElement>('[formControlName="totalSeats"]')!.value).toBe('2');
    expect(root.querySelector<HTMLInputElement>('[formControlName="pricePerSeat"]')!.value).toBe('12');

    // Nova tentativa envia novamente os dados preservados
    submit();
    const retryReq = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/rides` && req.method === 'POST',
    );
    expect(retryReq.request.body).toEqual({
      driverId: 'driver-1',
      origin: 'Praça do Japão',
      destination: 'UTFPR - Sede Centro',
      departureTime: future.toISOString(),
      totalSeats: 2,
      availableSeats: 2,
      pricePerSeat: 12,
      status: 'active',
      notes: 'Em frente à banca',
      createdAt: expect.any(String),
    });
    retryReq.flush({ id: 'ride-1', ...retryReq.request.body });
    await harness.fixture.whenStable();

    expect(root.querySelector('[data-testid="offer-operation-error"]')).toBeNull();
    expect(root.textContent).toContain('Carona Publicada!');
    http.verify();
  });

  it('informa falha de conexão ao salvar edição da oferta, preserva as alterações preenchidas e permite nova tentativa', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 16, 10, 0, 0));

    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const rideData = TestBed.inject(RideData);
    await authenticateStudent(http);

    const existingRide: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: new Date(2026, 10, 17, 7, 30, 0).toISOString(),
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

    const updatedDeparture = new Date(2026, 10, 18, 8, 15, 0);
    setField(root, 'origin', 'Água Verde');
    setField(root, 'destination', 'UTFPR - Sede Ecoville');
    setField(root, 'notes', 'Saída em frente à praça');
    setField(root, 'departureDate', formatLocalDate(updatedDeparture));
    setField(root, 'departureTime', formatLocalTime(updatedDeparture));
    root.querySelector<HTMLButtonElement>('[data-testid="seat-option-4"]')!.click();
    setField(root, 'pricePerSeat', '11');
    await harness.fixture.whenStable();

    const submit = () =>
      root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    submit();
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'PATCH')
      .error(new ProgressEvent('error'));
    await harness.fixture.whenStable();

    const alert = root.querySelector('[data-testid="offer-operation-error"]');
    expect(alert).not.toBeNull();
    expect(alert!.getAttribute('role')).toBe('alert');
    expect(alert!.textContent?.toLowerCase()).toContain('conexão');
    expect(root.textContent).not.toContain('Oferta Atualizada!');

    const submitButton = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submitButton.disabled).toBe(false);
    expect(submitButton.textContent).toContain('Salvar Alterações');

    // Alterações permanecem no formulário
    expect(root.querySelector<HTMLInputElement>('[formControlName="origin"]')!.value).toBe('Água Verde');
    expect(root.querySelector<HTMLInputElement>('[formControlName="destination"]')!.value).toBe(
      'UTFPR - Sede Ecoville',
    );
    expect(root.querySelector<HTMLInputElement>('[formControlName="notes"]')!.value).toBe(
      'Saída em frente à praça',
    );
    expect(root.querySelector<HTMLInputElement>('[formControlName="totalSeats"]')!.value).toBe('4');
    expect(root.querySelector<HTMLInputElement>('[formControlName="pricePerSeat"]')!.value).toBe('11');

    // Nova tentativa salva alterações preservadas
    submit();
    const retryPatch = http.expectOne(
      (req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'PATCH',
    );
    expect(retryPatch.request.body).toEqual({
      origin: 'Água Verde',
      destination: 'UTFPR - Sede Ecoville',
      departureTime: updatedDeparture.toISOString(),
      totalSeats: 4,
      availableSeats: 4,
      pricePerSeat: 11,
      status: 'active',
      notes: 'Saída em frente à praça',
    });
    retryPatch.flush({ ...existingRide, ...retryPatch.request.body });
    await harness.fixture.whenStable();

    expect(root.querySelector('[data-testid="offer-operation-error"]')).toBeNull();
    expect(root.textContent).toContain('Oferta Atualizada!');
    http.verify();
  });

  it('informa falha de conexão ao carregar oferta para edição via rideId e permite tentar novamente', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 16, 10, 0, 0));

    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http);

    const harness = await RouterTestingHarness.create('/driver/offer?rideId=ride-1');
    const root = harness.routeNativeElement as HTMLElement;

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'GET')
      .error(new ProgressEvent('error'));
    await harness.fixture.whenStable();

    const loadErrorAlert = root.querySelector('[data-testid="edit-load-error"]');
    expect(loadErrorAlert).not.toBeNull();
    expect(loadErrorAlert!.getAttribute('role')).toBe('alert');
    expect(loadErrorAlert!.textContent?.toLowerCase()).toContain('conexão');
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);

    const retryBtn = root.querySelector<HTMLButtonElement>('[data-testid="retry-edit-load-button"]');
    expect(retryBtn).not.toBeNull();
    retryBtn!.click();

    const existingRide: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: new Date(2026, 10, 17, 7, 30, 0).toISOString(),
      totalSeats: 3,
      availableSeats: 3,
      pricePerSeat: 9,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'GET')
      .flush(existingRide);
    await harness.fixture.whenStable();

    expect(root.querySelector('[data-testid="edit-load-error"]')).toBeNull();
    expect(root.querySelector<HTMLInputElement>('[formControlName="origin"]')!.value).toBe('Batel');
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
    http.verify();
  });

  it('descarta preenchimento não salvo de nova oferta ao sair para outra rota e voltar para /driver/offer sem publicar', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 16, 10, 0, 0));

    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http);

    const harness = await RouterTestingHarness.create('/driver/offer');
    const root = harness.routeNativeElement as HTMLElement;

    const customDate = new Date(2026, 10, 19, 14, 45, 0);
    setField(root, 'origin', 'Portão');
    setField(root, 'destination', 'UTFPR - Sede Neoville');
    setField(root, 'notes', 'Em frente ao terminal');
    setField(root, 'departureDate', formatLocalDate(customDate));
    setField(root, 'departureTime', formatLocalTime(customDate));
    root.querySelector<HTMLButtonElement>('[data-testid="seat-option-1"]')!.click();
    setField(root, 'pricePerSeat', '15');
    await harness.fixture.whenStable();

    await harness.navigateByUrl('/rides');
    http.expectNone((req) => req.url.includes('/rides') && req.method === 'POST');

    await harness.navigateByUrl('/driver/offer');
    const returnedRoot = harness.routeNativeElement as HTMLElement;
    const defaultTomorrow = formatLocalDate(new Date(2026, 10, 17, 10, 0, 0));

    expect(returnedRoot.querySelector<HTMLInputElement>('[formControlName="origin"]')!.value).toBe('');
    expect(returnedRoot.querySelector<HTMLInputElement>('[formControlName="destination"]')!.value).toBe('');
    expect(returnedRoot.querySelector<HTMLInputElement>('[formControlName="notes"]')!.value).toBe('');
    expect(returnedRoot.querySelector<HTMLInputElement>('[formControlName="departureDate"]')!.value).toBe(
      defaultTomorrow,
    );
    expect(returnedRoot.querySelector<HTMLInputElement>('[formControlName="departureTime"]')!.value).toBe(
      '07:15',
    );
    expect(returnedRoot.querySelector<HTMLInputElement>('[formControlName="totalSeats"]')!.value).toBe('3');
    expect(returnedRoot.querySelector<HTMLInputElement>('[formControlName="pricePerSeat"]')!.value).toBe('8');
    expect(returnedRoot.textContent).not.toContain('Carona Publicada!');
    http.verify();
  });

  it('descarta alterações não salvas em modo de edição ao sair para outra rota e voltar para /driver/offer?rideId=...', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 16, 10, 0, 0));

    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http);

    const originalDeparture = new Date(2026, 10, 17, 7, 30, 0);
    const savedRide: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: originalDeparture.toISOString(),
      totalSeats: 2,
      availableSeats: 2,
      pricePerSeat: 9,
      status: 'active',
      notes: 'Próximo ao shopping',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const harness = await RouterTestingHarness.create('/driver/offer?rideId=ride-1');
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'GET')
      .flush(savedRide);
    await harness.fixture.whenStable();

    const root = harness.routeNativeElement as HTMLElement;
    const editedDeparture = new Date(2026, 10, 20, 9, 0, 0);
    setField(root, 'origin', 'Origem Descartada');
    setField(root, 'destination', 'Destino Descartado');
    setField(root, 'notes', 'Nota Descartada');
    setField(root, 'departureDate', formatLocalDate(editedDeparture));
    setField(root, 'departureTime', formatLocalTime(editedDeparture));
    root.querySelector<HTMLButtonElement>('[data-testid="seat-option-4"]')!.click();
    setField(root, 'pricePerSeat', '22');
    await harness.fixture.whenStable();

    await harness.navigateByUrl('/rides');
    http.expectNone((req) => req.method === 'PATCH' || req.method === 'POST');

    await harness.navigateByUrl('/driver/offer?rideId=ride-1');
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'GET')
      .flush(savedRide);
    await harness.fixture.whenStable();

    const returnedRoot = harness.routeNativeElement as HTMLElement;
    expect(returnedRoot.querySelector<HTMLInputElement>('[formControlName="origin"]')!.value).toBe('Batel');
    expect(returnedRoot.querySelector<HTMLInputElement>('[formControlName="destination"]')!.value).toBe(
      'UTFPR Neoville',
    );
    expect(returnedRoot.querySelector<HTMLInputElement>('[formControlName="notes"]')!.value).toBe(
      'Próximo ao shopping',
    );
    expect(returnedRoot.querySelector<HTMLInputElement>('[formControlName="departureDate"]')!.value).toBe(
      formatLocalDate(originalDeparture),
    );
    expect(returnedRoot.querySelector<HTMLInputElement>('[formControlName="departureTime"]')!.value).toBe(
      formatLocalTime(originalDeparture),
    );
    expect(returnedRoot.querySelector<HTMLInputElement>('[formControlName="totalSeats"]')!.value).toBe('2');
    expect(returnedRoot.querySelector<HTMLInputElement>('[formControlName="pricePerSeat"]')!.value).toBe('9');
    expect(returnedRoot.textContent).not.toContain('Oferta Atualizada!');
    http.verify();
  });

  it('descarta alterações não salvas e limpa estado residual ao navegar de /driver/offer?rideId=... para /driver/offer na mesma instância', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 16, 10, 0, 0));

    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const rideData = TestBed.inject(RideData);
    await authenticateStudent(http);

    const savedRideWithPassengers: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: new Date(2026, 10, 17, 7, 30, 0).toISOString(),
      totalSeats: 2,
      availableSeats: 1,
      pricePerSeat: 9,
      status: 'active',
      notes: 'Próximo ao shopping',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const harness = await RouterTestingHarness.create('/driver/offer?rideId=ride-1');
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'GET')
      .flush(savedRideWithPassengers);
    await harness.fixture.whenStable();

    const root = harness.routeNativeElement as HTMLElement;
    expect(root.querySelector<HTMLInputElement>('[formControlName="origin"]')!.disabled).toBe(true);
    root.querySelector<HTMLButtonElement>('[data-testid="seat-option-4"]')!.click();
    await harness.fixture.whenStable();
    expect(root.querySelector<HTMLInputElement>('[formControlName="totalSeats"]')!.value).toBe('4');

    // Navega na mesma rota sem rideId (Angular reutiliza a instância de OfferRide)
    await harness.navigateByUrl('/driver/offer');
    await harness.fixture.whenStable();

    http.expectNone((req) => req.method === 'PATCH' || req.method === 'POST');
    expect(rideData.editingRide()).toBeNull();

    const defaultTomorrow = formatLocalDate(new Date(2026, 10, 17, 10, 0, 0));
    const originInput = root.querySelector<HTMLInputElement>('[formControlName="origin"]')!;
    const destinationInput = root.querySelector<HTMLInputElement>('[formControlName="destination"]')!;
    const notesInput = root.querySelector<HTMLInputElement>('[formControlName="notes"]')!;
    const dateInput = root.querySelector<HTMLInputElement>('[formControlName="departureDate"]')!;
    const timeInput = root.querySelector<HTMLInputElement>('[formControlName="departureTime"]')!;
    const priceInput = root.querySelector<HTMLInputElement>('[formControlName="pricePerSeat"]')!;

    expect(originInput.disabled).toBe(false);
    expect(destinationInput.disabled).toBe(false);
    expect(notesInput.disabled).toBe(false);
    expect(dateInput.disabled).toBe(false);
    expect(timeInput.disabled).toBe(false);
    expect(priceInput.disabled).toBe(false);

    expect(originInput.value).toBe('');
    expect(destinationInput.value).toBe('');
    expect(notesInput.value).toBe('');
    expect(dateInput.value).toBe(defaultTomorrow);
    expect(timeInput.value).toBe('07:15');
    expect(root.querySelector<HTMLInputElement>('[formControlName="totalSeats"]')!.value).toBe('3');
    expect(priceInput.value).toBe('8');
    expect(root.querySelector('h1')!.textContent).toContain('Oferecer uma Carona');
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.textContent).toContain(
      'Publicar Oferta de Carona',
    );
    http.verify();
  });

  it('limpa erros residuais e recarrega a oferta correta ao alternar query params na mesma instância de OfferRide', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 16, 10, 0, 0));

    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    await authenticateStudent(http);

    const foreignRide: Ride = {
      id: 'ride-other',
      driverId: 'driver-2',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: new Date(2026, 10, 17, 7, 30, 0).toISOString(),
      totalSeats: 3,
      availableSeats: 2,
      pricePerSeat: 10,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const harness = await RouterTestingHarness.create('/driver/offer?rideId=ride-other');
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides/ride-other` && req.method === 'GET')
      .flush(foreignRide);
    await harness.fixture.whenStable();

    const root = harness.routeNativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="driver-authorization-error"]')).not.toBeNull();

    // Vai para nova oferta na mesma instância: erro de autorização deve sumir
    await harness.navigateByUrl('/driver/offer');
    await harness.fixture.whenStable();

    expect(root.querySelector('[data-testid="driver-authorization-error"]')).toBeNull();
    setField(root, 'origin', 'Portão');
    setField(root, 'destination', 'UTFPR - Sede Centro');
    await harness.fixture.whenStable();
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);

    // Vai para edição de ride-1 sem salvar a nova oferta, depois troca para ride-2 sem salvar ride-1
    const ride1: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Água Verde',
      destination: 'UTFPR Centro',
      departureTime: new Date(2026, 10, 17, 8, 0, 0).toISOString(),
      totalSeats: 2,
      availableSeats: 2,
      pricePerSeat: 7,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const ride2: Ride = {
      id: 'ride-2',
      driverId: 'driver-1',
      origin: 'Cabral',
      destination: 'UTFPR Ecoville',
      departureTime: new Date(2026, 10, 18, 9, 30, 0).toISOString(),
      totalSeats: 4,
      availableSeats: 4,
      pricePerSeat: 11,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    await harness.navigateByUrl('/driver/offer?rideId=ride-1');
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides/ride-1` && req.method === 'GET')
      .flush(ride1);
    await harness.fixture.whenStable();

    expect(root.querySelector<HTMLInputElement>('[formControlName="origin"]')!.value).toBe('Água Verde');
    setField(root, 'origin', 'Alteração Não Salva');

    await harness.navigateByUrl('/driver/offer?rideId=ride-2');
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/rides/ride-2` && req.method === 'GET')
      .flush(ride2);
    await harness.fixture.whenStable();

    http.expectNone((req) => req.method === 'PATCH' || req.method === 'POST');
    expect(root.querySelector<HTMLInputElement>('[formControlName="origin"]')!.value).toBe('Cabral');
    expect(root.querySelector<HTMLInputElement>('[formControlName="destination"]')!.value).toBe(
      'UTFPR Ecoville',
    );
    expect(root.querySelector<HTMLInputElement>('[formControlName="totalSeats"]')!.value).toBe('4');
    expect(root.querySelector<HTMLInputElement>('[formControlName="pricePerSeat"]')!.value).toBe('11');
    http.verify();
  });
});
