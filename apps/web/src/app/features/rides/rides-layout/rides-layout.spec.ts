import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { environment } from '../../../../environments/environment';
import { routes } from '../../../app.routes';
import { AuthData } from '../../../core/services/auth-data';
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
  http.expectOne((request) => request.url === `${environment.apiUrl}/users`).flush([
    {
      id: 'student-1',
      name: 'Mariana Silva',
      email: 'mariana@alunos.utfpr.edu.br',
      registrationNumber: '2020999',
      whatsapp: '41988887777',
      role: 'student',
      isBlocked: false,
      isEmailConfirmed: true,
      ratingAverage: 4.9,
      createdAt: '2026-01-01T00:00:00.000Z',
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
});
