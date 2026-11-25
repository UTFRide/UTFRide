import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Notification } from '../models/notification.model';
import { Ride } from '../models/ride.model';
import { AuthData } from './auth-data';
import { ErrorNotice } from './error-notice';
import { NotificationData } from './notification-data';
import { SUPABASE_AUTH_CLIENT, SupabaseAuthClient } from './supabase-client';

const fakeSupabaseUser: SupabaseUser = {
  id: 'passenger-1',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
  email: 'mariana@alunos.utfpr.edu.br',
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

async function authenticateStudent(
  http: HttpTestingController,
  user: { id: string; name: string; email: string },
): Promise<void> {
  const auth = TestBed.inject(AuthData);
  auth.login(user.email, 'senha123');
  await flushMicrotasks();
  http.expectOne((request) => request.url === `${environment.apiUrl}/users`).flush([
    {
      id: user.id,
      name: user.name,
      email: user.email,
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

describe('NotificationData', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SUPABASE_AUTH_CLIENT, useValue: createFakeAuthClient() },
      ],
    });
  });

  it('cria um aviso interno em /notifications para cada destinatário único da oferta cancelada', async () => {
    const notificationData = TestBed.inject(NotificationData);
    const http = TestBed.inject(HttpTestingController);

    const ride: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      totalSeats: 3,
      availableSeats: 1,
      pricePerSeat: 9,
      status: 'cancelled',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const resultPromise = firstValueFrom(
      notificationData.createCancellationNotifications$(ride, [
        'passenger-1',
        'passenger-2',
        'passenger-1',
      ]),
    );

    const requests = http.match(
      (req) => req.url === `${environment.apiUrl}/notifications` && req.method === 'POST',
    );
    expect(requests.length).toBe(2);

    const createdNotifications: Notification[] = requests.map((req, index) => {
      const body = req.request.body as Omit<Notification, 'id'>;
      expect(body.rideId).toBe('ride-1');
      expect(body.recipientId).toBe(index === 0 ? 'passenger-1' : 'passenger-2');
      expect(body.message).toContain('Batel');
      expect(body.message).toContain('UTFPR Neoville');
      expect(body.message.toLowerCase()).toContain('cancelad');
      expect(body.createdAt).toEqual(expect.any(String));

      const saved: Notification = { id: `notif-${index + 1}`, ...body };
      req.flush(saved);
      return saved;
    });

    const result = await resultPromise;
    expect(result).toEqual(createdNotifications);
    expect(notificationData.notifications()).toEqual(createdNotifications);
    http.verify();
  });

  it('não envia requisições quando a lista de destinatários está vazia', async () => {
    const notificationData = TestBed.inject(NotificationData);
    const http = TestBed.inject(HttpTestingController);

    const ride: Ride = {
      id: 'ride-1',
      driverId: 'driver-1',
      origin: 'Batel',
      destination: 'UTFPR Neoville',
      departureTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      totalSeats: 3,
      availableSeats: 3,
      pricePerSeat: 9,
      status: 'cancelled',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const result = await firstValueFrom(
      notificationData.createCancellationNotifications$(ride, []),
    );

    expect(result).toEqual([]);
    http.expectNone(`${environment.apiUrl}/notifications`);
    http.verify();
  });

  it('carrega apenas os avisos do aluno autenticado (por id ou nome) e nunca exibe avisos de outros alunos', async () => {
    const notificationData = TestBed.inject(NotificationData);
    const auth = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    await authenticateStudent(http, {
      id: 'passenger-1',
      name: 'Mariana Silva',
      email: 'mariana@alunos.utfpr.edu.br',
    });

    notificationData.loadForCurrentUser();

    const allNotifications: Notification[] = [
      {
        id: 'notif-confirmed',
        recipientId: 'Mariana Silva',
        rideId: 'ride-1',
        message: 'A carona Batel → UTFPR Neoville foi cancelada pelo motorista.',
        createdAt: '2026-01-01T08:00:00.000Z',
      },
      {
        id: 'notif-pending',
        recipientId: 'passenger-1',
        rideId: 'ride-2',
        message: 'A carona Portão → UTFPR Sede Centro foi cancelada pelo motorista.',
        createdAt: '2026-01-01T09:00:00.000Z',
      },
      {
        id: 'notif-other-student',
        recipientId: 'Lucas Andrade',
        rideId: 'ride-1',
        message: 'A carona Batel → UTFPR Neoville foi cancelada pelo motorista.',
        createdAt: '2026-01-01T08:00:00.000Z',
      },
    ];

    http
      .expectOne(
        (req) => req.url === `${environment.apiUrl}/notifications` && req.method === 'GET',
      )
      .flush(allNotifications);

    expect(notificationData.notifications()).toEqual([
      allNotifications[0],
      allNotifications[1],
    ]);
    expect(notificationData.userNotifications()).toEqual([
      allNotifications[0],
      allNotifications[1],
    ]);

    // Ao encerrar a sessão, os avisos do usuário não ficam expostos e recarregar limpa o estado
    auth.logout();
    expect(notificationData.userNotifications()).toEqual([]);

    notificationData.loadForCurrentUser();
    http.expectNone(`${environment.apiUrl}/notifications`);
    expect(notificationData.notifications()).toEqual([]);
    expect(notificationData.userNotifications()).toEqual([]);
    http.verify();
  });

  it('informa falha de conexão (status 0) via ErrorNotice, loadResult e loadError, limpa avisos antigos e recupera em nova tentativa', async () => {
    const notificationData = TestBed.inject(NotificationData);
    const errorNotice = TestBed.inject(ErrorNotice);
    const http = TestBed.inject(HttpTestingController);

    await authenticateStudent(http, {
      id: 'passenger-1',
      name: 'Mariana Silva',
      email: 'mariana@alunos.utfpr.edu.br',
    });

    const initialNotification: Notification = {
      id: 'notif-1',
      recipientId: 'passenger-1',
      rideId: 'ride-1',
      message: 'A carona Batel → UTFPR Neoville foi cancelada pelo motorista.',
      createdAt: '2026-01-01T08:00:00.000Z',
    };

    notificationData.loadForCurrentUser();
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/notifications` && req.method === 'GET')
      .flush([initialNotification]);
    expect(notificationData.userNotifications()).toEqual([initialNotification]);

    errorNotice.message.set('Erro anterior');
    notificationData.loadForCurrentUser();
    expect(errorNotice.message()).toBe('');
    expect(notificationData.notifications()).toEqual([]);

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/notifications` && req.method === 'GET')
      .error(new ProgressEvent('error'));

    expect(notificationData.loadResult()).toEqual({ connectionError: true });
    expect(notificationData.loadError()).toBe(
      'Falha de conexão ao carregar avisos. Verifique sua internet e tente novamente.',
    );
    expect(errorNotice.message()).toBe(
      'Falha de conexão. Verifique sua internet e tente novamente.',
    );
    expect(notificationData.notifications()).toEqual([]);
    expect(notificationData.userNotifications()).toEqual([]);

    // Nova tentativa limpa o erro em voo e restaura os avisos em caso de sucesso
    notificationData.loadForCurrentUser();
    expect(errorNotice.message()).toBe('');
    expect(notificationData.loadError()).toBeNull();

    http
      .expectOne((req) => req.url === `${environment.apiUrl}/notifications` && req.method === 'GET')
      .flush([initialNotification]);

    expect(notificationData.loadResult()).toEqual({ notifications: [initialNotification] });
    expect(notificationData.loadError()).toBeNull();
    expect(notificationData.userNotifications()).toEqual([initialNotification]);
    http.verify();
  });

  it('propaga erro inesperado não-HTTP via ErrorNotice, sinaliza erro HTTP 500 e não vaza erro entre sessões', async () => {
    const notificationData = TestBed.inject(NotificationData);
    const errorNotice = TestBed.inject(ErrorNotice);
    const auth = TestBed.inject(AuthData);
    const http = TestBed.inject(HttpTestingController);

    await authenticateStudent(http, {
      id: 'passenger-1',
      name: 'Mariana Silva',
      email: 'mariana@alunos.utfpr.edu.br',
    });

    notificationData.loadForCurrentUser();
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/notifications` && req.method === 'GET')
      .flush({});

    expect(notificationData.loadResult()).toEqual({ requestError: true });
    expect(notificationData.loadError()).toBe('Não foi possível carregar os avisos. Tente novamente.');
    expect(errorNotice.message()).toBe('Falha inesperada. Tente novamente.');
    expect(notificationData.notifications()).toEqual([]);

    // Erro HTTP 500 sinaliza requestError e loadError sem sobrescrever política do errorInterceptor
    notificationData.loadForCurrentUser();
    expect(errorNotice.message()).toBe('');
    http
      .expectOne((req) => req.url === `${environment.apiUrl}/notifications` && req.method === 'GET')
      .flush('erro', { status: 500, statusText: 'Erro interno' });

    expect(notificationData.loadResult()).toEqual({ requestError: true });
    expect(notificationData.loadError()).toBe('Não foi possível carregar os avisos. Tente novamente.');
    expect(errorNotice.message()).toBe('');

    // Ao trocar de aluno ou encerrar sessão, o erro anterior não permanece exposto
    await authenticateStudent(http, {
      id: 'passenger-2',
      name: 'Lucas Andrade',
      email: 'lucas@alunos.utfpr.edu.br',
    });
    expect(notificationData.loadError()).toBeNull();

    auth.logout();
    expect(notificationData.loadError()).toBeNull();
    http.verify();
  });
});
