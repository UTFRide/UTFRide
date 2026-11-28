import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthData } from '../services/auth-data';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isSupabaseUrl(request.url)) {
    return next(request);
  }

  const headers: Record<string, string> = {
    apikey: environment.supabasePublishableKey,
  };

  if (!request.headers.has('Authorization')) {
    const token = inject(AuthData).accessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return next(request.clone({ setHeaders: headers }));
};

function isSupabaseUrl(url: string): boolean {
  const supabaseUrl = environment.supabaseUrl.replace(/\/+$/, '');
  if (!supabaseUrl) {
    return false;
  }
  return url === supabaseUrl || url.startsWith(`${supabaseUrl}/`) || url.startsWith(`${supabaseUrl}?`);
}
