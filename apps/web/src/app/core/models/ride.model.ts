import type { User } from './user.model';

export type RideStatus = 'active' | 'full' | 'completed' | 'cancelled';

export interface RideDraft {
  origin: string;
  destination: string;
  departureTime: string;
  totalSeats: number;
  pricePerSeat: number;
  notes?: string;
}

export interface Ride extends RideDraft {
  id: string;
  driverId: string;
  availableSeats: number;
  status: RideStatus;
  createdAt: string;
}

export interface RideSearchFilters {
  origin: string;
  destination: string;
  date: string;
}

export type RideDriverSummary = Pick<User, 'name' | 'ratingAverage'>;

export interface RideWithDriver extends Ride {
  driver: RideDriverSummary | null;
}
