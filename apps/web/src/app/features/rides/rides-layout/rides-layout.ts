import { Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthData } from '../../../core/services/auth-data';
import { NetworkStatus, OFFLINE_ACTION_MESSAGE } from '../../../core/services/network-status';
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
  protected readonly network = inject(NetworkStatus);

  private readonly logoutButton = viewChild<ElementRef<HTMLButtonElement>>('logoutButton');
  private readonly cancelLogoutButton = viewChild<ElementRef<HTMLButtonElement>>('cancelLogoutButton');
  private wasLogoutDialogOpen = false;

  protected readonly offlineMessage = OFFLINE_ACTION_MESSAGE;
  protected readonly loggingOut = signal(false);
  protected readonly logoutConfirming = signal(false);
  protected readonly notifications = this.notificationData.userNotifications;
  protected readonly notificationsError = this.notificationData.loadError;
  protected readonly studentName = computed(
    () => this.authData.currentUser()?.name ?? 'Aluno UTFPR',
  );

  private readonly syncLogoutDialogFocus = effect(() => {
    const isOpen = this.logoutConfirming();
    const cancelButton = this.cancelLogoutButton();

    if (isOpen && cancelButton) {
      cancelButton.nativeElement.focus();
      this.wasLogoutDialogOpen = true;
      return;
    }

    if (!isOpen && this.wasLogoutDialogOpen) {
      this.wasLogoutDialogOpen = false;
      const trigger = this.logoutButton()?.nativeElement;
      if (trigger && !trigger.disabled) {
        trigger.focus();
      }
    }
  });

  protected loadNotifications(): void {
    this.notificationData.loadForCurrentUser();
  }

  protected async logout(): Promise<void> {
    if (this.loggingOut()) return;
    if (this.network.isOffline()) {
      this.logoutConfirming.set(true);
      return;
    }
    await this.performLogout();
  }

  protected closeLogoutConfirmation(): void {
    if (this.loggingOut()) return;
    this.logoutConfirming.set(false);
  }

  protected async confirmOfflineLogout(): Promise<void> {
    if (this.loggingOut()) return;
    this.wasLogoutDialogOpen = false;
    this.logoutConfirming.set(false);
    await this.performLogout();
  }

  private async performLogout(): Promise<void> {
    this.loggingOut.set(true);
    try {
      await this.authData.logout();
      await this.router.navigateByUrl('/login');
    } finally {
      this.loggingOut.set(false);
    }
  }
}
