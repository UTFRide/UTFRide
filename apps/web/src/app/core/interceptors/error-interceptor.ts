import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthData } from '../services/auth-data';
import { ErrorNotice } from '../services/error-notice';

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthData);
  const router = inject(Router);
  const notice = inject(ErrorNotice);
  return next(request).pipe(catchError((error: unknown) => {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        auth.logout();
        notice.message.set('Não foi possível autorizar a solicitação. Faça login e tente novamente.');
        void router.navigateByUrl('/login');
      } else if (error.status === 403) {
        notice.message.set('Acesso proibido. Você não tem permissão para realizar esta ação.');
      } else if (error.status === 500) {
        notice.message.set('Falha no servidor. Tente novamente.');
      } else if (error.status !== 0) {
        notice.message.set('Não foi possível concluir a solicitação. Tente novamente.');
      }
    }
    return throwError(() => error);
  }));
};
