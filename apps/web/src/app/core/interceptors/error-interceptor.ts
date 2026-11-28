import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthData } from '../services/auth-data';
import { ErrorNotice } from '../services/error-notice';

export const SKIP_GLOBAL_ERROR_HANDLING = new HttpContextToken<boolean>(() => false);
export const HANDLE_SESSION_EXPIRATION_ONLY = new HttpContextToken<boolean>(() => false);

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.context.get(SKIP_GLOBAL_ERROR_HANDLING)) {
    return next(request);
  }

  const auth = inject(AuthData);
  const router = inject(Router);
  const notice = inject(ErrorNotice);
  const sessionExpirationOnly = request.context.get(HANDLE_SESSION_EXPIRATION_ONLY);
  const session = sessionExpirationOnly ? auth.currentUser() : null;
  return next(request).pipe(catchError((error: unknown) => {
    if (
      error instanceof HttpErrorResponse &&
      (!sessionExpirationOnly || (error.status === 401 && session === auth.currentUser()))
    ) {
      if (error.status === 401) {
        auth.logout();
        notice.message.set('Não foi possível autorizar a solicitação. Faça login e tente novamente.');
        void router.navigateByUrl('/login');
      } else if (error.status === 403) {
        notice.message.set('Acesso proibido. Você não tem permissão para realizar esta ação.');
      } else if (error.status === 500) {
        notice.message.set('Falha no servidor. Tente novamente.');
      } else if (error.status === 0) {
        notice.message.set('Servidor fora do ar ou sem conexão. Verifique sua internet e tente novamente.');
      } else {
        notice.message.set('Não foi possível concluir a solicitação. Tente novamente.');
      }
    }
    return throwError(() => error);
  }));
};
