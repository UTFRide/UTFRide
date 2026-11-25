import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
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
  private readonly router = inject(Router);

  protected readonly loggingOut = signal(false);
  protected readonly notifications = this.notificationData.userNotifications;
  protected readonly notificationsError = this.notificationData.loadError;
  protected readonly studentName = computed(
    () => this.authData.currentUser()?.name ?? 'Aluno UTFPR',
  );

  protected loadNotifications(): void {
    this.notificationData.loadForCurrentUser();
  }

  protected async logout(): Promise<void> {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    try {
      await this.authData.logout();
      await this.router.navigateByUrl('/login');
    } finally {
      this.loggingOut.set(false);
    }
  }
}
