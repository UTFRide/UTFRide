import { inject, Injectable, InjectionToken } from '@angular/core';
import { AuthChangeEvent, createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

export type SupabaseAuthClient = Pick<
  SupabaseClient['auth'],
  'signUp' | 'signInWithPassword' | 'signOut' | 'getSession' | 'onAuthStateChange'
>;

export const SUPABASE_AUTH_CLIENT = new InjectionToken<SupabaseAuthClient>('SUPABASE_AUTH_CLIENT');

@Injectable({ providedIn: 'root' })
export class SupabaseClientService implements SupabaseAuthClient {
  private readonly injectedAuth = inject(SUPABASE_AUTH_CLIENT, { optional: true });
  private authClient: SupabaseAuthClient | null = null;

  private get auth(): SupabaseAuthClient {
    if (this.injectedAuth) {
      return this.injectedAuth;
    }
    this.authClient ??= createClient(
      environment.supabaseUrl,
      environment.supabasePublishableKey,
    ).auth;
    return this.authClient;
  }

  signUp(
    ...args: Parameters<SupabaseAuthClient['signUp']>
  ): ReturnType<SupabaseAuthClient['signUp']> {
    return this.auth.signUp(...args);
  }

  signInWithPassword(
    ...args: Parameters<SupabaseAuthClient['signInWithPassword']>
  ): ReturnType<SupabaseAuthClient['signInWithPassword']> {
    return this.auth.signInWithPassword(...args);
  }

  signOut(
    ...args: Parameters<SupabaseAuthClient['signOut']>
  ): ReturnType<SupabaseAuthClient['signOut']> {
    return this.auth.signOut(...args);
  }

  getSession(): ReturnType<SupabaseAuthClient['getSession']> {
    return this.auth.getSession();
  }

  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void | Promise<void>,
  ): ReturnType<SupabaseAuthClient['onAuthStateChange']> {
    return this.auth.onAuthStateChange(async (event, session) => {
      await callback(event, session);
    });
  }
}
