import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../../environments/environment';
import { appConfig } from '../../../app.config';
import { routes } from '../../../app.routes';
import { Notification } from '../../../core/models/notification.model';
import { AuthData } from '../../../core/services/auth-data';
import { ErrorNotice } from '../../../core/services/error-notice';
import { RidesLayout } from '../rides-layout/rides-layout';
import { RideList } from './ride-list';

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

  it('permite navegar de /rides para /driver/offer e /driver/my-rides sem implementar a pesquisa da US03 e mantém o sino no cabeçalho dessas telas', async () => {
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
    expect(ridesRoot.textContent).toContain('A busca de caronas estará disponível em breve.');

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
