import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../../environments/environment';
import { appConfig } from '../../../app.config';
import { RideRequest } from '../../../core/models/ride-request.model';
import { User } from '../../../core/models/user.model';
import { AuthData } from '../../../core/services/auth-data';
import { SUPABASE_AUTH_CLIENT, SupabaseAuthClient } from '../../../core/services/supabase-client';

const summariesUrl = `${environment.apiUrl}/passenger-trip-summaries`;
const requestsUrl = `${environment.apiUrl}/ride_requests`;
const date = new Date(2030, 4, 10, 8, 15).toISOString();
const driver = { name: 'Camila Rocha', ratingAverage: 4.9 };
const ride = {
  origin: 'Praça do Japão',
  destination: 'UTFPR - Sede Centro',
  departureTime: date,
  pricePerSeat: 7.5,
  status: 'active',
};
const pending: RideRequest = {
  id: '009',
  rideId: '008',
  passengerId: '007',
  status: 'pending',
  createdAt: date,
};
const pendingTrip = { id: pending.id, status: pending.status, driver, ride };

function findButton(root: HTMLElement, label: string): HTMLButtonElement {
  const button = [...root.querySelectorAll('button')].find((item) =>
    item.textContent?.includes(label),
  );
  if (!button) throw new Error(`Botão ausente "${label}"`);
  return button;
}

function expectCancellationPatch(http: HttpTestingController) {
  const patch = http.expectOne(
    (request) => request.method === 'PATCH' && request.url === `${requestsUrl}/${pending.id}`,
  );
  expect(patch.request.params.get('passengerId')).toBe(pending.passengerId);
  return patch;
}

