import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./features/auth/landing/landing').then((m) => m.Landing) },
  { path: 'register', loadComponent: () => import('./features/auth/register/register').then((m) => m.Register) },
  { path: 'login', loadComponent: () => import('./features/auth/login/login').then((m) => m.Login) },
  {
    path: 'rides',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadComponent: () =>
      import('./features/rides/rides-layout/rides-layout').then((m) => m.RidesLayout),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/rides/ride-list/ride-list').then((m) => m.RideList),
      },
      {
        path: 'my-trips',
        loadComponent: () =>
          import('./features/rides/rides-layout/my-trips-placeholder').then(
            (m) => m.MyTripsPlaceholder,
          ),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./features/rides/ride-detail/ride-detail').then((m) => m.RideDetail),
      },
    ],
  },
  { path: 'driver/offer', canActivate: [authGuard], loadComponent: () => import('./features/driver/offer-ride/offer-ride').then((m) => m.OfferRide) },
  { path: 'driver/my-rides', canActivate: [authGuard], loadComponent: () => import('./features/driver/my-rides/my-rides').then((m) => m.MyRides) },
];
