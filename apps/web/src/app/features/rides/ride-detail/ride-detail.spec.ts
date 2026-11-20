import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
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

const ridesUrl = `${environment.apiUrl}/rides`;
const requestsUrl = `${environment.apiUrl}/ride_requests`;
const openLabel = 'Solicitar vaga';
const confirmLabel = 'Confirmar solicitação de vaga';
const dismissLabel = 'Desistir';
const panelSelector = 'app-ride-request-confirm-panel';

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

function authenticate(http: HttpTestingController, id = '008', role: User['role'] = 'student'): void {
  TestBed.inject(AuthData).login('passageiro@alunos.utfpr.edu.br', 'senha123');
  http
    .expectOne((request) => request.url === `${environment.apiUrl}/users`)
    .flush([
      {
        id,
        name: 'Joana Oliveira',
        email: 'passageiro@alunos.utfpr.edu.br',
        password: 'senha123',
        registrationNumber: '2026001',
        whatsapp: '41999998888',
        role,
        isBlocked: false,
        isEmailConfirmed: true,
        ratingAverage: 0,
        createdAt: '2026-01-01T08:00:00.000Z',
      },
    ]);
}

function expectRequestRead(http: HttpTestingController, rideId = '007', passengerId = '008') {
  const read = http.expectOne((request) => request.method === 'GET' && request.url === requestsUrl);
  expect(JSON.parse(read.request.params.get('_where')!)).toEqual({
    rideId: { eq: rideId },
    passengerId: { eq: passengerId },
  });
  return read;
}

function flushRide(http: HttpTestingController, ride: Ride): void {
  http.expectOne({ method: 'GET', url: `${ridesUrl}/${ride.id}` }).flush(ride);
  http.expectOne((request) => request.url === `${environment.apiUrl}/driver-summaries`).flush([]);
}

function flushDetail(http: HttpTestingController, ride: Ride, requests: RideRequest[] = []): void {
  flushRide(http, ride);
  expectRequestRead(http, ride.id).flush(requests);
}

async function enterDetail(ride: Ride, requests: RideRequest[] = []) {
  const http = TestBed.inject(HttpTestingController);
  authenticate(http);
  const harness = await RouterTestingHarness.create(`/rides/${ride.id}`);
  flushDetail(http, ride, requests);
  await harness.fixture.whenStable();
  const root = harness.routeNativeElement!.querySelector('main')!;
  return { http, harness, root };
}

function expectNoPost(http: HttpTestingController): void {
  http.expectNone({ method: 'POST', url: requestsUrl });
}

