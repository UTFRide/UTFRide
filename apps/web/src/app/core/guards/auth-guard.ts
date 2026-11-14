import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthData } from '../services/auth-data';

export const authGuard: CanActivateFn = () =>
  inject(AuthData).isAuthenticated() ? true : inject(Router).parseUrl('/login');
