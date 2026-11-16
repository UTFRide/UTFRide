export type RideRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface RideRequest {
  id: string;
  rideId: string;
  passengerId: string;
  status: RideRequestStatus;
  createdAt: string;
}
