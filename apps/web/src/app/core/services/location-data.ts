import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
import { SKIP_GLOBAL_ERROR_HANDLING } from '../interceptors/error-interceptor';

const municipalitiesUrl =
  'https://servicodados.ibge.gov.br/api/v1/localidades/estados/PR/municipios?orderBy=nome';

interface IbgeMunicipality {
  nome: string;
}

@Service()
export class LocationData {
  private readonly http = inject(HttpClient);

  readonly suggestions = toSignal(
    this.http
      .get<IbgeMunicipality[]>(municipalitiesUrl, {
        context: new HttpContext().set(SKIP_GLOBAL_ERROR_HANDLING, true),
      })
      .pipe(
        map((municipalities) => municipalities.map(({ nome }) => nome)),
        catchError(() => of([])),
      ),
    { initialValue: [] },
  );
}
