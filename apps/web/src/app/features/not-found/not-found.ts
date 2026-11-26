import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthData } from '../../core/services/auth-data';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  templateUrl: './not-found.html',
})
export class NotFound {
  private readonly auth = inject(AuthData);

  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly returnRoute = computed(() => (this.isAuthenticated() ? '/rides' : '/'));
  readonly returnLabel = computed(() =>
    this.isAuthenticated() ? 'Voltar para as Caronas' : 'Voltar para a Página Inicial',
  );
}
