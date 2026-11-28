import { HttpClient, HttpContext } from '@angular/common/http';
import { effect, inject, Service } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, merge, of, Subject, switchMap, tap } from 'rxjs';
import { SKIP_GLOBAL_ERROR_HANDLING } from '../interceptors/error-interceptor';
import { NetworkStatus } from './network-status';
import { OfflineCache } from './offline-cache';

const municipalitiesUrl =
  'https://servicodados.ibge.gov.br/api/v1/localidades/estados/PR/municipios?orderBy=nome';
const MUNICIPALITIES_CACHE_KEY = 'ibge-municipalities';

interface IbgeMunicipality {
  nome: string;
}

@Service()
export class LocationData {
  private readonly http = inject(HttpClient);
  private readonly network = inject(NetworkStatus);
  private readonly cache = inject(OfflineCache);
  private readonly reloadTrigger = new Subject<void>();
  private hasRequestedOnline = false;

  readonly suggestions = toSignal(
    merge(of(undefined), this.reloadTrigger).pipe(
      switchMap(() => {
        if (this.network.isOffline()) {
          return of(this.readCachedMunicipalities());
        }

        this.hasRequestedOnline = true;
        return this.http
          .get<IbgeMunicipality[]>(municipalitiesUrl, {
            context: new HttpContext().set(SKIP_GLOBAL_ERROR_HANDLING, true),
          })
          .pipe(
            map((municipalities) => municipalities.map(({ nome }) => nome)),
            tap((names) => this.cache.set(MUNICIPALITIES_CACHE_KEY, names)),
            catchError(() => of([])),
          );
      }),
    ),
    { initialValue: this.network.isOffline() ? this.readCachedMunicipalities() : [] },
  );

  private readonly reloadWhenOnline = effect(() => {
    if (this.network.isOnline() && !this.hasRequestedOnline) {
      this.reloadTrigger.next();
    }
  });

  private readCachedMunicipalities(): string[] {
    const cached = this.cache.get<unknown>(MUNICIPALITIES_CACHE_KEY);
    if (!Array.isArray(cached)) {
      return [];
    }
    return cached.filter((item): item is string => typeof item === 'string');
  }
}
