import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';

export interface NotificationItem {
  id: string;
  recipientId: string;
  rideId: string;
  message: string;
  createdAt: string;
}

@Component({
  selector: 'app-notification-bell',
  templateUrl: './notification-bell.html',
})
export class NotificationBell {
  private readonly bellButton = viewChild<ElementRef<HTMLButtonElement>>('bellButton');

  readonly notifications = input<readonly NotificationItem[]>([]);
  readonly loadError = input<string | null>(null);
  readonly isOffline = input<boolean>(false);
  readonly offlineNotice = input<string>('');
  readonly opened = output<void>();
  readonly isOpen = signal(false);

  toggle(): void {
    const next = !this.isOpen();
    this.isOpen.set(next);
    if (next) {
      this.opened.emit();
    }
  }

  close(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.bellButton()?.nativeElement.focus();
  }
}
