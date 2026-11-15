import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./features/auth/landing/landing').then((m) => m.Landing) },
  { path: 'register', loadComponent: () => import('./features/auth/register/register').then((m) => m.Register) },
  { path: 'login', loadComponent: () => import('./features/auth/login/login').then((m) => m.Login) },
  { path: 'rides', canActivate: [authGuard], loadComponent: () => import('./features/rides/ride-list/ride-list').then((m) => m.RideList) },
];
