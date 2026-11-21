import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { isSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { errorInterceptor } from '../interceptors/error-interceptor';
import { ErrorNotice } from './error-notice';
import { LocationData } from './location-data';

const municipalitiesUrl =
  'https://servicodados.ibge.gov.br/api/v1/localidades/estados/PR/municipios?orderBy=nome';

describe('LocationData', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta os municípios do Paraná via GET e expõe os nomes em um Signal', () => {
    const locations = TestBed.inject(LocationData);
    const request = http.expectOne({ method: 'GET', url: municipalitiesUrl });

    expect(isSignal(locations.suggestions)).toBe(true);
    expect(locations.suggestions()).toEqual([]);

    request.flush([
      { id: 4104808, nome: 'Cascavel' },
      { id: 4106902, nome: 'Curitiba' },
      { id: 4113700, nome: 'Londrina' },
    ]);

    expect(locations.suggestions()).toEqual(['Cascavel', 'Curitiba', 'Londrina']);
  });

  it('mantém as sugestões vazias e o aviso em branco quando o dispositivo está offline', () => {
    const locations = TestBed.inject(LocationData);

    http.expectOne(municipalitiesUrl).error(new ProgressEvent('error'));

    expect(locations.suggestions()).toEqual([]);
    expect(TestBed.inject(ErrorNotice).message()).toBe('');
  });

  it.each([404, 500])('mantém as sugestões vazias e o aviso em branco após HTTP %i', (status) => {
    const locations = TestBed.inject(LocationData);

    http.expectOne(municipalitiesUrl).flush(null, { status, statusText: 'Erro' });

    expect(locations.suggestions()).toEqual([]);
    expect(TestBed.inject(ErrorNotice).message()).toBe('');
  });
});