const fakeSupabaseUser: SupabaseUser = {
  id: '007',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: date,
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

async function authenticate(http: HttpTestingController, role: User['role'] = 'student', id = '007') {
  const auth = TestBed.inject(AuthData);
  auth.login('passageiro@alunos.utfpr.edu.br', 'senha123');
  await flushMicrotasks();
  http
    .expectOne((request) => request.url === `${environment.apiUrl}/users`)
    .flush([
      {
        id,
        name: 'Ana Passageira',
        email: 'passageiro@alunos.utfpr.edu.br',
        registrationNumber: '123',
        whatsapp: '',
        role,
        isBlocked: false,
        isEmailConfirmed: true,
        ratingAverage: 0,
        createdAt: date,
      },
    ]);
  await flushMicrotasks();
  return auth;
}

describe('Minhas Viagens (CA9)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...appConfig.providers,
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  async function openTrips() {
    const harness = await RouterTestingHarness.create('/rides/my-trips');
    const root = harness.routeNativeElement!.querySelector('main')!;
    const read = http.expectOne((request) => request.url === summariesUrl);
    expect(read.request.method).toBe('GET');
    expect(read.request.params.get('passengerId')).toBe('007');
    return { root, read, harness };
  }

  it('agrupa solicitações sob o layout e mostra o WhatsApp somente em Confirmadas', async () => {
    await authenticate(http);
    const { root, read, harness } = await openTrips();
    expect(root.textContent).toContain('Carregando suas viagens');
    expect(root.textContent).not.toContain('Nenhuma viagem encontrada');
    read.flush([
      pendingTrip,
      {
        id: 'confirmed',
        status: 'accepted',
        driver,
        ride: { ...ride, origin: 'Batel', status: 'full' },
        whatsapp: '(41) 98765-1122',
      },
      { id: 'finished', status: 'accepted', driver, ride: { ...ride, status: 'completed' } },
      { id: 'ended', status: 'accepted', driver, ride: { ...ride, status: 'cancelled' } },
      { id: 'declined', status: 'rejected', driver, ride },
      { id: 'withdrawn', status: 'cancelled', driver, ride },
      { id: 'orphan', status: 'accepted', driver: null, ride: null },
    ]);
    harness.detectChanges();

    expect(root.querySelector('h1')?.textContent).toContain('Minhas Viagens');
    expect(
      harness.routeNativeElement?.querySelector('[aria-current="page"]')?.textContent,
    ).toContain('Viagens');
    const card = root.querySelector('article')!;
    expect(card.textContent).toContain('Aguardando resposta do motorista');
    expect(card.textContent).toContain('Camila Rocha');
    expect(card.textContent).toContain('4,9');
    expect(card.textContent).toContain('R$ 7,50');
    expect(card.textContent).toContain('Praça do Japão');
    expect(card.textContent).toContain('UTFPR - Sede Centro');
    expect(card.querySelector('time')?.dateTime).toBe(date);
    expect(card.textContent).not.toContain('WhatsApp');
    expect(root.querySelectorAll('article')).toHaveLength(1);

    findButton(root, 'Confirmadas').click();
    harness.detectChanges();
    expect(root.querySelectorAll('article')).toHaveLength(1);
    expect(root.querySelector('article')?.textContent).toContain('Confirmada');
    expect(root.textContent).toContain('WhatsApp: (41) 98765-1122');
    expect(root.querySelector('a[href="https://wa.me/5541987651122"]')).not.toBeNull();
    expect(root.textContent).not.toContain('Cancelar solicitação de vaga');

    findButton(root, 'Histórico').click();
    harness.detectChanges();
    const history = [...root.querySelectorAll('article')].map((item) => item.textContent);
    expect(history).toHaveLength(5);
    expect(history[0]).toContain('Concluída');
    expect(history[1]).toContain('Carona cancelada');
    expect(history[2]).toContain('Solicitação rejeitada');
    expect(history[3]).toContain('Solicitação cancelada');
    expect(history[4]).toContain('Carona indisponível');
    expect(root.textContent).not.toMatch(/WhatsApp|98765-1122|Avaliar|Denunciar/);
    expect(root.querySelector('form, a[href^="https://wa.me/"]')).toBeNull();
  });

  it('mantém o pedido em Pendentes até a API confirmar o cancelamento de apenas um pedido', async () => {
    await authenticate(http);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { root, read, harness } = await openTrips();
    read.flush([pendingTrip, { ...pendingTrip, id: '010', ride: { ...ride, origin: 'Portão' } }]);
    harness.detectChanges();

    const cancel = findButton(root, 'Cancelar solicitação de vaga');
    cancel.click();
    expect(confirm).toHaveBeenCalledOnce();
    http.expectNone((request) => request.url.startsWith(requestsUrl));
    confirm.mockReturnValue(true);
    cancel.click();
    cancel.click();
    http.expectOne({ method: 'GET', url: `${requestsUrl}/009` }).flush(pending);
    const patch = expectCancellationPatch(http);
    expect(patch.request.body).toEqual({ status: 'cancelled' });
    http.expectNone((request) => request.url.startsWith(requestsUrl));

    harness.detectChanges();
    expect(root.querySelectorAll('article')).toHaveLength(2);
    expect(cancel.disabled).toBe(true);
    expect(root.textContent).toContain('Aguardando resposta do motorista');

    patch.flush({ ...pending, status: 'cancelled' });
    http.expectOne((request) => request.url === summariesUrl).flush([
      { ...pendingTrip, status: 'cancelled' },
      { ...pendingTrip, id: '010', ride: { ...ride, origin: 'Portão' } },
    ]);
    harness.detectChanges();
    expect(root.querySelectorAll('article')).toHaveLength(1);
    expect(root.querySelector('article')?.textContent).toContain('Portão');
    expect(root.textContent).toContain('Solicitação cancelada');
    findButton(root, 'Histórico').click();
    harness.detectChanges();
    expect(root.querySelectorAll('article')).toHaveLength(1);
    expect(root.querySelector('article')?.textContent).toContain('Solicitação cancelada');
    expect(root.querySelector('article')?.textContent).toContain('Praça do Japão');
  });

  it('preserva Pendentes se o PATCH falhar e informa a falha', async () => {
    await authenticate(http);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { root, read, harness } = await openTrips();
    read.flush([pendingTrip]);
    harness.detectChanges();
    findButton(root, 'Cancelar solicitação de vaga').click();
    http.expectOne({ method: 'GET', url: `${requestsUrl}/009` }).flush(pending);
    expectCancellationPatch(http).error(new ProgressEvent('error'));
    harness.detectChanges();

    expect(root.querySelector('article')?.textContent).toContain(
      'Aguardando resposta do motorista',
    );
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'Falha de conexão ao cancelar a solicitação',
    );
    expect(findButton(root, 'Cancelar solicitação de vaga').disabled).toBe(true);
  });

  it('mantém o cancelamento ao sair e atualiza a lista ao voltar antes da conclusão', async () => {
    await authenticate(http);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { root, read, harness } = await openTrips();
    read.flush([pendingTrip]);
    await harness.fixture.whenStable();
    findButton(root, 'Cancelar solicitação de vaga').click();
    const validation = http.expectOne({ method: 'GET', url: `${requestsUrl}/009` });

    await harness.navigateByUrl('/rides');
    expect(validation.cancelled).toBe(false);
    validation.flush(pending);
    const patch = expectCancellationPatch(http);

    await harness.navigateByUrl('/rides/my-trips');
    const returning = http.expectOne((request) => request.url === summariesUrl);
    returning.flush([pendingTrip]);
    await harness.fixture.whenStable();
    expect(findButton(root, 'Cancelando').disabled).toBe(true);
    findButton(root, 'Cancelando').click();
    expect(confirm).toHaveBeenCalledOnce();

    patch.flush({ ...pending, status: 'cancelled' });
    http.expectNone((request) => request.url.startsWith(requestsUrl));
    http
      .expectOne((request) => request.url === summariesUrl)
      .flush([{ ...pendingTrip, status: 'cancelled' }]);
    await harness.fixture.whenStable();

    expect(root.textContent).toContain('Solicitação cancelada');
    expect(root.querySelectorAll('article')).toHaveLength(0);
    findButton(root, 'Histórico').click();
    await harness.fixture.whenStable();
    expect(root.querySelector('article')?.textContent).toContain('Solicitação cancelada');
  });

  it('atualiza para Confirmadas quando o motorista confirma antes da gravação do cancelamento', async () => {
    await authenticate(http);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { root, read, harness } = await openTrips();
    read.flush([pendingTrip]);
    await harness.fixture.whenStable();
    findButton(root, 'Cancelar solicitação de vaga').click();
    http.expectOne({ method: 'GET', url: `${requestsUrl}/009` }).flush(pending);
    expectCancellationPatch(http).flush(null, { status: 409, statusText: 'Conflict' });
    http.expectOne((request) => request.url === summariesUrl).flush([
      { ...pendingTrip, status: 'accepted', whatsapp: '41987651122' },
    ]);
    await harness.fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'Somente solicitações pendentes podem ser canceladas',
    );
    expect(root.querySelectorAll('article')).toHaveLength(0);
    expect(root.querySelector('a[href^="https://wa.me/"]')).toBeNull();
    findButton(root, 'Confirmadas').click();
    await harness.fixture.whenStable();
    expect(root.querySelector('article')?.textContent).toContain('Confirmada');
    expect(root.querySelector('a[href="https://wa.me/5541987651122"]')).not.toBeNull();
  });

  it('ignora a resposta de cancelamento após uma nova sessão com o mesmo ID', async () => {
    const auth = await authenticate(http);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { root, read, harness } = await openTrips();
    read.flush([pendingTrip]);
    harness.detectChanges();
    findButton(root, 'Cancelar solicitação de vaga').click();
    http.expectOne({ method: 'GET', url: `${requestsUrl}/009` }).flush(pending);
    const patch = expectCancellationPatch(http);

    auth.logout();
    await authenticate(http);
    harness.detectChanges();
    http.expectOne((request) => request.url === summariesUrl).flush([pendingTrip]);
    patch.flush({ ...pending, status: 'cancelled' });
    harness.detectChanges();

    expect(root.querySelector('article')?.textContent).toContain(
      'Aguardando resposta do motorista',
    );
    expect(root.textContent).not.toContain('Solicitação cancelada');
    expect(findButton(root, 'Cancelar solicitação de vaga').disabled).toBe(false);
  });

  it.each([
    { role: 'student', blocked: true, message: 'Sua conta está bloqueada' },
    {
      role: 'support',
      blocked: false,
      message: 'Perfis de suporte não podem solicitar vagas nem cancelar solicitações',
    },
  ] as const)(
    'restringe cancelar com perfil $role e bloqueio $blocked',
    async ({ role, blocked, message }) => {
      const auth = await authenticate(http, role);
      if (blocked) {
        vi.spyOn(auth, 'currentUser').mockReturnValue({ ...auth.currentUser()!, isBlocked: true });
      }
      const confirm = vi.spyOn(window, 'confirm');
      const { root, read, harness } = await openTrips();
      read.flush([pendingTrip]);
      harness.detectChanges();

      const cancel = findButton(root, 'Cancelar solicitação de vaga');
      expect(cancel.disabled).toBe(true);
      expect(root.textContent).toContain(message);
      cancel.click();
      expect(confirm).not.toHaveBeenCalled();
      http.expectNone((request) => request.url.startsWith(requestsUrl));
    },
  );

  it('distingue a falha de consulta de uma lista vazia', async () => {
    const auth = await authenticate(http);
    const { root, read, harness } = await openTrips();
    read.flush(null, { status: 500, statusText: 'Internal Server Error' });
    harness.detectChanges();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'Não foi possível carregar suas viagens',
    );
    expect(root.textContent).not.toContain('Nenhuma viagem encontrada');

    auth.logout();
    await authenticate(http, 'student', '7');
    harness.detectChanges();
    http
      .expectOne(
        (request) => request.url === summariesUrl && request.params.get('passengerId') === '7',
      )
      .flush([]);
    harness.detectChanges();
    expect(root.textContent).toContain('Nenhuma viagem encontrada');
    expect(root.querySelector('a[href="/rides"]')?.textContent).toContain(
      'Explorar caronas disponíveis',
    );
  });

  it.each([
    [0, 'Falha de conexão'],
    [404, 'Não foi possível carregar suas viagens'],
  ] as const)('recupera Minhas Viagens após uma falha %s (CA10)', async (status, message) => {
    await authenticate(http);
    const { root, read, harness } = await openTrips();
    if (status === 0) read.error(new ProgressEvent('error'));
    else read.flush(null, { status, statusText: 'Not Found' });
    harness.detectChanges();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(message);
    expect(root.textContent).not.toContain('Nenhuma viagem encontrada');
    expect(root.querySelector('a[href="/rides"]')?.textContent)
      .toContain('Voltar para a busca');
    findButton(root, 'Tentar novamente').click();
    harness.detectChanges();
    expect(root.textContent).toContain('Carregando suas viagens');
    expect(root.querySelector('[role="alert"]')).toBeNull();
    const retried = http.expectOne({ method: 'GET', url: `${summariesUrl}?passengerId=007` });
    retried.flush([pendingTrip]);
    harness.detectChanges();
    expect(root.querySelector('article')?.textContent).toContain('Aguardando resposta do motorista');
    http.expectNone((request) => request.method !== 'GET');
  });

  it.each([
    [0, 'cancelled', 'Falha de conexão'],
    [404, 'pending', 'Não foi possível cancelar a solicitação'],
  ] as const)('consulta o estado real após falha %s no cancelamento (CA10)', async (status, actual, message) => {
    await authenticate(http);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { root, read, harness } = await openTrips();
    read.flush([pendingTrip]);
    harness.detectChanges();
    findButton(root, 'Cancelar solicitação de vaga').click();
    http.expectOne({ method: 'GET', url: `${requestsUrl}/009` }).flush(pending);
    const patch = expectCancellationPatch(http);
    if (status === 0) patch.error(new ProgressEvent('error'));
    else patch.flush(null, { status, statusText: 'Not Found' });
    harness.detectChanges();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(message);
    expect(findButton(root, 'Cancelar solicitação de vaga').disabled).toBe(true);
    const refresh = findButton(root, 'Atualizar viagens');
    refresh.click();
    refresh.click();
    http.expectNone((request) => request.url.startsWith(requestsUrl));
    http.expectOne({ method: 'GET', url: `${summariesUrl}?passengerId=007` })
      .flush([{ ...pendingTrip, status: actual }]);
    harness.detectChanges();
    expect(root.querySelector('[role="alert"]')).toBeNull();
    if (actual === 'cancelled') {
      findButton(root, 'Histórico').click();
      harness.detectChanges();
      expect(root.querySelector('article')?.textContent).toContain('Solicitação cancelada');
      expect(confirm).toHaveBeenCalledOnce();
      http.expectNone((request) => request.url.startsWith(requestsUrl));
    } else {
      findButton(root, 'Cancelar solicitação de vaga').click();
      http.expectNone((request) => request.method === 'PATCH');
      http.expectOne({ method: 'GET', url: `${requestsUrl}/009` }).flush(pending);
      expectCancellationPatch(http).flush({ ...pending, status: 'cancelled' });
      http.expectOne({ method: 'GET', url: `${summariesUrl}?passengerId=007` })
        .flush([{ ...pendingTrip, status: 'cancelled' }]);
      expect(confirm).toHaveBeenCalledTimes(2);
    }
  });
});
