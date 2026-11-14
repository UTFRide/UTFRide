import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./features/auth/landing/landing').then((m) => m.Landing) },
  { path: 'register', loadComponent: () => import('./features/auth/register/register').then((m) => m.Register) },
  // TODO #4: conectar a tela de login na Tarefa 2.
  { path: 'login', children: [] },
];
