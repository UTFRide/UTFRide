import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';

/** Cabeçalhos PostgREST para receber a linha única criada ou atualizada como objeto JSON. */
export const SUPABASE_SINGLE_OBJECT_HEADERS = {
  Prefer: 'return=representation',
  Accept: 'application/vnd.pgrst.object+json',
} as const;

export interface UserRow {
  id: string;
  name: string;
  email: string;
  registration_number: string;
  whatsapp: string;
  role: User['role'];
  is_blocked: boolean;
  is_email_confirmed: boolean;
  rating_average: number | string;
  created_at: string;
}

/** Monta a URL de uma tabela/recurso da API REST do Supabase. */
export function supabaseRestUrl(resource: string): string {
  const base = environment.supabaseUrl.replace(/\/+$/, '');
  const path = resource.replace(/^\/+/, '');
  return `${base}/rest/v1/${path}`;
}

/** Monta a URL de uma função RPC exposta pelo PostgREST do Supabase. */
export function supabaseRpcUrl(fnName: string): string {
  return supabaseRestUrl(`rpc/${fnName.replace(/^\/+/, '')}`);
}

/** Converte um registro `users` (snake_case) do PostgreSQL para o modelo `User` (camelCase). */
export function mapUserRow(row: Partial<UserRow>): User {
  return {
    id: row.id ?? '',
    name: row.name ?? '',
    email: row.email ?? '',
    registrationNumber: row.registration_number ?? '',
    whatsapp: row.whatsapp ?? '',
    password: '',
    role: row.role === 'support' ? 'support' : 'student',
    isBlocked: row.is_blocked === true,
    isEmailConfirmed: row.is_email_confirmed !== false,
    ratingAverage: Number(row.rating_average ?? 0),
    createdAt: row.created_at ?? '',
  };
}
