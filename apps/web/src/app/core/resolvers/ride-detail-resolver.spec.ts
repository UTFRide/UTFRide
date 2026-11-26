import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, convertToParamMap, Router, RouterStateSnapshot } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { firstValueFrom, isObservable } from 'rxjs';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { appConfig } from '../../app.config';
import { routes } from '../../app.routes';
import { Ride } from '../models/ride.model';
import { AuthData } from '../services/auth-data';
import { ErrorNotice } from '../services/error-notice';
import { SUPABASE_AUTH_CLIENT, SupabaseAuthClient } from '../services/supabase-client';
import { rideDetailResolver } from './ride-detail-resolver';

const usersUrl = `${environment.supabaseUrl}/rest/v1/users`;
const ridesUrl = `${environment.supabaseUrl}/rest/v1/rides`;
const driverSummariesUrl = `${environment.supabaseUrl}/rest/v1/rpc/get_driver_summaries`;
const requestsUrl = `${environment.supabaseUrl}/rest/v1/ride_requests`;
const tripsUrl = `${environment.supabaseUrl}/rest/v1/rpc/get_passenger_trip_summaries`;

const fakeSupabaseUser: SupabaseUser = {
  id: 'passenger-1',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
  email: 'passageiro@alunos.utfpr.edu.br',
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

async function waitForResolver(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function authenticate(http: HttpTestingController, id = 'passenger-1'): Promise<void> {
  TestBed.inject(AuthData).login('passageiro@alunos.utfpr.edu.br', 'senha123');
  await flushMicrotasks();
  http.expectOne((request) => request.url === usersUrl).flush([
    {
      id,
      name: 'Joana Passageira',
      email: 'passageiro@alunos.utfpr.edu.br',
      registration_number: '2026001',
      whatsapp: '41999998888',
      role: 'student',
      is_blocked: false,
      is_email_confirmed: true,
      rating_average: 0,
      created_at: '2026-01-01T00:00:00.000Z',
    },
  ]);
  await flushMicrotasks();
}

function makeRide(overrides: Partial<Ride> = {}): Ride {
  return {
    id: 'ride-1',
    driverId: 'driver-1',
    origin: 'Batel',
    destination: 'UTFPR Neoville',
    departureTime: new Date(Date.now() + 3_600_000).toISOString(),
    totalSeats: 3,
    availableSeats: 2,
    pricePerSeat: 7.5,
    status: 'active',
    createdAt: '2026-01-01T08:00:00.000Z',
    ...overrides,
  };
}

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

function expectRideRead(http: HttpTestingController, rideId: string) {
  return http.expectOne(
    (request) =>
      request.method === 'GET' && request.url === ridesUrl && request.params.get('id') === `eq.${rideId}`,
  );
}

describe('rideDetailResolver (CA4 e CA6)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...appConfig.providers,
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('registra resolve.initialDetail na rota /rides/:id em app.routes.ts', () => {
    const ridesRoute = routes.find((route) => route.path === 'rides');
    const detailRoute = ridesRoute?.children?.find((child) => child.path === ':id');

    expect(detailRoute?.resolve?.['initialDetail']).toBe(rideDetailResolver);
  });

  it('executa diretamente em contexto de injeção retornando not-found quando não há parâmetro id', async () => {
    const http = TestBed.inject(HttpTestingController);
    await authenticate(http);

    const route = { paramMap: convertToParamMap({}) } as ActivatedRouteSnapshot;
    const state = { url: '/rides/' } as RouterStateSnapshot;
    const result$ = TestBed.runInInjectionContext(() => rideDetailResolver(route, state));

    expect(isObservable(result$)).toBe(true);
    if (isObservable(result$)) {
      await expect(firstValueFrom(result$)).resolves.toEqual({ status: 'not-found' });
    }
    http.expectNone(ridesUrl);
  });

  it('pré-carrega oferta e resumo do motorista antes da ativação de RideDetail sem duplicar leitura inicial', async () => {
    const http = TestBed.inject(HttpTestingController);
    await authenticate(http);
    const ride = makeRide();

    const navigation = RouterTestingHarness.create('/rides/ride-1');
    await waitForResolver();
    const rideRead = expectRideRead(http, 'ride-1');
    // Enquanto o resolver não responde, RideDetail ainda não foi ativado e não leu ride_requests.
    http.expectNone((request) => request.url === requestsUrl);

    rideRead.flush([toRideRow(ride)]);
    const driverRead = http.expectOne(
      (request) => request.method === 'POST' && request.url === driverSummariesUrl,
    );
    expect(driverRead.request.body).toEqual({ p_driver_ids: ['driver-1'] });
    driverRead.flush([{ id: 'driver-1', name: 'Carlos Motorista', rating_average: 4.8 }]);

    const harness = await navigation;
    const root = harness.routeNativeElement!.querySelector('main')!;
    expect(root.textContent).toContain('Batel');
    expect(root.textContent).toContain('Carlos Motorista');

    // A leitura inicial da oferta não deve ser repetida após a ativação do componente.
    http.expectNone((request) => request.url === ridesUrl);
    http.expectNone((request) => request.url === driverSummariesUrl);
    http.expectOne((request) => request.method === 'GET' && request.url === requestsUrl).flush([]);
    await harness.fixture.whenStable();
  });

  it('retorna not-found no resolver para erro 22P02 e exibe mensagem com retorno a /rides', async () => {
    const http = TestBed.inject(HttpTestingController);
    await authenticate(http);

    const navigation = RouterTestingHarness.create('/rides/id-invalido');
    await waitForResolver();
    expectRideRead(http, 'id-invalido').flush(
      { code: '22P02', message: 'invalid input syntax for type uuid' },
      { status: 400, statusText: 'Bad Request' },
    );

    const harness = await navigation;
    http.expectOne((request) => request.method === 'GET' && request.url === requestsUrl).flush([]);
    await harness.fixture.whenStable();

    const root = harness.routeNativeElement!.querySelector('main')!;
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Oferta de carona não encontrada');
    const backLink = [...root.querySelectorAll('a[href="/rides"]')].find(
      (link) => link.textContent?.trim() === 'Voltar para a busca',
    );
    expect(backLink).toBeDefined();
    expect(TestBed.inject(ErrorNotice).message()).toBe('');
  });

  it('retorna error no resolver em falha de conexão e permite Tentar novamente no RideDetail', async () => {
    const http = TestBed.inject(HttpTestingController);
    await authenticate(http);
    const ride = makeRide();

    const navigation = RouterTestingHarness.create('/rides/ride-1');
    await waitForResolver();
    expectRideRead(http, 'ride-1').error(new ProgressEvent('error'));

    const harness = await navigation;
    http.expectOne((request) => request.method === 'GET' && request.url === requestsUrl).flush([]);
    await harness.fixture.whenStable();

    const root = harness.routeNativeElement!.querySelector('main')!;
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Falha de conexão');
    expect(TestBed.inject(ErrorNotice).message()).toBe('');

    const retryButton = [...root.querySelectorAll('button')].find(
      (btn) => btn.textContent?.trim() === 'Tentar novamente',
    );
    expect(retryButton).toBeDefined();
    retryButton!.click();
    await harness.fixture.whenStable();

    expectRideRead(http, 'ride-1').flush([toRideRow(ride)]);
    http
      .expectOne((request) => request.method === 'POST' && request.url === driverSummariesUrl)
      .flush([{ id: 'driver-1', name: 'Carlos Motorista', rating_average: 4.8 }]);
    await harness.fixture.whenStable();

    expect(root.textContent).toContain('Batel');
    expect(root.textContent).toContain('Carlos Motorista');
  });

  it('encerra a sessão via errorInterceptor quando recebe 401 no resolver', async () => {
    const http = TestBed.inject(HttpTestingController);
    await authenticate(http);

    const navigation = RouterTestingHarness.create('/rides/ride-1');
    await waitForResolver();
    expectRideRead(http, 'ride-1').flush(null, { status: 401, statusText: 'Unauthorized' });

    const harness = await navigation;
    await harness.fixture.whenStable();

    http.expectNone((request) => request.url === requestsUrl);
    expect(TestBed.inject(AuthData).currentUser()).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(TestBed.inject(ErrorNotice).message()).toContain('Faça login e tente novamente.');
  });

  it('cancela a requisição do resolver ao trocar de rota antes da conclusão', async () => {
    const http = TestBed.inject(HttpTestingController);
    await authenticate(http);

    const harness = await RouterTestingHarness.create('/rides/my-trips');
    http.expectOne((request) => request.method === 'POST' && request.url === tripsUrl).flush([]);
    await harness.fixture.whenStable();

    const abortedNavigation = harness.navigateByUrl('/rides/ride-1');
    await waitForResolver();
    const pendingRideRead = expectRideRead(http, 'ride-1');

    const nextNavigation = harness.navigateByUrl('/rides/ride-2');
    await waitForResolver();
    expect(pendingRideRead.cancelled).toBe(true);
    expectRideRead(http, 'ride-2').flush([toRideRow(makeRide({ id: 'ride-2', origin: 'Centro' }))]);
    http
      .expectOne((request) => request.method === 'POST' && request.url === driverSummariesUrl)
      .flush([{ id: 'driver-1', name: 'Carlos Motorista', rating_average: 4.8 }]);

    await Promise.allSettled([abortedNavigation, nextNavigation]);
    http.expectOne((request) => request.method === 'GET' && request.url === requestsUrl).flush([]);
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/rides/ride-2');
    expect(harness.routeNativeElement!.querySelector('main')?.textContent).toContain('Centro');
  });

  it('isola troca de sessão durante o resolver sem vazar dados ou sobrescrever a nova sessão', async () => {
    const http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthData);
    await authenticate(http, 'passenger-1');

    const navigation = RouterTestingHarness.create('/rides/ride-1');
    await waitForResolver();
    const oldRideRead = expectRideRead(http, 'ride-1');

    auth.logout();
    await authenticate(http, 'passenger-2');
    const secondSession = auth.currentUser();

    oldRideRead.flush([toRideRow(makeRide({ origin: 'Origem Sessão Antiga' }))]);
    http.expectNone((request) => request.url === driverSummariesUrl);
    http.expectNone((request) => request.url === requestsUrl);

    const harness = await navigation;
    expect(auth.currentUser()).toBe(secondSession);

    const nextNavigation = harness.navigateByUrl('/rides/ride-1');
    await waitForResolver();
    expectRideRead(http, 'ride-1').flush([toRideRow(makeRide({ origin: 'Origem Nova Sessão' }))]);
    http
      .expectOne((request) => request.method === 'POST' && request.url === driverSummariesUrl)
      .flush([{ id: 'driver-1', name: 'Carlos Motorista', rating_average: 5 }]);
    await nextNavigation;

    http.expectOne((request) => request.method === 'GET' && request.url === requestsUrl).flush([]);
    await harness.fixture.whenStable();

    const root = harness.routeNativeElement!.querySelector('main')!;
    expect(root.textContent).toContain('Origem Nova Sessão');
    expect(root.textContent).not.toContain('Origem Sessão Antiga');
  });
});
