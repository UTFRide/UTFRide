import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { RideData, RideDetailResult } from '../services/ride-data';

export const rideDetailResolver: ResolveFn<RideDetailResult> = (route) =>
  inject(RideData).resolveRideDetail(route.paramMap.get('id'));
