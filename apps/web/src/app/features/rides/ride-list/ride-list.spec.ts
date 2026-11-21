import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../../environments/environment';
import { appConfig } from '../../../app.config';
import { routes } from '../../../app.routes';
import { Notification } from '../../../core/models/notification.model';
import { Ride } from '../../../core/models/ride.model';
import { AuthData } from '../../../core/services/auth-data';
import { ErrorNotice } from '../../../core/services/error-notice';
import { RidesLayout } from '../rides-layout/rides-layout';
import { RideList } from './ride-list';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date(2030, 4, 9, 18));
});

afterEach(() => vi.useRealTimers());

@Component({ template: '' })
class MyTripsTestPage {}

@Component({ template: '' })
class RideDetailTestPage {
  readonly id = input.required<string>();
}

function authenticatePassenger(
  http: HttpTestingController,
  user: { id: string; name: string; email: string },
): void {
  const auth = TestBed.inject(AuthData);
  auth.login(user.email, 'senha123');
  http.expectOne((request) => request.url === `${environment.apiUrl}/users`).flush([
    {
      id: user.id,
      name: user.name,
      email: user.email,
      password: 'senha123',
      registrationNumber: '2020999',
      whatsapp: '41988887777',
      role: 'student',
      isBlocked: false,
      isEmailConfirmed: true,
      ratingAverage: 4.9,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ]);
}

function locationRequest(http: HttpTestingController) {
  return http.expectOne(municipalitiesUrl);
}

const municipalitiesUrl =
  'https://servicodados.ibge.gov.br/api/v1/localidades/estados/PR/municipios?orderBy=nome';

describe('Navegação aninhada de caronas (CA1 e CA4)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClientTesting()],
    });
  });

  it('habilita o binding de parâmetros de rota em inputs na configuração da aplicação', () => {
    expect(TestBed.inject(Router).componentInputBindingEnabled).toBe(true);
  });

  it('renderiza a busca no outlet do layout e navega sem colisão para Viagens e para o detalhe', async () => {
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    // Exercita a árvore real de rotas com destinos de teste sem dependências de dados.
    router.resetConfig(
      router.config.map((route) => {
        if (route.path !== 'rides') return route;

        return {
          ...route,
          children: route.children?.map((child) => {
            if (child.path === 'my-trips') {
              return { ...child, loadComponent: () => MyTripsTestPage };
            }
            if (child.path === ':id') {
              return { ...child, loadComponent: () => RideDetailTestPage };
            }
            return child;
          }),
        };
      }),
    );
    authenticatePassenger(http, {
      id: 'passenger-1',
      name: 'Mariana Silva',
      email: 'mariana@alunos.utfpr.edu.br',
    });

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/rides', RidesLayout);
    const layout = harness.routeNativeElement!;
    const outlet = harness.routeDebugElement!
      .query(By.directive(RouterOutlet))
      .injector.get(RouterOutlet);
    expect(outlet.activatedRoute.routeConfig?.path).toBe('');
    expect(outlet.component).toBeInstanceOf(RideList);

    const links = [...layout.querySelectorAll<HTMLAnchorElement>('nav[aria-label] a')];
    expect(
      links.map((link) => [
        link.querySelector('span:not([aria-hidden])')?.textContent?.trim(),
        link.getAttribute('href'),
      ]),
    ).toEqual([
      ['Buscar', '/rides'],
      ['Oferecer', '/driver/offer'],
      ['Ofertas', '/driver/my-rides'],
      ['Viagens', '/rides/my-trips'],
    ]);
    expect([...layout.querySelectorAll('nav [aria-current="page"]')]).toEqual([links[0]]);

    links[3].click();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/rides/my-trips');
    expect(outlet.activatedRoute.routeConfig?.path).toBe('my-trips');
    expect(outlet.component).toBeInstanceOf(MyTripsTestPage);
    expect(harness.routeNativeElement).toBe(layout);
    expect([...layout.querySelectorAll('nav [aria-current="page"]')]).toEqual([links[3]]);

    await harness.navigateByUrl('/rides/ride-123');
    expect(outlet.activatedRoute.routeConfig?.path).toBe(':id');
    const detail = outlet.component as RideDetailTestPage;
    expect(detail).toBeInstanceOf(RideDetailTestPage);
    expect(detail.id()).toBe('ride-123');
    expect(harness.routeNativeElement).toBe(layout);
    expect([...layout.querySelectorAll('nav [aria-current="page"]')]).toEqual([links[0]]);
    http.verify();
  });

  it.each(['/rides', '/rides/my-trips', '/rides/ride-123'])(
    'redireciona o visitante de %s para /login',
    async (url) => {
      await RouterTestingHarness.create(url);
      expect(TestBed.inject(Router).url).toBe('/login');
    },
  );

  it('volta a verificar a autenticação ao trocar de rota filha', async () => {
    const http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthData);
    authenticatePassenger(http, {
      id: 'passenger-1',
      name: 'Mariana Silva',
      email: 'mariana@alunos.utfpr.edu.br',
    });

    const harness = await RouterTestingHarness.create('/rides');
    auth.logout();
    await harness.navigateByUrl('/rides/my-trips');
    expect(TestBed.inject(Router).url).toBe('/login');
    http.verify();
  });
});

