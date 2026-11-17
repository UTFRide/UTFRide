import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthData } from '../../../core/services/auth-data';
import { NotificationData } from '../../../core/services/notification-data';
import { NotificationBell } from '../../../shared/components/notification-bell/notification-bell';
import { InitialsPipe } from '../../../shared/pipes/initials-pipe';

// TODO #4: substituir esta tela provisória pela busca de caronas da história correspondente.
@Component({
  imports: [RouterLink, NotificationBell, InitialsPipe],
  templateUrl: './ride-list.html',
})
export class RideList {
  private readonly authData = inject(AuthData);
  private readonly notificationData = inject(NotificationData);

  readonly notifications = this.notificationData.userNotifications;
  readonly notificationsError = this.notificationData.loadError;
  readonly studentName = computed(() => this.authData.currentUser()?.name ?? 'Aluno UTFPR');

  loadNotifications(): void {
    this.notificationData.loadForCurrentUser();
  }
}
