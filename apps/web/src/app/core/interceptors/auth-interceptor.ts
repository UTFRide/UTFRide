import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthData } from '../services/auth-data';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(AuthData).accessToken();
  if (!token || !isApiUrl(request.url)) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    }),
  );
};

function isApiUrl(url: string): boolean {
  const apiUrl = environment.apiUrl.replace(/\/+$/, '');
  if (!apiUrl) {
    return false;
  }
  return url === apiUrl || url.startsWith(`${apiUrl}/`) || url.startsWith(`${apiUrl}?`);
}