describe('Carregamento sob demanda de RideDetail', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClientTesting()],
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
      providers: [...appConfig.providers, provideHttpClientTesting()],
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
    authenticate(http, '008', role);
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
    authenticate(http, '009');
    staleConfirmation.click();
    await harness.fixture.whenStable();
    expectRequestRead(http, '007', '009').flush([]);
    await harness.fixture.whenStable();

    expect(button(root, openLabel).getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector(panelSelector)).toBeNull();
    expectNoPost(http);
  });

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

      expectRequestRead(http).flush([
        previous,
        makeRequest({ id: 'other-ride', rideId: '7' }),
        makeRequest({ id: 'other-passenger', passengerId: '8' }),
      ]);
      const offer = http.expectOne({ method: 'GET', url: `${ridesUrl}/007` });
      expectNoPost(http);
      offer.flush(ride);

      const post = http.expectOne({ method: 'POST', url: requestsUrl });
      expect(post.request.body).toEqual({
        rideId: '007',
        passengerId: '008',
        status: 'pending',
        createdAt: expect.any(String),
      });
      expect(Number.isNaN(Date.parse(post.request.body.createdAt))).toBe(false);
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
      http.expectOne({ method: 'GET', url: `${ridesUrl}/007` }).flush(makeRide(fields));
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
      expectRequestRead(http).flush([
        makeRequest({ status }),
        makeRequest({
          id: 'request-2',
          status: 'cancelled',
          createdAt: '2026-01-02T08:00:00.000Z',
        }),
      ]);
      http.expectOne({ method: 'GET', url: `${ridesUrl}/007` }).flush(ride);
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
    http.expectOne({ method: 'GET', url: `${ridesUrl}/007` }).flush(ride);
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
    http.expectOne({ method: 'GET', url: `${ridesUrl}/009` }).flush(otherRide);
    const secondPost = http.expectOne({ method: 'POST', url: requestsUrl });
    secondPost.flush(makeRequest({ rideId: '009' }));
    firstPost.flush(makeRequest({ id: 'request-2' }));
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
    http.expectOne({ method: 'GET', url: `${ridesUrl}/007` }).flush(ride);
    const post = http.expectOne({ method: 'POST', url: requestsUrl });
    const repeated = firstValueFrom(TestBed.inject(RideRequestData).createRequest(ride.id));
    http.expectNone((request) => request.url === requestsUrl);
    http.expectNone(`${ridesUrl}/007`);

    await harness.navigateByUrl('/rides/my-trips');
    await harness.navigateByUrl('/rides/007');
    flushRide(http, ride);
    http.expectNone((request) => request.url === requestsUrl);
    await harness.fixture.whenStable();
    expect(findButton(root, openLabel)).toBeUndefined();

    const request = makeRequest();
    post.flush(request);
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
    expectRequestRead(http).flush([previous]);
    const revalidation = http.expectOne({ method: 'GET', url: `${ridesUrl}/007` });

    await harness.navigateByUrl('/rides/my-trips');
    await harness.navigateByUrl('/rides/007');
    flushRide(http, ride);
    http.expectNone((request) => request.url === requestsUrl);
    await harness.fixture.whenStable();
    expect(root.textContent).toContain('1 de 2 vagas livres');
    expect(findButton(root, openLabel)).toBeUndefined();

    revalidation.flush(makeRide({ availableSeats: 0, status: 'full' }));
    await harness.fixture.whenStable();
    const history = expectRequestRead(http);
    expect(root.textContent).toContain('0 de 2 vagas livres');
    expect(root.textContent).toContain('Todas as vagas desta carona foram preenchidas.');
    expect(root.textContent).toContain('Consultando sua solicitação');
    history.flush([previous]);
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
        operation = http.expectOne({ method: 'GET', url: `${ridesUrl}/${ride.id}` });
      }
      if (step === 'envio') {
        operation.flush(ride);
        operation = http.expectOne({ method: 'POST', url: requestsUrl });
        await harness.navigateByUrl('/rides/my-trips');
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
    http.expectOne({ method: 'GET', url: `${ridesUrl}/${ride.id}` }).flush(ride);
    const post = http.expectOne({ method: 'POST', url: requestsUrl });

    const auth = TestBed.inject(AuthData);
    auth.logout();
    authenticate(http);
    const newSession = auth.currentUser();
    await harness.fixture.whenStable();
    expectRequestRead(http).flush([]);
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
    const offer = http.expectOne({ method: 'GET', url: `${ridesUrl}/007` });

    TestBed.inject(AuthData).logout();
    authenticate(http, '009');
    offer.flush(ride);
    await harness.fixture.whenStable();
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
    http.expectOne({ method: 'GET', url: `${ridesUrl}/007` }).flush(ride);
    const post = http.expectOne({ method: 'POST', url: requestsUrl });
    if (connectionLost) post.error(new ProgressEvent('error'));
    else post.flush(null, { status: 500, statusText: 'Server Error' });
    await harness.fixture.whenStable();

    expect(
      root.querySelector(panelSelector)?.querySelector('[role="alert"]')?.textContent,
    ).toContain(message);
    expect(root.textContent).not.toContain('Aguardando aprovação do motorista');
    expect(button(root, confirmLabel).disabled).toBe(false);
    expectNoPost(http);
  });
});
