import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { environment } from '../../../../environments/environment';
import { appConfig } from '../../../app.config';
import { Ride } from '../../../core/models/ride.model';
import { RideRequest } from '../../../core/models/ride-request.model';
import { User } from '../../../core/models/user.model';
import { AuthData } from '../../../core/services/auth-data';
import { ErrorNotice } from '../../../core/services/error-notice';
import { RideRequestData } from '../../../core/services/ride-request-data';
import { SUPABASE_AUTH_CLIENT, SupabaseAuthClient } from '../../../core/services/supabase-client';

const usersUrl = `${environment.supabaseUrl}/rest/v1/users`;
const ridesUrl = `${environment.supabaseUrl}/rest/v1/rides`;
const driverSummariesUrl = `${environment.supabaseUrl}/rest/v1/rpc/get_driver_summaries`;
const requestsUrl = `${environment.supabaseUrl}/rest/v1/ride_requests`;
const tripsUrl = `${environment.supabaseUrl}/rest/v1/rpc/get_passenger_trip_summaries`;
const openLabel = 'Solicitar vaga';
const confirmLabel = 'Confirmar solicitação de vaga';
const dismissLabel = 'Desistir';
const panelSelector = 'app-ride-request-confirm-panel';

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

function toRideRequestRow(request: RideRequest) {
  return {
    id: request.id,
    ride_id: request.rideId,
    passenger_id: request.passengerId,
    status: request.status,
    created_at: request.createdAt,
  };
}

function expectRideRead(http: HttpTestingController, rideId = '007') {
  return http.expectOne(
    (request) =>
      request.method === 'GET' && request.url === ridesUrl && request.params.get('id') === `eq.${rideId}`,
  );
}

function makeRide(overrides: Partial<Ride> = {}): Ride {
  return {
    id: '007',
    driverId: 'driver-1',
    origin: 'Batel',
    destination: 'UTFPR Neoville',
    departureTime: new Date(Date.now() + 3_600_000).toISOString(),
    totalSeats: 2,
    availableSeats: 1,
    pricePerSeat: 7.5,
    status: 'active',
    createdAt: '2026-01-01T08:00:00.000Z',
    ...overrides,
  };
}

function makeRequest(overrides: Partial<RideRequest> = {}): RideRequest {
  return {
    id: 'request-1',
    rideId: '007',
    passengerId: '008',
    status: 'pending',
    createdAt: '2026-01-01T08:00:00.000Z',
    ...overrides,
  };
}

function findButton(root: HTMLElement, label: string): HTMLButtonElement | undefined {
  return [...root.querySelectorAll('button')].find((button) => button.textContent.trim() === label);
}

function button(root: HTMLElement, label: string): HTMLButtonElement {
  const element = findButton(root, label);
  if (!element) throw new Error(`Botão ausente: "${label}"`);
  return element;
}

const fakeSupabaseUser: SupabaseUser = {
  id: '008',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T08:00:00.000Z',
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

async function authenticate(http: HttpTestingController, id = '008', role: User['role'] = 'student'): Promise<void> {
  TestBed.inject(AuthData).login('passageiro@alunos.utfpr.edu.br', 'senha123');
  await flushMicrotasks();
  http
    .expectOne((request) => request.url === usersUrl)
    .flush([
      {
        id,
        name: 'Joana Oliveira',
        email: 'passageiro@alunos.utfpr.edu.br',
        registration_number: '2026001',
        whatsapp: '41999998888',
        role,
        is_blocked: false,
        is_email_confirmed: true,
        rating_average: 0,
        created_at: '2026-01-01T08:00:00.000Z',
      },
    ]);
  await flushMicrotasks();
}

function expectRequestRead(http: HttpTestingController, rideId = '007', passengerId = '008') {
  const read = http.expectOne((request) => request.method === 'GET' && request.url === requestsUrl);
  expect(read.request.params.get('ride_id')).toBe(`eq.${rideId}`);
  expect(read.request.params.get('passenger_id')).toBe(`eq.${passengerId}`);
  return read;
}

function flushRide(http: HttpTestingController, ride: Ride): void {
  expectRideRead(http, ride.id).flush([toRideRow(ride)]);
  http.expectOne((request) => request.url === driverSummariesUrl).flush([]);
}

function flushDetail(http: HttpTestingController, ride: Ride, requests: RideRequest[] = []): void {
  flushRide(http, ride);
  expectRequestRead(http, ride.id).flush(requests.map(toRideRequestRow));
}

async function enterDetail(ride: Ride, requests: RideRequest[] = []) {
  const http = TestBed.inject(HttpTestingController);
  await authenticate(http);
  const harness = await RouterTestingHarness.create(`/rides/${ride.id}`);
  flushDetail(http, ride, requests);
  await harness.fixture.whenStable();
  const root = harness.routeNativeElement!.querySelector('main')!;
  return { http, harness, root };
}

function expectNoPost(http: HttpTestingController): void {
  http.expectNone({ method: 'POST', url: requestsUrl });
}

function flushTrips(http: HttpTestingController): void {
  http
    .expectOne({
      method: 'POST',
      url: tripsUrl,
    })
    .flush([]);
}

describe('Carregamento sob demanda de RideDetail', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...appConfig.providers,
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
      deferBlockBehavior: DeferBlockBehavior.Manual,
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('renderiza o placeholder no bloco adiado enquanto o painel ainda não está disponível', async () => {
    const { http, harness, root } = await enterDetail(makeRide());
    const blocks = await harness.fixture.getDeferBlocks();
    expect(blocks).toHaveLength(1);
    const [confirmation] = blocks;

    await confirmation.render(DeferBlockState.Placeholder);
    expect(root.textContent).not.toContain('Carregando confirmação…');
    button(root, openLabel).click();
    await harness.fixture.whenStable();
    expect(root.textContent).toContain('Carregando confirmação…');
    expect(root.querySelector(panelSelector)).toBeNull();

    await confirmation.render(DeferBlockState.Complete);
    expect(root.textContent).not.toContain('Carregando confirmação…');
    expect(findButton(root, confirmLabel)).toBeDefined();
    expectNoPost(http);
  });
});

