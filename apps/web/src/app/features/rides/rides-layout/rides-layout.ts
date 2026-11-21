import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthData } from '../../../core/services/auth-data';
import { NotificationData } from '../../../core/services/notification-data';
import { NotificationBell } from '../../../shared/components/notification-bell/notification-bell';
import { InitialsPipe } from '../../../shared/pipes/initials-pipe';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NotificationBell, InitialsPipe],
  selector: 'app-rides-layout',
  templateUrl: './rides-layout.html',
})
export class RidesLayout {
  private readonly authData = inject(AuthData);
  private readonly notificationData = inject(NotificationData);

  protected readonly notifications = this.notificationData.userNotifications;
  protected readonly notificationsError = this.notificationData.loadError;
  protected readonly studentName = computed(
    () => this.authData.currentUser()?.name ?? 'Aluno UTFPR',
  );

  protected loadNotifications(): void {
    this.notificationData.loadForCurrentUser();
  }
}
