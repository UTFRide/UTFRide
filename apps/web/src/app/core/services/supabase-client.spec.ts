import { TestBed } from '@angular/core/testing';
import { Session, User } from '@supabase/supabase-js';
import { environment as prodEnvironment } from '../../../environments/environment';
import { environment as devEnvironment } from '../../../environments/environment.development';
import {
  SUPABASE_AUTH_CLIENT,
  SupabaseAuthClient,
  SupabaseClientService,
} from './supabase-client';

const fakeUser: User = {
  id: 'user-1',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
  email: 'ana@alunos.utfpr.edu.br',
};

const fakeSession: Session = {
  access_token: 'jwt-token',
  refresh_token: 'refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: fakeUser,
};

function createFakeAuthClient(): SupabaseAuthClient {
  return {
    signUp: vi.fn(async () => ({ data: { user: fakeUser, session: null }, error: null })),
    signInWithPassword: vi.fn(async () => ({
      data: { user: fakeUser, session: fakeSession },
      error: null,
    })),
    signOut: vi.fn(async () => ({ error: null })),
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { id: 'sub-1', callback: vi.fn(), unsubscribe: vi.fn() } },
    })),
  };
}

describe('Ambientes e SupabaseClientService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('expõe apenas supabaseUrl e supabasePublishableKey nos ambientes sem chave secreta', () => {
    for (const env of [prodEnvironment, devEnvironment]) {
      expect(Object.keys(env).sort()).toEqual(['supabasePublishableKey', 'supabaseUrl']);
      expect(env.supabaseUrl).toBe('https://qeoenmfkfrhabznkekjp.supabase.co');
      expect(env.supabasePublishableKey).toMatch(/^sb_publishable_/);

      const serialized = JSON.stringify(env);
      expect(serialized).not.toContain('sb_secret_');
    }
  });

  it('encapsula a interface de autenticação e delega ao dublê via DI sem chamadas de rede reais', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const fakeAuth = createFakeAuthClient();

    TestBed.configureTestingModule({
      providers: [{ provide: SUPABASE_AUTH_CLIENT, useValue: fakeAuth }],
    });

    const service = TestBed.inject(SupabaseClientService);

    await service.signUp({ email: 'ana@alunos.utfpr.edu.br', password: 'secret' });
    await service.signInWithPassword({ email: 'ana@alunos.utfpr.edu.br', password: 'secret' });
    await service.getSession();
    await service.signOut();
    const subscription = service.onAuthStateChange(vi.fn());

    expect(fakeAuth.signUp).toHaveBeenCalledTimes(1);
    expect(fakeAuth.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(fakeAuth.getSession).toHaveBeenCalledTimes(1);
    expect(fakeAuth.signOut).toHaveBeenCalledTimes(1);
    expect(fakeAuth.onAuthStateChange).toHaveBeenCalledTimes(1);
    expect(subscription.data.subscription.unsubscribe).toBeTypeOf('function');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('permite substituir SupabaseClientService diretamente via DI nos testes', async () => {
    const fakeService = createFakeAuthClient();

    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseClientService, useValue: fakeService }],
    });

    const injected = TestBed.inject(SupabaseClientService);
    const result = await injected.getSession();

    expect(result).toEqual({ data: { session: null }, error: null });
    expect(fakeService.getSession).toHaveBeenCalledTimes(1);
  });
});