describe('Solicitação de vaga em RideDetail', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...appConfig.providers,
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
      deferBlockBehavior: DeferBlockBehavior.Playthrough,
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it.each([
    {
      role: 'student',
      isBlocked: true,
      message: 'Sua conta está bloqueada. Você não pode solicitar vagas nem cancelar solicitações.',
    },
    {
      role: 'support',
      isBlocked: false,
      message: 'Perfis de suporte não podem solicitar vagas nem cancelar solicitações.',
    },
  ] as const)('exibe "$message" e impede abrir a solicitação', async ({ role, isBlocked, message }) => {
    const http = TestBed.inject(HttpTestingController);
    await authenticate(http, '008', role);
    if (isBlocked) {
      const auth = TestBed.inject(AuthData);
      // Login recusa contas bloqueadas. Simula uma sessão corrente já bloqueada.
      vi.spyOn(auth, 'currentUser').mockReturnValue({ ...auth.currentUser()!, isBlocked });
    }
    const ride = makeRide();
    const harness = await RouterTestingHarness.create(`/rides/${ride.id}`);
    flushDetail(http, ride);
    await harness.fixture.whenStable();
    const root = harness.routeNativeElement!.querySelector('main')!;

    expect(root.querySelector('[role="alert"]')?.textContent ?? '').toContain(message);
    expect(findButton(root, openLabel)).toBeUndefined();
    expect(root.querySelector(panelSelector)).toBeNull();
    expectNoPost(http);
    http.expectNone((request) => request.method === 'PATCH');
  });

  it('descarta o painel aberto ao trocar de passageiro antes da confirmação', async () => {
    const { http, harness, root } = await enterDetail(makeRide());
    button(root, openLabel).click();
    await harness.fixture.whenStable();
    const staleConfirmation = button(root, confirmLabel);

    TestBed.inject(AuthData).logout();
    await authenticate(http, '009');
    staleConfirmation.click();
    await harness.fixture.whenStable();
    flushRide(http, makeRide());
    expectRequestRead(http, '007', '009').flush([]);
    await harness.fixture.whenStable();

    expect(button(root, openLabel).getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector(panelSelector)).toBeNull();
    expectNoPost(http);
  });

  it('isola a leitura do detalhe quando o mesmo passageiro entra em outra sessão antes do próximo ciclo', async () => {
    const ride = makeRide();
    const http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthData);
    await authenticate(http);
    const harness = await RouterTestingHarness.create(`/rides/${ride.id}`);
    const oldOffer = expectRideRead(http, ride.id);
    const oldRequest = expectRequestRead(http);

    auth.logout();
    await authenticate(http);
    const newSession = auth.currentUser();
    oldOffer.flush([toRideRow(ride)]);
    oldRequest.flush([toRideRequestRow(makeRequest({ status: 'accepted' }))]);
    http.expectNone((request) => request.url === driverSummariesUrl);

    await harness.fixture.whenStable();
    const root = harness.routeNativeElement!.querySelector('main')!;
    expect(root.textContent).not.toContain(ride.origin);
    flushDetail(http, makeRide({ origin: 'Centro' }));
    await harness.fixture.whenStable();
    expect(auth.currentUser()).toBe(newSession);
    expect(TestBed.inject(Router).url).toBe('/rides/007');
    expect(root.textContent).toContain('Centro');
    expect(root.textContent).not.toContain('Solicitação confirmada');
  });

  it.each(['oferta', 'motorista'] as const)(
    'encerra a sessão atual se o detalhe recebe 401 na leitura de %s',
    async (resource) => {
      const http = TestBed.inject(HttpTestingController);
      await authenticate(http);
      const harness = await RouterTestingHarness.create('/rides/007');
      expectRequestRead(http).flush([]);

      let read = expectRideRead(http, '007');
      if (resource === 'motorista') {
        read.flush([toRideRow(makeRide())]);
        read = http.expectOne((request) => request.url === driverSummariesUrl);
      }
      read.flush(null, { status: 401, statusText: 'Unauthorized' });
      await harness.fixture.whenStable();

      expect(TestBed.inject(AuthData).currentUser()).toBeNull();
      expect(TestBed.inject(Router).url).toBe('/login');
      expect(TestBed.inject(ErrorNotice).message()).toContain('Faça login e tente novamente.');
    },
  );

  it('carrega o painel na interação, permite desistir e descarta o painel ao sair', async () => {
    const ride = makeRide();
    const { http, harness, root } = await enterDetail(ride);
    const trigger = button(root, openLabel);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector(panelSelector)).toBeNull();

    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await harness.fixture.whenStable();
    expect(root.querySelector(panelSelector)).toBeNull();
    expect(document.activeElement).toBe(trigger);
    // O navegador converte a ativação do botão por teclado em click.
    trigger.click();
    await harness.fixture.whenStable();
    expect(root.querySelector(panelSelector)?.textContent).toContain('Batel → UTFPR Neoville');
    expect(root.querySelector(panelSelector)?.textContent).toContain('R$ 7,50');
    expect(root.querySelector(panelSelector)?.contains(document.activeElement)).toBe(true);
    expectNoPost(http);

    button(root, dismissLabel).click();
    await harness.fixture.whenStable();
    expect(root.querySelector(panelSelector)).toBeNull();
    expect(document.activeElement).toBe(trigger);

    trigger.click();
    await harness.fixture.whenStable();
    expect(findButton(root, confirmLabel)).toBeDefined();
    await harness.navigateByUrl('/rides/my-trips');
    flushTrips(http);
    await harness.navigateByUrl('/rides/007');
    flushDetail(http, ride);
    await harness.fixture.whenStable();
    expect(button(root, openLabel).getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector(panelSelector)).toBeNull();
    expectNoPost(http);
  });

  it('recolhe e expande o painel móvel pelo puxador, com clique e ativação pelo teclado', async () => {
    const { http, harness, root } = await enterDetail(makeRide());
    button(root, openLabel).click();
    await harness.fixture.whenStable();
    const handle = root.querySelector<HTMLButtonElement>(`${panelSelector} button[aria-expanded]`)!;
    const contentId = handle.getAttribute('aria-controls');
    const content = root.querySelector<HTMLElement>(`[id="${contentId}"]`)!;
    expect(content.contains(button(root, confirmLabel))).toBe(true);
    expect(handle.getAttribute('aria-expanded')).toBe('true');

    handle.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    await harness.fixture.whenStable();
    expect(handle.getAttribute('aria-expanded')).toBe('false');
    expect(handle.getAttribute('aria-label')).toBe('Expandir solicitação de vaga');
    expect(content.classList.contains('hidden')).toBe(true);

    handle.focus();
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    // O DOM de teste não sintetiza o clique de ativação como um navegador.
    handle.click();
    await harness.fixture.whenStable();
    expect(handle.getAttribute('aria-expanded')).toBe('true');
    expect(handle.getAttribute('aria-label')).toBe('Recolher solicitação de vaga');
    expect(content.classList.contains('hidden')).toBe(false);
    expect(document.activeElement).toBe(handle);
    expectNoPost(http);
  });

  it('recolhe com arraste para baixo e expande com arraste para cima sem acionar a confirmação', async () => {
    const { http, harness, root } = await enterDetail(makeRide());
    button(root, openLabel).click();
    await harness.fixture.whenStable();
    const handle = root.querySelector<HTMLButtonElement>(`${panelSelector} button[aria-expanded]`)!;
    const drag = (startY: number, endY: number): void => {
      const pointer = { pointerId: 1, isPrimary: true, pointerType: 'touch', bubbles: true };
      handle.dispatchEvent(new PointerEvent('pointerdown', { ...pointer, clientY: startY }));
      handle.dispatchEvent(new PointerEvent('pointermove', { ...pointer, clientY: endY }));
      handle.dispatchEvent(new PointerEvent('pointerup', { ...pointer, clientY: endY }));
      handle.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    };

    drag(100, 180);
    await harness.fixture.whenStable();
    expect(handle.getAttribute('aria-expanded')).toBe('false');

    drag(180, 100);
    await harness.fixture.whenStable();
    expect(handle.getAttribute('aria-expanded')).toBe('true');
    expectNoPost(http);
  });

  it('posiciona o painel móvel acima da altura definida pelo layout de navegação', async () => {
    const { harness, root } = await enterDetail(makeRide());
    button(root, openLabel).click();
    await harness.fixture.whenStable();
    const layout = harness.routeNativeElement!;
    const nav = layout.querySelector('nav[aria-label="Navegação principal"]')!;
    const sheet = root.querySelector(`${panelSelector} section`)!;
    expect(nav.classList.contains('h-(--rides-navigation-height)')).toBe(true);
    expect(sheet.classList.contains('bottom-(--rides-navigation-height)')).toBe(true);
    expect(
      [...layout.firstElementChild!.classList].some((name) =>
        name.startsWith('[--rides-navigation-height:calc(var(--spacing-space-'),
      ),
    ).toBe(true);
  });

  it('limita o painel móvel entre as barras e mantém o puxador fora da rolagem interna', async () => {
    const { harness, root } = await enterDetail(makeRide());
    button(root, openLabel).click();
    await harness.fixture.whenStable();

    const header = harness.routeNativeElement!.querySelector('header')!;
    const sheet = root.querySelector(`${panelSelector} section`)!;
    const handle = sheet.querySelector('button[aria-expanded]')!;
    const content = sheet.querySelector('#ride-request-confirmation-content')!;

    expect([...sheet.classList]).toContain(
      'max-lg:max-h-[calc(min(100%,100dvh)-var(--rides-header-height)-var(--rides-navigation-height))]',
    );
    expect([...header.classList]).toContain('max-lg:h-(--rides-header-height)');
    expect([...content.classList]).toContain('max-lg:overflow-y-auto');
    expect(content.contains(document.activeElement)).toBe(true);
    expect(content.contains(button(root, confirmLabel))).toBe(true);
    expect(content.contains(button(root, dismissLabel))).toBe(true);
    expect(content.contains(handle)).toBe(false);
    expect([...handle.classList]).toContain('shrink-0');
  });

  it.each(['cancelled', 'rejected'] as const)(
    'confirma um novo pedido pendente com histórico %s e atualiza a tela',
    async (status) => {
      const ride = makeRide();
      const previous = makeRequest({ status });
      const { http, harness, root } = await enterDetail(ride, [previous]);
      button(root, openLabel).click();
      await harness.fixture.whenStable();
      const confirm = button(root, confirmLabel);
      confirm.click();
      confirm.click();
      expectNoPost(http);

      expectRequestRead(http).flush(
        [
          previous,
          makeRequest({ id: 'other-ride', rideId: '7' }),
          makeRequest({ id: 'other-passenger', passengerId: '8' }),
        ].map(toRideRequestRow),
      );
      const offer = expectRideRead(http, '007');
      expectNoPost(http);
      offer.flush([toRideRow(ride)]);

      const post = http.expectOne({ method: 'POST', url: requestsUrl });
      expect(post.request.body).toEqual({
        ride_id: '007',
        passenger_id: '008',
        status: 'pending',
        created_at: expect.any(String),
      });
      expect(Number.isNaN(Date.parse(post.request.body.created_at))).toBe(false);
      post.flush({ id: 'request-2', ...post.request.body });
      await harness.fixture.whenStable();

      expect(root.textContent).toContain('Aguardando aprovação do motorista');
      expect(findButton(root, openLabel)).toBeUndefined();
      expect(root.querySelector(panelSelector)).toBeNull();
    },
  );

  it.each([
    { name: 'sem vagas', fields: { availableSeats: 0 }, message: 'Carona lotada' },
    { name: 'vagas negativas', fields: { availableSeats: -1 }, message: 'Carona lotada' },
    { name: 'lotada', fields: { status: 'full' }, message: 'Carona lotada' },
    { name: 'cancelada', fields: { status: 'cancelled' }, message: 'Carona cancelada' },
    { name: 'concluída', fields: { status: 'completed' }, message: 'Carona concluída' },
    {
      name: 'passada',
      fields: { departureTime: '2026-01-01T08:00:00.000Z' },
      message: 'O horário desta carona já passou',
    },
    { name: 'própria', fields: { driverId: '008' }, message: 'Você é o autor desta oferta' },
  ] satisfies { name: string; fields: Partial<Ride>; message: string }[])(
    'bloqueia uma carona $name na abertura',
    async ({ fields, message }) => {
      const { http, root } = await enterDetail(makeRide(fields));
      expect(root.textContent).toContain(message);
      expect(findButton(root, openLabel)).toBeUndefined();
      expectNoPost(http);
    },
  );

  it.each([
    { fields: { availableSeats: 0 }, message: 'Carona lotada' },
    { fields: { status: 'full' }, message: 'Carona lotada' },
    { fields: { status: 'cancelled' }, message: 'Carona cancelada' },
    { fields: { status: 'completed' }, message: 'Carona concluída' },
    {
      fields: { departureTime: '2026-01-01T08:00:00.000Z' },
      message: 'O horário desta carona já passou',
    },
    { fields: { driverId: '008' }, message: 'Você é o autor desta oferta' },
  ] satisfies { fields: Partial<Ride>; message: string }[])(
    'mostra "$message" quando a oferta muda antes da confirmação',
    async ({ fields, message }) => {
      const { http, harness, root } = await enterDetail(makeRide());
      button(root, openLabel).click();
      await harness.fixture.whenStable();
      button(root, confirmLabel).click();
      expectRequestRead(http).flush([]);
      expectRideRead(http, '007').flush([toRideRow(makeRide(fields))]);
      await harness.fixture.whenStable();

      expect(root.textContent).toContain(message);
      expect(root.querySelector(panelSelector)).toBeNull();
      expect(findButton(root, openLabel)).toBeUndefined();
      expectNoPost(http);
    },
  );

  it.each([
    { status: 'pending', message: 'Aguardando aprovação do motorista' },
    { status: 'accepted', message: 'Solicitação confirmada' },
  ] as const)(
    'não oculta uma solicitação $status anterior a um pedido encerrado',
    async ({ status, message }) => {
      const active = makeRequest({ status });
      const newer = makeRequest({
        id: 'request-2',
        status: 'rejected',
        createdAt: '2026-01-02T08:00:00.000Z',
      });
      const { http, root } = await enterDetail(makeRide(), [newer, active]);
      expect(root.textContent).toContain(message);
      expect(findButton(root, openLabel)).toBeUndefined();
      expectNoPost(http);
    },
  );

  it.each([
    { status: 'pending', message: 'Aguardando aprovação do motorista' },
    { status: 'accepted', message: 'Solicitação confirmada' },
  ] as const)(
    'atualiza a tela quando encontra uma solicitação $status durante a confirmação',
    async ({ status, message }) => {
      const ride = makeRide();
      const { http, harness, root } = await enterDetail(ride);
      button(root, openLabel).click();
      await harness.fixture.whenStable();
      button(root, confirmLabel).click();
      expectRequestRead(http).flush(
        [
          makeRequest({ status }),
          makeRequest({
            id: 'request-2',
            status: 'cancelled',
            createdAt: '2026-01-02T08:00:00.000Z',
          }),
        ].map(toRideRequestRow),
      );
      expectRideRead(http, '007').flush([toRideRow(ride)]);
      await harness.fixture.whenStable();

      expect(root.textContent).toContain(message);
      expect(root.querySelector(panelSelector)).toBeNull();
      expect(findButton(root, openLabel)).toBeUndefined();
      expectNoPost(http);
    },
  );

  it('isola o resultado de uma confirmação quando outra oferta já está aberta', async () => {
    const ride = makeRide();
    const { http, harness, root } = await enterDetail(ride);
    button(root, openLabel).click();
    await harness.fixture.whenStable();
    button(root, confirmLabel).click();
    expectRequestRead(http).flush([]);
    expectRideRead(http, '007').flush([toRideRow(ride)]);
    const firstPost = http.expectOne({ method: 'POST', url: requestsUrl });

    const otherRide = makeRide({ id: '009', origin: 'Boqueirão' });
    await harness.navigateByUrl('/rides/009');
    flushDetail(http, otherRide);
    await harness.fixture.whenStable();
    expect(root.querySelector(panelSelector)).toBeNull();
    button(root, openLabel).click();
    await harness.fixture.whenStable();
    button(root, confirmLabel).click();
    expectRequestRead(http, '009').flush([]);
    expectRideRead(http, '009').flush([toRideRow(otherRide)]);
    const secondPost = http.expectOne({ method: 'POST', url: requestsUrl });
    secondPost.flush(toRideRequestRow(makeRequest({ rideId: '009' })));
    firstPost.flush(toRideRequestRow(makeRequest({ id: 'request-2' })));
    await harness.fixture.whenStable();

    expect(root.textContent).toContain('Aguardando aprovação do motorista');
    expect(root.textContent).toContain('Boqueirão');
    expect(findButton(root, openLabel)).toBeUndefined();
  });

  it('reutiliza o envio em andamento e mostra seu resultado ao retornar à mesma oferta', async () => {
    const ride = makeRide();
    const { http, harness, root } = await enterDetail(ride);
    button(root, openLabel).click();
    await harness.fixture.whenStable();
    button(root, confirmLabel).click();
    expectRequestRead(http).flush([]);
    expectRideRead(http, '007').flush([toRideRow(ride)]);
    const post = http.expectOne({ method: 'POST', url: requestsUrl });
    const repeated = firstValueFrom(TestBed.inject(RideRequestData).createRequest(ride.id));
    http.expectNone((request) => request.url === requestsUrl);
    http.expectNone(ridesUrl);

    await harness.navigateByUrl('/rides/my-trips');
    flushTrips(http);
    await harness.navigateByUrl('/rides/007');
    flushRide(http, ride);
    http.expectNone((request) => request.url === requestsUrl);
    await harness.fixture.whenStable();
    expect(findButton(root, openLabel)).toBeUndefined();

    const request = makeRequest();
    post.flush(toRideRequestRow(request));
    expect(await repeated).toEqual({ status: 'created', ride, request });
    await harness.fixture.whenStable();
    expect(root.textContent).toContain('Aguardando aprovação do motorista');
  });

  it('mostra a oferta revalidada como lotada ao retornar enquanto a confirmação continua', async () => {
    const ride = makeRide();
    const previous = makeRequest({ status: 'rejected' });
    const { http, harness, root } = await enterDetail(ride, [previous]);
    button(root, openLabel).click();
    await harness.fixture.whenStable();
    button(root, confirmLabel).click();
    expectRequestRead(http).flush([toRideRequestRow(previous)]);
    const revalidation = expectRideRead(http, '007');

    await harness.navigateByUrl('/rides/my-trips');
    flushTrips(http);
    await harness.navigateByUrl('/rides/007');
    flushRide(http, ride);
    http.expectNone((request) => request.url === requestsUrl);
    await harness.fixture.whenStable();
    expect(root.textContent).toContain('1 de 2 vagas livres');
    expect(findButton(root, openLabel)).toBeUndefined();

    revalidation.flush([toRideRow(makeRide({ availableSeats: 0, status: 'full' }))]);
    await harness.fixture.whenStable();
    const history = expectRequestRead(http);
    expect(root.textContent).toContain('0 de 2 vagas livres');
    expect(root.textContent).toContain('Todas as vagas desta carona foram preenchidas.');
    expect(root.textContent).toContain('Consultando sua solicitação');
    history.flush([toRideRequestRow(previous)]);
    await harness.fixture.whenStable();
    expect(root.textContent).toContain('Solicitação rejeitada');
    expect(root.textContent).toContain('0 de 2 vagas livres');
    expect(findButton(root, openLabel)).toBeUndefined();
    expectNoPost(http);
  });

  it.each(['pedidos anteriores', 'oferta atual', 'envio'] as const)(
    'encerra a sessão e redireciona ao login se a etapa de %s recebe 401',
    async (step) => {
      const ride = makeRide();
      const { http, harness, root } = await enterDetail(ride);
      button(root, openLabel).click();
      await harness.fixture.whenStable();
      button(root, confirmLabel).click();
      let operation = expectRequestRead(http);
      if (step !== 'pedidos anteriores') {
        operation.flush([]);
        operation = expectRideRead(http, ride.id);
      }
      if (step === 'envio') {
        operation.flush([toRideRow(ride)]);
        operation = http.expectOne({ method: 'POST', url: requestsUrl });
        await harness.navigateByUrl('/rides/my-trips');
        flushTrips(http);
      }

      operation.flush(null, { status: 401, statusText: 'Unauthorized' });
      await harness.fixture.whenStable();

      expect(TestBed.inject(AuthData).currentUser()).toBeNull();
      expect(TestBed.inject(Router).url).toBe('/login');
      expect(TestBed.inject(ErrorNotice).message()).toContain('Faça login e tente novamente.');
      expectNoPost(http);
    },
  );

  it('preserva uma nova sessão do mesmo passageiro quando o envio da sessão anterior recebe 401', async () => {
    const ride = makeRide();
    const { http, harness, root } = await enterDetail(ride);
    button(root, openLabel).click();
    await harness.fixture.whenStable();
    button(root, confirmLabel).click();
    expectRequestRead(http).flush([]);
    expectRideRead(http, ride.id).flush([toRideRow(ride)]);
    const post = http.expectOne({ method: 'POST', url: requestsUrl });

    const auth = TestBed.inject(AuthData);
    auth.logout();
    await authenticate(http);
    const newSession = auth.currentUser();
    await harness.fixture.whenStable();
    flushDetail(http, ride);
    post.flush(null, { status: 401, statusText: 'Unauthorized' });
    await harness.fixture.whenStable();

    expect(auth.currentUser()).toBe(newSession);
    expect(TestBed.inject(Router).url).toBe('/rides/007');
    expect(TestBed.inject(ErrorNotice).message()).toBe('');
    expect(button(root, openLabel).getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector(panelSelector)).toBeNull();
    expectNoPost(http);
  });

  it('impede a gravação se a sessão muda durante a revalidação', async () => {
    const ride = makeRide();
    const { http, harness, root } = await enterDetail(ride);
    button(root, openLabel).click();
    await harness.fixture.whenStable();
    button(root, confirmLabel).click();
    expectRequestRead(http).flush([]);
    const offer = expectRideRead(http, '007');

    TestBed.inject(AuthData).logout();
    await authenticate(http, '009');
    offer.flush([toRideRow(ride)]);
    await harness.fixture.whenStable();
    flushRide(http, ride);
    expectRequestRead(http, '007', '009').flush([]);
    await harness.fixture.whenStable();

    expectNoPost(http);
    expect(button(root, openLabel).getAttribute('aria-expanded')).toBe('false');
    expect(root.textContent).toContain('Você ainda não solicitou');
  });

  it.each([
    { connectionLost: true, message: 'Falha de conexão ao enviar a solicitação.' },
    { connectionLost: false, message: 'Não foi possível enviar a solicitação.' },
  ])('mostra "$message" quando a gravação falha', async ({ connectionLost, message }) => {
    const ride = makeRide();
    const { http, harness, root } = await enterDetail(ride);
    button(root, openLabel).click();
    await harness.fixture.whenStable();
    button(root, confirmLabel).click();
    expectRequestRead(http).flush([]);
    expectRideRead(http, '007').flush([toRideRow(ride)]);
    const post = http.expectOne({ method: 'POST', url: requestsUrl });
    if (connectionLost) post.error(new ProgressEvent('error'));
    else post.flush(null, { status: 500, statusText: 'Server Error' });
    await harness.fixture.whenStable();

    expect(
      root.querySelector(panelSelector)?.querySelector('[role="alert"]')?.textContent,
    ).toContain(message);
    expect(root.textContent).not.toContain('Aguardando aprovação do motorista');
    expect(button(root, 'Tentar novamente').disabled).toBe(false);
    expectNoPost(http);
  });

  it.each([
    ['oferta offline', 0, 'Falha de conexão'],
    ['resumo do motorista', 404, 'Não foi possível carregar os detalhes da carona'],
  ] as const)('permite recarregar o detalhe quando falha %s (CA10)', async (resource, status, message) => {
    const http = TestBed.inject(HttpTestingController);
    const ride = makeRide();
    await authenticate(http);
    const harness = await RouterTestingHarness.create(`/rides/${ride.id}`);
    const root = harness.routeNativeElement!.querySelector('main')!;
    expectRequestRead(http).flush([]);
    const offer = expectRideRead(http, ride.id);
    if (status === 0) offer.error(new ProgressEvent('error'));
    else {
      offer.flush([toRideRow(ride)]);
      http.expectOne((request) => request.url === driverSummariesUrl)
        .flush(null, { status, statusText: 'Not Found' });
    }
    await harness.fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(message);
    expect(root.textContent).not.toContain('Oferta de carona não encontrada');
    expect(TestBed.inject(ErrorNotice).message()).toBe('');
    button(root, 'Tentar novamente').click();
    await harness.fixture.whenStable();
    flushRide(http, ride);
    await harness.fixture.whenStable();
    expect(root.textContent).toContain(ride.origin);
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expectNoPost(http);
  });

  it('oferece retorno à busca para um id de oferta inexistente (CA10)', async () => {
    const http = TestBed.inject(HttpTestingController);
    await authenticate(http);
    const harness = await RouterTestingHarness.create('/rides/inexistente');
    const root = harness.routeNativeElement!.querySelector('main')!;
    expectRequestRead(http, 'inexistente').flush([]);
    expectRideRead(http, 'inexistente')
      .flush(null, { status: 404, statusText: 'Not Found' });
    await harness.fixture.whenStable();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Oferta de carona não encontrada');
    const back = [...root.querySelectorAll('a[href="/rides"]')]
      .find((link) => link.textContent?.trim() === 'Voltar para a busca');
    expect(back).toBeDefined();
    (back as HTMLAnchorElement).click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/rides');
    expectNoPost(http);
  });

  it('repete somente a leitura auxiliar da solicitação após um 404 (CA10)', async () => {
    const http = TestBed.inject(HttpTestingController);
    const ride = makeRide();
    await authenticate(http);
    const harness = await RouterTestingHarness.create(`/rides/${ride.id}`);
    const root = harness.routeNativeElement!.querySelector('main')!;
    flushRide(http, ride);
    expectRequestRead(http).flush(null, { status: 404, statusText: 'Not Found' });
    await harness.fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível consultar sua solicitação');
    expect(root.textContent).not.toContain('Você ainda não solicitou');
    expect(TestBed.inject(ErrorNotice).message()).toBe('');
    button(root, 'Tentar novamente').click();
    await harness.fixture.whenStable();
    expectRequestRead(http).flush([toRideRequestRow(makeRequest())]);
    await harness.fixture.whenStable();
    expect(root.textContent).toContain('Aguardando aprovação do motorista');
    expectNoPost(http);
  });

  it('oferece retorno à busca se a oferta deixar de existir antes da confirmação (CA10)', async () => {
    const { http, harness, root } = await enterDetail(makeRide());
    button(root, openLabel).click();
    await harness.fixture.whenStable();
    button(root, confirmLabel).click();
    expectRequestRead(http).flush([]);
    expectRideRead(http, '007')
      .flush(null, { status: 404, statusText: 'Not Found' });
    await harness.fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Oferta de carona não encontrada');
    expect(root.querySelector(panelSelector)).toBeNull();
    expect([...root.querySelectorAll('a[href="/rides"]')].map((link) => link.textContent?.trim()))
      .toContain('Voltar para a busca');
    expectNoPost(http);
  });

  it.each([false, true])(
    'recupera o pedido após perder a resposta do POST, com leitura inicial ainda vazia: %s (CA10)',
    async (stillQueued) => {
      const ride = makeRide();
      const { http, harness, root } = await enterDetail(ride);
      button(root, openLabel).click();
      await harness.fixture.whenStable();
      button(root, confirmLabel).click();
      expectRequestRead(http).flush([]);
      expectRideRead(http, '007').flush([toRideRow(ride)]);
      http.expectOne({ method: 'POST', url: requestsUrl }).error(new ProgressEvent('error'));
      await harness.fixture.whenStable();

      const retry = button(root, 'Tentar novamente');
      retry.click();
      retry.click();
      const active = makeRequest({ status: 'accepted' });
      expectRequestRead(http).flush(stillQueued ? [] : [toRideRequestRow(active)]);
      if (stillQueued) {
        expectRideRead(http, '007').flush([toRideRow(ride)]);
        http.expectOne({ method: 'POST', url: requestsUrl }).flush(
          { code: 'active-ride-request', error: 'An active request already exists' },
          { status: 409, statusText: 'Conflict' },
        );
        expectRequestRead(http).flush([toRideRequestRow(active)]);
      }
      expectRideRead(http, '007')
        .flush([toRideRow({ ...ride, availableSeats: 0, status: 'full' })]);
      await harness.fixture.whenStable();

      expect(root.querySelector(panelSelector)).toBeNull();
      expect(root.textContent).toContain('Solicitação confirmada');
      expect(root.textContent).toContain('Carona lotada');
      expect(root.textContent).toContain('0 de 2 vagas livres');
      expect(root.textContent).not.toContain('Carona ativa');
      expect(root.querySelector('[role="alert"]')).toBeNull();
      expectNoPost(http);
    },
  );

  it('oferece nova tentativa se não consegue atualizar a disponibilidade do pedido recuperado', async () => {
    const ride = makeRide();
    const { http, harness, root } = await enterDetail(ride);
    button(root, openLabel).click();
    await harness.fixture.whenStable();
    button(root, confirmLabel).click();
    expectRequestRead(http).flush([]);
    expectRideRead(http, '007').flush([toRideRow(ride)]);
    http.expectOne({ method: 'POST', url: requestsUrl }).error(new ProgressEvent('error'));
    await harness.fixture.whenStable();

    const accepted = makeRequest({ status: 'accepted' });
    button(root, 'Tentar novamente').click();
    expectRequestRead(http).flush([toRideRequestRow(accepted)]);
    expectRideRead(http, '007').error(new ProgressEvent('error'));
    await harness.fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain('atualizar a disponibilidade');
    expect(root.textContent).not.toContain('Solicitação confirmada');
    expectNoPost(http);

    button(root, 'Tentar novamente').click();
    expectRequestRead(http).flush([toRideRequestRow(accepted)]);
    expectRideRead(http, '007')
      .flush([toRideRow({ ...ride, availableSeats: 0, status: 'full' })]);
    await harness.fixture.whenStable();

    expect(root.textContent).toContain('Solicitação confirmada');
    expect(root.textContent).toContain('0 de 2 vagas livres');
    expectNoPost(http);
  });

  it('relê pedido e oferta em sequência ao voltar durante uma atualização de disponibilidade', async () => {
    const ride = makeRide();
    const { http, harness, root } = await enterDetail(ride);
    button(root, openLabel).click();
    await harness.fixture.whenStable();
    button(root, confirmLabel).click();
    expectRequestRead(http).flush([]);
    expectRideRead(http, '007').flush([toRideRow(ride)]);
    http.expectOne({ method: 'POST', url: requestsUrl }).error(new ProgressEvent('error'));
    await harness.fixture.whenStable();

    button(root, 'Tentar novamente').click();
    const pending = makeRequest();
    const accepted = { ...pending, status: 'accepted' as const };
    expectRequestRead(http).flush([toRideRequestRow(pending)]);
    const refresh = expectRideRead(http, '007');
    await harness.navigateByUrl('/rides/my-trips');
    flushTrips(http);
    await harness.navigateByUrl('/rides/007');
    flushRide(http, ride);
    refresh.flush(null, { status: 503, statusText: 'Unavailable' });
    await harness.fixture.whenStable();
    const returned = harness.routeNativeElement!.querySelector('main')!;

    expect(returned.querySelector('[role="alert"]')?.textContent).toContain('atualizar a disponibilidade');
    expect(returned.textContent).not.toContain('Solicitação confirmada');
    expect(returned.textContent).toContain('1 de 2 vagas livres');
    http.expectNone((request) => request.method === 'GET' && request.url === requestsUrl);
    expectNoPost(http);

    button(returned, 'Tentar novamente').click();
    await harness.fixture.whenStable();
    const failedRead = expectRequestRead(http);
    http.expectNone(ridesUrl);
    failedRead.flush(null, { status: 404, statusText: 'Not Found' });
    await harness.fixture.whenStable();
    expect(returned.querySelector('[role="alert"]')?.textContent).toContain('consultar');
    expect(returned.textContent).not.toContain('Oferta de carona não encontrada');
    expectNoPost(http);

    button(returned, 'Tentar novamente').click();
    await harness.fixture.whenStable();
    const interruptedRead = expectRequestRead(http);
    http.expectNone(ridesUrl);
    await harness.navigateByUrl('/rides/my-trips');
    flushTrips(http);
    expect(interruptedRead.cancelled).toBe(true);

    // Ao reabrir, o detalhe ainda recebe a oferta ativa antes de o motorista ocupar a última vaga.
    await harness.navigateByUrl('/rides/007');
    flushRide(http, ride);
    const recoveredRead = expectRequestRead(http);
    http.expectNone(ridesUrl);
    recoveredRead.flush([toRideRequestRow(accepted)]);
    const refreshedRide = expectRideRead(http, '007');
    await harness.fixture.whenStable();
    const reopened = harness.routeNativeElement!.querySelector('main')!;
    expect(reopened.textContent).not.toContain('Solicitação confirmada');
    refreshedRide.flush([toRideRow({ ...ride, availableSeats: 0, status: 'full' })]);
    await harness.fixture.whenStable();
    expect(reopened.textContent).toContain('Solicitação confirmada');
    expect(reopened.textContent).toContain('Carona lotada');
    expect(reopened.textContent).toContain('0 de 2 vagas livres');
    expect(reopened.textContent).not.toContain('Carona ativa');
    expectNoPost(http);
  });

  it('relê a oferta após recuperar o pedido ao voltar durante a consulta de um conflito', async () => {
    const ride = makeRide();
    const { http, harness, root } = await enterDetail(ride);
    button(root, openLabel).click();
    await harness.fixture.whenStable();
    button(root, confirmLabel).click();
    expectRequestRead(http).flush([]);
    expectRideRead(http, '007').flush([toRideRow(ride)]);
    http.expectOne({ method: 'POST', url: requestsUrl }).flush(
      { code: 'active-ride-request', error: 'An active request already exists' },
      { status: 409, statusText: 'Conflict' },
    );
    const conflictRead = expectRequestRead(http);

    await harness.navigateByUrl('/rides/my-trips');
    flushTrips(http);
    await harness.navigateByUrl('/rides/007');
    flushRide(http, ride);
    conflictRead.flush(null, { status: 404, statusText: 'Not Found' });
    await harness.fixture.whenStable();
    expectRequestRead(http).flush(null, { status: 503, statusText: 'Unavailable' });
    await harness.fixture.whenStable();
    const returned = harness.routeNativeElement!.querySelector('main')!;
    expect(returned.querySelector('[role="alert"]')?.textContent).toContain('consultar');
    expect(returned.textContent).toContain('1 de 2 vagas livres');
    expectNoPost(http);

    button(returned, 'Tentar novamente').click();
    await harness.fixture.whenStable();
    const recoveredRead = expectRequestRead(http);
    http.expectNone(ridesUrl);
    // O motorista ocupa a última vaga depois que a oferta ativa foi lida ao voltar.
    const accepted = makeRequest({ status: 'accepted' });
    recoveredRead.flush([toRideRequestRow(accepted)]);
    await harness.fixture.whenStable();
    expect(returned.textContent).not.toContain('Solicitação confirmada');
    expectRideRead(http, '007').error(new ProgressEvent('error'));
    await harness.fixture.whenStable();
    expect(returned.querySelector('[role="alert"]')?.textContent).toContain('atualizar a disponibilidade');
    expect(returned.querySelector('[role="alert"]')?.textContent).toContain('Falha de conexão');
    expectNoPost(http);

    button(returned, 'Tentar novamente').click();
    await harness.fixture.whenStable();
    const lastRead = expectRequestRead(http);
    http.expectNone(ridesUrl);
    lastRead.flush([toRideRequestRow(accepted)]);
    expectRideRead(http, '007')
      .flush([toRideRow({ ...ride, availableSeats: 0, status: 'full' })]);
    await harness.fixture.whenStable();
    expect(returned.textContent).toContain('Solicitação confirmada');
    expect(returned.textContent).toContain('Carona lotada');
    expect(returned.textContent).toContain('0 de 2 vagas livres');
    expect(returned.textContent).not.toContain('Carona ativa');
    expectNoPost(http);
  });

  it('retoma a leitura coordenada se a recuperação anterior terminou enquanto o detalhe estava fechado', async () => {
    const ride = makeRide();
    const { http, harness, root } = await enterDetail(ride);
    button(root, openLabel).click();
    await harness.fixture.whenStable();
    button(root, confirmLabel).click();
    expectRequestRead(http).flush([toRideRequestRow(makeRequest())]);
    const refresh = expectRideRead(http, '007');

    await harness.navigateByUrl('/rides/my-trips');
    flushTrips(http);
    refresh.flush([toRideRow(ride)]);
    expectNoPost(http);

    await harness.navigateByUrl('/rides/007');
    flushRide(http, ride);
    // Só depois da leitura acima o motorista confirma o pedido e ocupa a última vaga.
    const accepted = makeRequest({ status: 'accepted' });
    expectRequestRead(http).flush([toRideRequestRow(accepted)]);
    await harness.fixture.whenStable();
    const returned = harness.routeNativeElement!.querySelector('main')!;
    expect(returned.textContent).not.toContain('Solicitação confirmada');
    expectRideRead(http, '007')
      .flush([toRideRow({ ...ride, availableSeats: 0, status: 'full' })]);
    await harness.fixture.whenStable();
    expect(returned.textContent).toContain('Solicitação confirmada');
    expect(returned.textContent).toContain('Carona lotada');
    expect(returned.textContent).toContain('0 de 2 vagas livres');
    expectNoPost(http);
  });

  it.each([
    { status: 404, statusText: 'Not Found', renewSession: false },
    { status: 401, statusText: 'Unauthorized', renewSession: false },
    { status: 401, statusText: 'Unauthorized', renewSession: true },
  ])(
    'trata $status da oferta na recuperação retomada (nova sessão: $renewSession)',
    async ({ status, statusText, renewSession }) => {
      const ride = makeRide();
      const { http, harness, root } = await enterDetail(ride);
      button(root, openLabel).click();
      await harness.fixture.whenStable();
      button(root, confirmLabel).click();
      expectRequestRead(http).flush([toRideRequestRow(makeRequest())]);
      expectRideRead(http, '007')
        .flush(null, { status: 503, statusText: 'Unavailable' });
      await harness.navigateByUrl('/rides/my-trips');
      flushTrips(http);
      await harness.navigateByUrl('/rides/007');
      flushRide(http, ride);
      expectRequestRead(http).flush([toRideRequestRow(makeRequest({ status: 'accepted' }))]);
      const refreshedRide = expectRideRead(http, '007');
      const auth = TestBed.inject(AuthData);
      if (renewSession) {
        auth.logout();
        await authenticate(http);
      }
      const currentSession = auth.currentUser();
      refreshedRide.flush(null, { status, statusText });
      await harness.fixture.whenStable();
      const returned = harness.routeNativeElement!.querySelector('main')!;
      expect(returned.textContent).not.toContain('Solicitação confirmada');

      if (renewSession) {
        flushDetail(http, ride, [makeRequest({ status: 'cancelled' })]);
        await harness.fixture.whenStable();
        expect(auth.currentUser()).toBe(currentSession);
        expect(TestBed.inject(Router).url).toBe('/rides/007');
        expect(TestBed.inject(ErrorNotice).message()).toBe('');
        expect(returned.textContent).toContain('Solicitação cancelada');
        http.expectNone(ridesUrl);
      } else if (status === 401) {
        expect(auth.currentUser()).toBeNull();
        expect(TestBed.inject(Router).url).toBe('/login');
      } else {
        expect(returned.textContent).toContain('Oferta de carona não encontrada');
        expect(returned.querySelector('a[href="/rides"]')?.textContent).toBeDefined();
      }
      expectNoPost(http);
    },
  );

  it.each([
    [404, 'Not Found'],
    [409, 'Conflict'],
  ] as const)('trata o HTTP %s sem confundir outro erro de envio com oferta ausente ou duplicidade (CA10)', async (status, statusText) => {
    const ride = makeRide();
    const { http, harness, root } = await enterDetail(ride);
    button(root, openLabel).click();
    await harness.fixture.whenStable();
    button(root, confirmLabel).click();
    expectRequestRead(http).flush([]);
    expectRideRead(http, '007').flush([toRideRow(ride)]);
    http.expectOne({ method: 'POST', url: requestsUrl }).flush(null, { status, statusText });
    await harness.fixture.whenStable();
    expect(root.querySelector(panelSelector)?.querySelector('[role="alert"]')?.textContent)
      .toContain('Não foi possível enviar a solicitação.');
    expect(TestBed.inject(ErrorNotice).message()).toBe('');
    button(root, 'Tentar novamente').click();
    expectRequestRead(http).flush([]);
    expectRideRead(http, '007').flush([toRideRow(ride)]);
    http.expectOne({ method: 'POST', url: requestsUrl }).flush(toRideRequestRow(makeRequest()));
    await harness.fixture.whenStable();
    expect(root.textContent).toContain('Aguardando aprovação do motorista');
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expectNoPost(http);
  });
});