describe('Cabeçalho autenticado, navegação e avisos internos (CA8)', () => {
  it('posiciona o sino à esquerda da foto do aluno no cabeçalho e exibe apenas os avisos do passageiro autenticado (confirmado ou anteriormente pendente), sem exibir avisos de outro aluno', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);

    authenticatePassenger(http, {
      id: 'passenger-1',
      name: 'Mariana Silva',
      email: 'mariana@alunos.utfpr.edu.br',
    });

    const harness = await RouterTestingHarness.create('/rides');
    const root = harness.routeNativeElement as HTMLElement;

    const header = root.querySelector('header');
    expect(header).not.toBeNull();

    const bellButton = header!.querySelector<HTMLButtonElement>(
      '[data-testid="notification-bell-button"]',
    );
    const avatar = header!.querySelector<HTMLElement>('[data-testid="student-avatar"]');
    expect(bellButton).not.toBeNull();
    expect(avatar).not.toBeNull();
    expect(avatar!.textContent?.trim()).toBe('MS');
    expect(
      Boolean(bellButton!.compareDocumentPosition(avatar!) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);

    // Abre o sino de notificações
    bellButton!.click();

    const notificationsPayload: Notification[] = [
      {
        id: 'notif-confirmed',
        recipientId: 'Mariana Silva',
        rideId: 'ride-confirmed',
        message: 'A carona Batel → UTFPR Neoville foi cancelada pelo motorista.',
        createdAt: '2026-01-01T10:00:00.000Z',
      },
      {
        id: 'notif-pending',
        recipientId: 'passenger-1',
        rideId: 'ride-pending',
        message: 'A carona Portão → UTFPR Sede Centro foi cancelada pelo motorista.',
        createdAt: '2026-01-01T10:05:00.000Z',
      },
      {
        id: 'notif-other-student',
        recipientId: 'Pedro Henrique',
        rideId: 'ride-other',
        message: 'A carona Água Verde → UTFPR Ecoville foi cancelada pelo motorista.',
        createdAt: '2026-01-01T10:10:00.000Z',
      },
    ];

    http
      .expectOne(
        (req) => req.url === `${environment.apiUrl}/notifications` && req.method === 'GET',
      )
      .flush(notificationsPayload);
    await harness.fixture.whenStable();

    const panel = root.querySelector<HTMLElement>('[data-testid="notifications-panel"]');
    expect(panel).not.toBeNull();
    expect(panel!.textContent).toContain(
      'A carona Batel → UTFPR Neoville foi cancelada pelo motorista.',
    );
    expect(panel!.textContent).toContain(
      'A carona Portão → UTFPR Sede Centro foi cancelada pelo motorista.',
    );
    expect(panel!.textContent).not.toContain('Água Verde → UTFPR Ecoville');

    // Quando outro aluno com pedido anteriormente pendente entra e abre o sino, vê apenas o próprio aviso
    authenticatePassenger(http, {
      id: 'passenger-2',
      name: 'Lucas Andrade',
      email: 'lucas@alunos.utfpr.edu.br',
    });
    await harness.fixture.whenStable();

    // Antes mesmo da nova resposta, não pode exibir os avisos da aluna anterior
    expect(panel!.textContent).not.toContain('Batel → UTFPR Neoville');
    expect(panel!.textContent).not.toContain('Portão → UTFPR Sede Centro');

    // Fecha e reabre o sino como Lucas Andrade
    bellButton!.click();
    await harness.fixture.whenStable();
    bellButton!.click();

    http
      .expectOne(
        (req) => req.url === `${environment.apiUrl}/notifications` && req.method === 'GET',
      )
      .flush([
        ...notificationsPayload,
        {
          id: 'notif-lucas-pending',
          recipientId: 'Lucas Andrade',
          rideId: 'ride-confirmed',
          message: 'A carona Bacacheri → UTFPR Neoville foi cancelada pelo motorista.',
          createdAt: '2026-01-01T10:15:00.000Z',
        },
      ]);
    await harness.fixture.whenStable();

    const reopenedPanel = root.querySelector<HTMLElement>('[data-testid="notifications-panel"]');
    expect(reopenedPanel).not.toBeNull();
    expect(reopenedPanel!.textContent).toContain(
      'A carona Bacacheri → UTFPR Neoville foi cancelada pelo motorista.',
    );
    expect(reopenedPanel!.textContent).not.toContain('Batel → UTFPR Neoville');
    expect(reopenedPanel!.textContent).not.toContain('Portão → UTFPR Sede Centro');
    expect(reopenedPanel!.textContent).not.toContain('Água Verde → UTFPR Ecoville');

    http.verify();
  });

  it('permite navegar da busca de caronas para /driver/offer e /driver/my-rides e mantém o sino no cabeçalho dessas telas', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);

    authenticatePassenger(http, {
      id: 'driver-1',
      name: 'Carlos Motorista',
      email: 'motorista@alunos.utfpr.edu.br',
    });

    const harness = await RouterTestingHarness.create('/rides');
    const ridesRoot = harness.routeNativeElement as HTMLElement;
    expect(ridesRoot.textContent).toContain('Caronas disponíveis');

    const offerLink = ridesRoot.querySelector<HTMLAnchorElement>('a[href="/driver/offer"]');
    expect(offerLink).not.toBeNull();
    offerLink!.click();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/driver/offer');

    const offerRoot = harness.routeNativeElement as HTMLElement;
    expect(
      offerRoot.querySelector('header [data-testid="notification-bell-button"]'),
    ).not.toBeNull();
    expect(offerRoot.querySelector('header [data-testid="student-avatar"]')).not.toBeNull();

    const myRidesLink = offerRoot.querySelector<HTMLAnchorElement>('a[href="/driver/my-rides"]');
    expect(myRidesLink).not.toBeNull();
    myRidesLink!.click();
    await harness.fixture.whenStable();

    http
      .expectOne(
        (req) =>
          req.url === `${environment.apiUrl}/rides` && req.params.get('driverId') === 'driver-1',
      )
      .flush([]);
    await harness.fixture.whenStable();
    expect(router.url).toBe('/driver/my-rides');

    const myRidesRoot = harness.routeNativeElement as HTMLElement;
    const myRidesBell = myRidesRoot.querySelector<HTMLButtonElement>(
      'header [data-testid="notification-bell-button"]',
    );
    expect(myRidesBell).not.toBeNull();
    expect(myRidesRoot.querySelector('header [data-testid="student-avatar"]')).not.toBeNull();

    myRidesBell!.click();
    http
      .expectOne(
        (req) => req.url === `${environment.apiUrl}/notifications` && req.method === 'GET',
      )
      .flush([]);
    await harness.fixture.whenStable();

    expect(myRidesRoot.querySelector('[data-testid="notifications-panel"]')?.textContent).toContain(
      'Você não possui avisos no momento.',
    );

    http.verify();
  });

  it('exibe falha de conexão (status 0) e erro inesperado ao abrir o sino em /rides sem mostrar estado vazio falso e permite tentar novamente', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const errorNotice = TestBed.inject(ErrorNotice);

    authenticatePassenger(http, {
      id: 'passenger-1',
      name: 'Mariana Silva',
      email: 'mariana@alunos.utfpr.edu.br',
    });

    const harness = await RouterTestingHarness.create('/rides');
    const root = harness.routeNativeElement as HTMLElement;
    const bellButton = root.querySelector<HTMLButtonElement>(
      '[data-testid="notification-bell-button"]',
    )!;

    // 1. Falha de conexão (status === 0)
    bellButton.click();
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/notifications` && req.method === 'GET')
      .error(new ProgressEvent('error'));
    await harness.fixture.whenStable();

    expect(errorNotice.message()).toContain('Falha de conexão');
    expect(root.querySelector('[data-testid="notifications-error"]')?.textContent).toContain(
      'Falha de conexão',
    );
    expect(root.querySelector('[data-testid="empty-notifications"]')).toBeNull();
    expect(root.querySelector('[data-testid="notifications-panel"]')?.textContent).not.toContain(
      'Você não possui avisos no momento.',
    );

    // 2. Fecha e reabre para tentar novamente -> erro inesperado não-HTTP
    bellButton.click();
    await harness.fixture.whenStable();
    bellButton.click();
    expect(errorNotice.message()).toBe('');

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/notifications` && req.method === 'GET')
      .flush({});
    await harness.fixture.whenStable();

    expect(errorNotice.message()).toContain('Falha inesperada');
    expect(root.querySelector('[data-testid="notifications-error"]')?.textContent).toContain(
      'Não foi possível carregar os avisos',
    );
    expect(root.querySelector('[data-testid="empty-notifications"]')).toBeNull();

    // 3. Fecha e reabre novamente -> sucesso exibe os avisos reais e limpa o erro
    bellButton.click();
    await harness.fixture.whenStable();
    bellButton.click();
    expect(errorNotice.message()).toBe('');

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/notifications` && req.method === 'GET')
      .flush([
        {
          id: 'notif-1',
          recipientId: 'passenger-1',
          rideId: 'ride-1',
          message: 'A carona Batel → UTFPR Neoville foi cancelada pelo motorista.',
          createdAt: '2026-01-01T10:00:00.000Z',
        },
      ]);
    await harness.fixture.whenStable();

    expect(root.querySelector('[data-testid="notifications-error"]')).toBeNull();
    expect(root.querySelector('[data-testid="notification-item"]')?.textContent).toContain(
      'Batel → UTFPR Neoville',
    );

    http.verify();
  });

  it('reflete falhas de carregamento dos avisos no sino também nas telas /driver/offer e /driver/my-rides', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const errorNotice = TestBed.inject(ErrorNotice);

    authenticatePassenger(http, {
      id: 'driver-1',
      name: 'Carlos Motorista',
      email: 'motorista@alunos.utfpr.edu.br',
    });

    // /driver/offer com status 0
    const harness = await RouterTestingHarness.create('/driver/offer');
    const offerRoot = harness.routeNativeElement as HTMLElement;
    const offerBell = offerRoot.querySelector<HTMLButtonElement>(
      'header [data-testid="notification-bell-button"]',
    )!;
    offerBell.click();
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/notifications` && req.method === 'GET')
      .error(new ProgressEvent('error'));
    await harness.fixture.whenStable();

    expect(errorNotice.message()).toContain('Falha de conexão');
    expect(offerRoot.querySelector('[data-testid="notifications-error"]')?.textContent).toContain(
      'Falha de conexão',
    );
    expect(offerRoot.querySelector('[data-testid="empty-notifications"]')).toBeNull();

    // /driver/my-rides com erro inesperado não-HTTP
    await harness.navigateByUrl('/driver/my-rides');
    const myRidesRoot = harness.routeNativeElement as HTMLElement;
    http
      .expectOne(
        (req) =>
          req.url === `${environment.apiUrl}/rides` && req.params.get('driverId') === 'driver-1',
      )
      .flush([]);
    await harness.fixture.whenStable();

    const myRidesBell = myRidesRoot.querySelector<HTMLButtonElement>(
      'header [data-testid="notification-bell-button"]',
    )!;
    myRidesBell.click();
    expect(errorNotice.message()).toBe('');

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/notifications` && req.method === 'GET')
      .flush({});
    await harness.fixture.whenStable();

    expect(errorNotice.message()).toContain('Falha inesperada');
    expect(myRidesRoot.querySelector('[data-testid="notifications-error"]')?.textContent).toContain(
      'Não foi possível carregar os avisos',
    );
    expect(myRidesRoot.querySelector('[data-testid="empty-notifications"]')).toBeNull();

    http.verify();
  });
});

describe('Busca de caronas (CA1, CA3 e CA11)', () => {
  const debounceMs = 250;
  const ridesUrl = `${environment.apiUrl}/rides`;
  const driverSummariesUrl = `${environment.apiUrl}/driver-summaries`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClientTesting()],
    });
  });

  async function openSearch() {
    const http = TestBed.inject(HttpTestingController);
    authenticatePassenger(http, {
      id: 'passenger-1',
      name: 'Mariana Silva',
      email: 'mariana@alunos.utfpr.edu.br',
    });
    const harness = await RouterTestingHarness.create('/rides');
    http.expectNone(municipalitiesUrl);
    return { harness, root: harness.routeNativeElement!, http };
  }

  function openFilters(root: HTMLElement, harness: RouterTestingHarness): void {
    const filtersButton = [...root.querySelectorAll('button')].find(
      (button) => button.textContent?.includes('Filtros'),
    );
    expect(filtersButton).toBeDefined();
    expect(filtersButton!.getAttribute('aria-expanded')).toBe('false');
    const panel = root.querySelector<HTMLElement>('#ride-search-filters')!;
    expect(panel.hidden).toBe(true);
    filtersButton!.click();
    harness.detectChanges();
    expect(filtersButton!.getAttribute('aria-expanded')).toBe('true');
    expect(panel.hidden).toBe(false);
  }

  function searchRequest(http: HttpTestingController) {
    TestBed.tick();
    vi.advanceTimersByTime(debounceMs);
    return http.expectOne((request) => request.url === ridesUrl && request.method === 'GET');
  }

  function fields(root: HTMLElement) {
    const origin = root.querySelector<HTMLInputElement>('#ride-search-origin')!;
    const destination = root.querySelector<HTMLInputElement>('#ride-search-destination')!;
    const date = root.querySelector<HTMLInputElement>('#ride-search-date')!;
    return { origin, destination, date };
  }

  function enterValue(field: HTMLInputElement, value: string): void {
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('carrega as sugestões ao renderizar os filtros e mantém os valores ao reabrir o painel', async () => {
    const { harness, root, http } = await openSearch();
    const button = root.querySelector<HTMLButtonElement>(
      '[aria-controls="ride-search-filters"]',
    )!;

    button.click();
    http.expectNone(municipalitiesUrl);
    await harness.fixture.whenStable();
    locationRequest(http).flush([{ nome: 'Curitiba' }]);
    await harness.fixture.whenStable();

    const { origin, destination, date } = fields(root);
    enterValue(origin, 'Curitiba');
    enterValue(destination, 'Pinhais');
    enterValue(date, '2030-05-10');

    button.click();
    await harness.fixture.whenStable();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    button.click();
    await harness.fixture.whenStable();
    expect(button.getAttribute('aria-expanded')).toBe('true');

    const reopened = fields(root);
    expect([reopened.origin.value, reopened.destination.value, reopened.date.value]).toEqual([
      'Curitiba',
      'Pinhais',
      '2030-05-10',
    ]);
    expect(reopened.origin.list?.options[0]?.value).toBe('Curitiba');
    http.expectNone(municipalitiesUrl);
    http.verify();
  });

  it('consulta a partir dos campos, oferece sugestões e limpa os três filtros após um resultado vazio', async () => {
    const { harness, root, http } = await openSearch();
    openFilters(root, harness);
    locationRequest(http).flush([{ nome: 'Curitiba' }, { nome: 'Pinhais' }]);
    harness.detectChanges();

    const { origin, destination, date } = fields(root);
    expect([...origin.list!.options].map((option) => option.value)).toEqual(['Curitiba', 'Pinhais']);
    expect(destination.list).toBe(origin.list);
    expect([origin.required, destination.required, date.required]).toEqual([false, false, false]);

    const ride: Ride = {
      id: 'ride-another-day',
      driverId: 'driver-2',
      origin: 'Curitiba',
      destination: 'UTFPR - Sede Centro',
      departureTime: new Date(2030, 4, 11, 8).toISOString(),
      totalSeats: 2,
      availableSeats: 2,
      pricePerSeat: 12,
      status: 'active',
      createdAt: new Date(2030, 4, 9, 16).toISOString(),
    };

    enterValue(origin, 'Curitiba');
    enterValue(destination, 'UTFPR - Sede Centro');
    enterValue(date, '2030-05-10');
    const request = searchRequest(http);
    expect(request.request.params.get('_where')).toContain('"contains":"curitiba"');
    expect(request.request.params.get('_where')).toContain('"contains":"utfpr - sede centro"');
    harness.detectChanges();
    expect(root.textContent).toContain('Buscando caronas');
    expect(root.textContent).not.toContain('Nenhuma carona');
    request.flush([ride]);
    harness.detectChanges();
    expect(root.textContent).not.toContain('Buscando caronas');
    expect(root.textContent).toContain('Nenhuma carona');

    const clear = [...root.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Limpar filtros',
    )!;
    clear.click();
    harness.detectChanges();
    expect([origin.value, destination.value, date.value]).toEqual(['', '', '']);

    const cleared = searchRequest(http);
    expect(cleared.request.params.get('_where')).not.toContain('contains');
    cleared.flush([ride]);
    http
      .expectOne((query) => query.url === driverSummariesUrl && query.method === 'GET')
      .flush([{ id: 'driver-2', name: 'Camila Rocha', ratingAverage: 4.9 }]);
    harness.detectChanges();
    const card = root.querySelector('article')!;
    expect(card.textContent).toContain('Curitiba');
    expect(card.textContent).toContain('UTFPR - Sede Centro');
    expect(card.textContent).toContain('11/05/2030');
    expect(card.textContent).toContain('Camila Rocha');
    expect(card.textContent).toContain('4,9');
    expect(card.textContent).toContain('2 vagas');
    expect(card.textContent).toContain('R$ 12,00');
    expect(root.textContent).not.toContain('Nenhuma carona');
    http.verify();
  });

  it('busca em texto livre quando as sugestões falham e descarta os filtros ao navegar', async () => {
    const { harness, root, http } = await openSearch();
    openFilters(root, harness);
    locationRequest(http).error(new ProgressEvent('error'));
    const { origin, destination, date } = fields(root);
    expect(origin.list?.options.length ?? 0).toBe(0);
    expect(destination.list?.options.length ?? 0).toBe(0);
    enterValue(origin, 'Portão (Terminal)');
    enterValue(destination, 'Campus');
    enterValue(date, '2030-05-10');

    const pending = searchRequest(http);
    expect(pending.request.params.get('_where')).toContain('"contains":"portão (terminal)"');

    await harness.navigateByUrl('/rides/my-trips');
    expect(pending.cancelled).toBe(true);
    http
      .expectOne({
        method: 'GET',
        url: `${environment.apiUrl}/passenger-trip-summaries?passengerId=passenger-1`,
      })
      .flush([]);
    await harness.navigateByUrl('/rides');
    openFilters(root, harness);
    const returned = fields(root);
    expect([returned.origin.value, returned.destination.value, returned.date.value]).toEqual([
      '', '', '',
    ]);
    const request = searchRequest(http);
    expect(request.request.params.get('_where')).not.toContain('contains');
    request.flush([]);
    harness.detectChanges();
    expect(root.textContent).toContain('Nenhuma carona');
    http.expectNone((query) => query.method !== 'GET');
    http.verify();
  });

  it('abre o detalhe real pelo cartão, mostra os dados e consulta a própria solicitação (CA4)', async () => {
    const { harness, root, http } = await openSearch();
    const ride: Ride = {
      id: '007',
      driverId: 'driver-2',
      origin: 'Praça do Japão',
      destination: 'UTFPR - Sede Centro',
      departureTime: new Date(2030, 4, 11, 8, 15).toISOString(),
      totalSeats: 3,
      availableSeats: 2,
      pricePerSeat: 7.5,
      status: 'active',
      notes: 'Em frente à farmácia',
      createdAt: new Date(2030, 4, 9, 16).toISOString(),
    };
    const driver = { id: 'driver-2', name: 'Camila Rocha', ratingAverage: 4.9 };
    searchRequest(http).flush([ride]);
    http.expectOne((request) => request.url === driverSummariesUrl).flush([driver]);
    await harness.fixture.whenStable();

    const detailLink = root.querySelector<HTMLAnchorElement>('article a[href="/rides/007"]');
    expect(detailLink).not.toBeNull();
    expect(detailLink!.textContent).toContain('Ver detalhes');
    detailLink!.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/rides/007');
    expect(harness.routeNativeElement).toBe(root);

    http.expectOne({ url: `${ridesUrl}/007`, method: 'GET' }).flush(ride);
    const driverSummary = http.expectOne((request) => request.url === driverSummariesUrl);
    expect(driverSummary.request.params.getAll('id')).toEqual(['driver-2']);
    driverSummary.flush([driver]);

    await harness.fixture.whenStable();
    const details = root.querySelector('main')!;
    expect(details.textContent).toContain('Detalhes da Viagem');
    expect(details.textContent).toContain('Praça do Japão');
    expect(details.textContent).toContain('UTFPR - Sede Centro');
    const departure = details.querySelector('time');
    expect(departure?.dateTime).toBe(ride.departureTime);
    expect(departure?.textContent).toContain('08:15');
    expect(departure?.textContent).toContain('11/05/2030');
    expect(details.textContent).toContain('Em frente à farmácia');
    expect(details.textContent).toContain('2 de 3 vagas livres');
    expect(details.textContent).toContain('R$ 7,50');
    expect(details.textContent).toContain('Camila Rocha');
    expect(details.querySelector('[data-testid="driver-initials"]')?.textContent?.trim()).toBe(
      'CR',
    );
    expect(details.textContent).toContain('4,9');
    expect(details.textContent).toContain('Carona ativa');
    expect(details.textContent).toContain('Consultando sua solicitação');
    expect(details.textContent).not.toContain('Você ainda não solicitou');

    http
      .expectOne((request) => request.url === `${environment.apiUrl}/ride_requests`)
      .flush([
        {
          id: 'request-1',
          rideId: '007',
          passengerId: 'passenger-1',
          status: 'pending',
          createdAt: ride.createdAt,
        },
      ]);
    await harness.fixture.whenStable();
    expect(details.textContent).toContain('Aguardando aprovação do motorista');
    expect(details.textContent).not.toContain('Consultando sua solicitação');

    await harness.navigateByUrl('/rides/full-ride');
    expect(details.textContent).toContain('Carregando detalhes');
    expect(details.textContent).not.toContain('Aguardando aprovação do motorista');
    expect(details.textContent).not.toContain('Praça do Japão');
    http.expectOne({ url: `${ridesUrl}/full-ride`, method: 'GET' }).flush({
      ...ride,
      id: 'full-ride',
      origin: 'Batel',
      availableSeats: 0,
      status: 'full',
      notes: undefined,
    });
    http.expectOne((request) => request.url === driverSummariesUrl).flush([driver]);
    http
      .expectOne((request) => request.url === `${environment.apiUrl}/ride_requests`)
      .error(new ProgressEvent('error'));
    await harness.fixture.whenStable();
    expect(details.textContent).toContain('Batel');
    expect(details.textContent).toContain('Carona lotada');
    expect(details.textContent).toContain('Não foi possível consultar sua solicitação');
    expect(details.textContent).not.toContain('Você ainda não solicitou');

    await harness.navigateByUrl('/rides/another-ride');
    http.expectOne({ url: `${ridesUrl}/another-ride`, method: 'GET' }).flush({
      ...ride,
      id: 'another-ride',
      notes: undefined,
    });
    http.expectOne((request) => request.url === driverSummariesUrl).flush([driver]);
    http.expectOne((request) => request.url === `${environment.apiUrl}/ride_requests`).flush([]);
    await harness.fixture.whenStable();
    expect(details.textContent).toContain('Você ainda não solicitou uma vaga');
    expect(details.textContent).not.toContain('Ponto de referência');
    http.expectNone((request) => request.method !== 'GET' || request.url.endsWith('/users'));
    http.verify();
  });

  it('apresenta falha de busca sem confundi-la com lista vazia', async () => {
    const { harness, root, http } = await openSearch();
    openFilters(root, harness);
    locationRequest(http).flush([]);
    searchRequest(http).error(new ProgressEvent('error'));
    harness.detectChanges();

    expect(root.textContent).toContain('Não foi possível carregar as caronas.');
    expect(root.textContent).not.toContain('Nenhuma carona');

    enterValue(fields(root).origin, 'Batel');
    searchRequest(http).flush([]);
    harness.detectChanges();
    expect(root.textContent).not.toContain('Não foi possível carregar as caronas.');
    expect(root.textContent).toContain('Nenhuma carona');
    http.verify();
  });

  it.each([
    [0, 'Falha de conexão'],
    [404, 'Não foi possível carregar as caronas'],
  ] as const)('repete a busca com os mesmos filtros após a falha %s (CA10)', async (status, message) => {
    const { harness, root, http } = await openSearch();
    openFilters(root, harness);
    locationRequest(http).flush([]);
    const { origin, destination, date } = fields(root);
    enterValue(origin, 'Batel');
    enterValue(destination, 'UTFPR');
    enterValue(date, '2030-05-10');
    const first = searchRequest(http);
    if (status === 0) first.error(new ProgressEvent('error'));
    else first.flush(null, { status, statusText: 'Not Found' });
    harness.detectChanges();

    expect(root.querySelector('main [role="alert"]')?.textContent).toContain(message);
    expect(root.textContent).not.toContain('Nenhuma carona');
    const retry = [...root.querySelectorAll('button')].find(
      (item) => item.textContent?.trim() === 'Tentar novamente',
    );
    expect(retry).toBeDefined();
    retry!.click();
    retry!.click();
    expect(root.querySelector<HTMLInputElement>('#ride-search-date')?.value).toBe('2030-05-10');
    const repeated = searchRequest(http);
    expect(repeated.request.params.get('_where')).toBe(first.request.params.get('_where'));
    harness.detectChanges();
    expect(root.textContent).toContain('Buscando caronas');
    expect(root.querySelector('main [role="alert"]')).toBeNull();
    repeated.flush([]);
    harness.detectChanges();
    expect(root.textContent).toContain('Nenhuma carona');
    http.expectNone((request) => request.method !== 'GET');
    http.verify();
  });

  it('restringe a busca e o tratamento de sessão expirada à sessão que solicitou os dados', async () => {
    const { harness, http } = await openSearch();
    const accepted = searchRequest(http);
    const auth = TestBed.inject(AuthData);
    auth.logout();
    authenticatePassenger(http, {
      id: 'passenger-1',
      name: 'Mariana Silva',
      email: 'mariana@alunos.utfpr.edu.br',
    });
    accepted.flush([{
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: new Date(2030, 4, 10, 8).toISOString(),
      totalSeats: 2,
      availableSeats: 2,
      pricePerSeat: 7,
      status: 'active',
      createdAt: new Date(2030, 4, 9, 16).toISOString(),
    } satisfies Ride]);
    http.expectNone((request) => request.url === driverSummariesUrl);

    searchRequest(http).flush(null, { status: 401, statusText: 'Unauthorized' });
    await harness.fixture.whenStable();
    expect(auth.currentUser()).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(TestBed.inject(ErrorNotice).message()).toContain('Faça login');
    http.verify();
  });
});
