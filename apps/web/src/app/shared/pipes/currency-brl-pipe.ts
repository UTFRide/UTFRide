import { Pipe, PipeTransform } from '@angular/core';

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

@Pipe({
  name: 'currencyBrl',
})
export class CurrencyBrlPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '';
    }
    return brlFormatter.format(value).replace(/\u00a0/g, ' ');
  }
}
