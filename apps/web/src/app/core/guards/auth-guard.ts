import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthData } from '../services/auth-data';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthData);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  return (await auth.ensureSessionRestored()) ? true : router.parseUrl('/login');
};
