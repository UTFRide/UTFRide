import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../../environments/environment';
import { routes } from '../../../app.routes';
import { AuthData } from '../../../core/services/auth-data';
import { OFFLINE_ACTION_MESSAGE } from '../../../core/services/network-status';
import { OfflineCache } from '../../../core/services/offline-cache';
import { SUPABASE_AUTH_CLIENT, SupabaseAuthClient } from '../../../core/services/supabase-client';

@Component({ template: '<p>Rides Child Stub</p>' })
class RidesChildStub {}

const fakeSupabaseUser: SupabaseUser = {
  id: 'student-1',
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

async function authenticateStudent(http: HttpTestingController): Promise<void> {
  const auth = TestBed.inject(AuthData);
  auth.login('mariana@alunos.utfpr.edu.br', 'senha123');
  await flushMicrotasks();
  http.expectOne((request) => request.url === `${environment.supabaseUrl}/rest/v1/users`).flush([
    {
      id: 'student-1',
      name: 'Mariana Silva',
      email: 'mariana@alunos.utfpr.edu.br',
      registration_number: '2020999',
      whatsapp: '41988887777',
      role: 'student',
      is_blocked: false,
      is_email_confirmed: true,
      rating_average: 4.9,
      created_at: '2026-01-01T00:00:00.000Z',
    },
  ]);
  await flushMicrotasks();
}

function configureRidesLayoutTestModule(fakeAuth: SupabaseAuthClient): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        routes.map((route) =>
          route.path === 'rides'
            ? {
                ...route,
                children: [{ path: '', pathMatch: 'full', component: RidesChildStub }],
              }
            : route,
        ),
      ),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: SUPABASE_AUTH_CLIENT, useValue: fakeAuth },
    ],
  });
}

