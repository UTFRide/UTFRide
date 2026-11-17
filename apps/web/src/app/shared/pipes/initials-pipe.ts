import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'initials',
})
export class InitialsPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    const parts = (value ?? '')
      .trim()
      .split(/\s+/)
      .filter((part) => part.length > 0);
    if (parts.length === 0) {
      return 'AL';
    }
    if (parts.length === 1) {
      return Array.from(parts[0]).slice(0, 2).join('').toUpperCase();
    }
    const first = Array.from(parts[0])[0] ?? '';
    const last = Array.from(parts[parts.length - 1])[0] ?? '';
    return `${first}${last}`.toUpperCase();
  }
}
