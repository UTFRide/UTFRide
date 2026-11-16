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