describe('Cabeçalho autenticado e logout (RidesLayout)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('exibe o botão Sair ao lado do avatar, executa signOut, limpa sessão e bloqueia rotas protegidas após sair', async () => {
    const fakeAuth = createFakeAuthClient();
    configureRidesLayoutTestModule(fakeAuth);
    const http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthData);
    const router = TestBed.inject(Router);
    await authenticateStudent(http);

    const harness = await RouterTestingHarness.create('/rides');
    const root = harness.routeNativeElement as HTMLElement;

    const header = root.querySelector('header');
    expect(header).not.toBeNull();
    const avatar = header!.querySelector('[data-testid="student-avatar"]');
    const logoutButton = header!.querySelector<HTMLButtonElement>('[data-testid="logout-button"]');
    expect(avatar).not.toBeNull();
    expect(logoutButton).not.toBeNull();
    expect(logoutButton!.textContent).toContain('Sair');
    expect(avatar!.parentElement?.contains(logoutButton!)).toBe(true);

    logoutButton!.click();
    await flushMicrotasks();
    await harness.fixture.whenStable();

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(auth.currentUser()).toBeNull();
    expect(auth.accessToken()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
    expect(router.url).toBe('/login');

    await harness.navigateByUrl('/rides');
    expect(router.url).toBe('/login');
    http.verify();
  });

  it('limpa sessão local e redireciona para /login mesmo se signOut falhar por rede', async () => {
    const fakeAuth = createFakeAuthClient();
    vi.mocked(fakeAuth.signOut).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    configureRidesLayoutTestModule(fakeAuth);
    const http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthData);
    const router = TestBed.inject(Router);
    await authenticateStudent(http);

    const harness = await RouterTestingHarness.create('/rides');
    const root = harness.routeNativeElement as HTMLElement;
    const logoutButton = root.querySelector<HTMLButtonElement>('header [data-testid="logout-button"]');
    expect(logoutButton).not.toBeNull();

    logoutButton!.click();
    await flushMicrotasks();
    await harness.fixture.whenStable();

    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(auth.currentUser()).toBeNull();
    expect(auth.accessToken()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
    expect(router.url).toBe('/login');
    http.verify();
  });

  it('abre diálogo de confirmação acessível ao clicar em Sair offline e mantém sessão e cache ao cancelar ou pressionar Escape', async () => {
    const fakeAuth = createFakeAuthClient();
    configureRidesLayoutTestModule(fakeAuth);
    const http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthData);
    const cache = TestBed.inject(OfflineCache);
    const router = TestBed.inject(Router);
    await authenticateStudent(http);
    cache.setUserItem('student-1', 'notifications', [
      {
        id: 'notif-1',
        recipientId: 'student-1',
        rideId: 'ride-1',
        message: 'Aviso em cache',
        createdAt: '2026-01-01T10:00:00.000Z',
      },
    ]);

    const harness = await RouterTestingHarness.create('/rides');
    const root = harness.routeNativeElement as HTMLElement;

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    await harness.fixture.whenStable();

    const logoutButton = root.querySelector<HTMLButtonElement>('header [data-testid="logout-button"]')!;
    logoutButton.click();
    await harness.fixture.whenStable();

    const dialog = root.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute('aria-modal')).toBe('true');
    expect(dialog!.textContent).toContain(
      'Você realmente deseja sair? Até se conectar novamente, você não terá acesso ao UTFRide.',
    );
    expect(fakeAuth.signOut).not.toHaveBeenCalled();
    expect(auth.isAuthenticated()).toBe(true);
    expect(router.url).toBe('/rides');

    const cancelButton = root.querySelector<HTMLButtonElement>(
      '[data-testid="cancel-offline-logout-button"]',
    )!;
    expect(document.activeElement).toBe(cancelButton);
    cancelButton.click();
    await harness.fixture.whenStable();

    expect(root.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(logoutButton);
    expect(auth.isAuthenticated()).toBe(true);
    expect(cache.getUserItem('student-1', 'profile')).not.toBeNull();
    expect(cache.getUserItem('student-1', 'notifications')).not.toBeNull();
    expect(fakeAuth.signOut).not.toHaveBeenCalled();

    logoutButton.click();
    await harness.fixture.whenStable();
    const reopenedDialog = root.querySelector<HTMLElement>('[role="dialog"]')!;
    reopenedDialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await harness.fixture.whenStable();

    expect(root.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(logoutButton);
    expect(auth.isAuthenticated()).toBe(true);
    expect(router.url).toBe('/rides');
    expect(cache.getUserItem('student-1', 'notifications')).not.toBeNull();
    expect(fakeAuth.signOut).not.toHaveBeenCalled();
    http.verify();
  });

  it('limpa sessão e caches privados localmente ao confirmar saída offline e redireciona para /login sem travar', async () => {
    const fakeAuth = createFakeAuthClient();
    configureRidesLayoutTestModule(fakeAuth);
    const http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthData);
    const cache = TestBed.inject(OfflineCache);
    const router = TestBed.inject(Router);
    await authenticateStudent(http);
    cache.setUserItem('student-1', 'notifications', [
      {
        id: 'notif-1',
        recipientId: 'student-1',
        rideId: 'ride-1',
        message: 'Aviso em cache',
        createdAt: '2026-01-01T10:00:00.000Z',
      },
    ]);

    const harness = await RouterTestingHarness.create('/rides');
    const root = harness.routeNativeElement as HTMLElement;

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    await harness.fixture.whenStable();

    root.querySelector<HTMLButtonElement>('header [data-testid="logout-button"]')!.click();
    await harness.fixture.whenStable();

    const confirmButton = root.querySelector<HTMLButtonElement>(
      '[data-testid="confirm-offline-logout-button"]',
    )!;
    confirmButton.click();
    await flushMicrotasks();
    await harness.fixture.whenStable();

    expect(fakeAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(auth.currentUser()).toBeNull();
    expect(auth.accessToken()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
    expect(cache.getUserItem('student-1', 'profile')).toBeNull();
    expect(cache.getUserItem('student-1', 'notifications')).toBeNull();
    expect(router.url).toBe('/login');

    await harness.navigateByUrl('/rides');
    expect(router.url).toBe('/login');
    http.verify();
  });

  it('repassa estado offline ao NotificationBell, exibe avisos em cache sem HTTP e remove o aviso ao reconectar', async () => {
    const fakeAuth = createFakeAuthClient();
    configureRidesLayoutTestModule(fakeAuth);
    const http = TestBed.inject(HttpTestingController);
    const cache = TestBed.inject(OfflineCache);
    await authenticateStudent(http);
    cache.setUserItem('student-1', 'notifications', [
      {
        id: 'notif-cached-1',
        recipientId: 'student-1',
        rideId: 'ride-1',
        message: 'A carona Batel → UTFPR Neoville foi cancelada pelo motorista.',
        createdAt: '2026-01-01T10:00:00.000Z',
      },
    ]);

    const harness = await RouterTestingHarness.create('/rides');
    const root = harness.routeNativeElement as HTMLElement;

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    await harness.fixture.whenStable();

    root
      .querySelector<HTMLButtonElement>('header [data-testid="notification-bell-button"]')!
      .click();
    await flushMicrotasks();
    await harness.fixture.whenStable();

    http.expectNone(`${environment.supabaseUrl}/rest/v1/notifications`);
    expect(root.querySelectorAll('[data-testid="notification-item"]').length).toBe(1);
    expect(root.querySelector('[data-testid="notifications-offline-notice"]')?.textContent).toContain(
      OFFLINE_ACTION_MESSAGE,
    );

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    await harness.fixture.whenStable();

    expect(root.querySelector('[data-testid="notifications-offline-notice"]')).toBeNull();
    http.verify();
  });
});
