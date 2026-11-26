import { HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Notification } from '../models/notification.model';
import { Ride, RideStatus } from '../models/ride.model';
import { RideRequest, RideRequestStatus } from '../models/ride-request.model';
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

export interface NotificationRow {
  id: string;
  recipient_id: string;
  ride_id: string;
  message: string;
  created_at: string;
}

export interface RideRow {
  id: string;
  driver_id: string;
  origin: string;
  destination: string;
  departure_time: string;
  available_seats: number;
  total_seats: number;
  price_per_seat: number | string;
  status: RideStatus;
  notes?: string | null;
  created_at: string;
}

export interface DriverSummaryRow {
  id: string;
  name: string;
  rating_average: number | string;
}

export interface RideRequestRow {
  id: string;
  ride_id: string;
  passenger_id: string;
  status: RideRequestStatus;
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

/** Converte um registro `notifications` (snake_case) do PostgreSQL para `Notification` (camelCase). */
export function mapNotificationRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    recipientId: row.recipient_id,
    rideId: row.ride_id,
    message: row.message,
    createdAt: row.created_at,
  };
}

/** Converte um registro `rides` (snake_case) do PostgreSQL para `Ride` (camelCase). */
export function mapRideRow(row: RideRow): Ride {
  return {
    id: row.id,
    driverId: row.driver_id,
    origin: row.origin,
    destination: row.destination,
    departureTime: row.departure_time,
    availableSeats: row.available_seats,
    totalSeats: row.total_seats,
    pricePerSeat: Number(row.price_per_seat),
    status: row.status,
    ...(row.notes !== undefined && row.notes !== null ? { notes: row.notes } : {}),
    createdAt: row.created_at,
  };
}

/** Identifica erro PostgreSQL `22P02` quando um parâmetro de rota não é um UUID válido. */
export function isInvalidUuidError(error: HttpErrorResponse): boolean {
  const code = typeof error.error === 'object' && error.error !== null
    ? (error.error as { code?: unknown }).code
    : undefined;
  return error.status === 400 && code === '22P02';
}

/** Converte um registro `ride_requests` (snake_case) do PostgreSQL para `RideRequest` (camelCase). */
export function mapRideRequestRow(row: RideRequestRow): RideRequest {
  return {
    id: row.id,
    rideId: row.ride_id,
    passengerId: row.passenger_id,
    status: row.status,
    createdAt: row.created_at,
  };
}
