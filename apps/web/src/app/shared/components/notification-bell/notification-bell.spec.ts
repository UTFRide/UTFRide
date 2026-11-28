import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { NotificationBell, NotificationItem } from './notification-bell';

@Component({
  imports: [NotificationBell],
  template: `
    <app-notification-bell
      [notifications]="notifications()"
      [loadError]="loadError()"
      [isOffline]="isOffline()"
      [offlineNotice]="offlineNotice()"
      (opened)="openedCount = openedCount + 1"
    />
  `,
})
class NotificationBellHost {
  readonly notifications = signal<NotificationItem[]>([]);
  readonly loadError = signal<string | null>(null);
  readonly isOffline = signal(false);
  readonly offlineNotice = signal('');
  openedCount = 0;
}

describe('NotificationBell', () => {
  it('exibe contador quando há avisos, emite opened ao abrir e exibe estado vazio ou lista de avisos', async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationBellHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(NotificationBellHost);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    const bellButton = root.querySelector<HTMLButtonElement>(
      '[data-testid="notification-bell-button"]',
    )!;
    expect(bellButton.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector('[data-testid="notification-badge"]')).toBeNull();
    expect(root.querySelector('[data-testid="notifications-panel"]')).toBeNull();

    bellButton.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.openedCount).toBe(1);
    expect(bellButton.getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector('[data-testid="empty-notifications"]')?.textContent).toContain(
      'Você não possui avisos no momento.',
    );

    fixture.componentInstance.notifications.set([
      {
        id: 'notif-1',
        recipientId: 'passenger-1',
        rideId: 'ride-1',
        message: 'A carona Batel → UTFPR Neoville foi cancelada pelo motorista.',
        createdAt: '2026-01-01T10:00:00.000Z',
      },
    ]);
    await fixture.whenStable();

    expect(root.querySelector('[data-testid="notification-badge"]')?.textContent?.trim()).toBe('1');
    const items = root.querySelectorAll('[data-testid="notification-item"]');
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain(
      'A carona Batel → UTFPR Neoville foi cancelada pelo motorista.',
    );
  });

  it('fecha o painel com Escape (no botão do sino ou no painel) e pelo botão fechar, retornando o foco ao sino', async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationBellHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(NotificationBellHost);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    const bellButton = root.querySelector<HTMLButtonElement>(
      '[data-testid="notification-bell-button"]',
    )!;

    // 1. Abrir sino e pressionar Escape no próprio botão do sino
    bellButton.click();
    await fixture.whenStable();
    expect(root.querySelector('[data-testid="notifications-panel"]')).not.toBeNull();

    bellButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(root.querySelector('[data-testid="notifications-panel"]')).toBeNull();
    expect(bellButton.getAttribute('aria-expanded')).toBe('false');

    // 2. Reabrir, focar dentro do painel e pressionar Escape no painel
    bellButton.click();
    await fixture.whenStable();
    const panel = root.querySelector<HTMLElement>('[data-testid="notifications-panel"]')!;
    const closeButton = root.querySelector<HTMLButtonElement>(
      '[data-testid="close-notifications-button"]',
    )!;
    expect(panel.getAttribute('tabindex')).toBe('-1');
    closeButton.focus();
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();

    expect(root.querySelector('[data-testid="notifications-panel"]')).toBeNull();
    expect(document.activeElement).toBe(bellButton);

    // 3. Reabrir e fechar pelo botão fechar, retornando foco ao sino
    bellButton.click();
    await fixture.whenStable();
    const closeBtnAgain = root.querySelector<HTMLButtonElement>(
      '[data-testid="close-notifications-button"]',
    )!;
    closeBtnAgain.focus();
    closeBtnAgain.click();
    await fixture.whenStable();

    expect(root.querySelector('[data-testid="notifications-panel"]')).toBeNull();
    expect(document.activeElement).toBe(bellButton);
  });

  it('exibe erro de carregamento no painel em vez de estado vazio falso quando loadError está definido', async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationBellHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(NotificationBellHost);
    fixture.componentInstance.loadError.set(
      'Falha de conexão ao carregar avisos. Verifique sua internet e tente novamente.',
    );
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    const bellButton = root.querySelector<HTMLButtonElement>(
      '[data-testid="notification-bell-button"]',
    )!;
    bellButton.click();
    await fixture.whenStable();

    const errorAlert = root.querySelector<HTMLElement>('[data-testid="notifications-error"]');
    expect(errorAlert).not.toBeNull();
    expect(errorAlert!.getAttribute('role')).toBe('alert');
    expect(errorAlert!.textContent).toContain('Falha de conexão ao carregar avisos');
    expect(root.querySelector('[data-testid="empty-notifications"]')).toBeNull();
    expect(root.textContent).not.toContain('Você não possui avisos no momento.');

    fixture.componentInstance.loadError.set(null);
    fixture.componentInstance.notifications.set([
      {
        id: 'notif-1',
        recipientId: 'passenger-1',
        rideId: 'ride-1',
        message: 'A carona Batel → UTFPR Neoville foi cancelada pelo motorista.',
        createdAt: '2026-01-01T10:00:00.000Z',
      },
    ]);
    await fixture.whenStable();

    expect(root.querySelector('[data-testid="notifications-error"]')).toBeNull();
    expect(root.querySelectorAll('[data-testid="notification-item"]').length).toBe(1);
  });

  it('exibe avisos em cache e explicação de atualização indisponível quando offline e remove aviso ao voltar online', async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationBellHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(NotificationBellHost);
    const offlineMessage =
      'Conecte-se à internet novamente para habilitar todas as funções do app UTFRide novamente';
    fixture.componentInstance.notifications.set([
      {
        id: 'notif-cached-1',
        recipientId: 'passenger-1',
        rideId: 'ride-1',
        message: 'A carona Batel → UTFPR Neoville foi cancelada pelo motorista.',
        createdAt: '2026-01-01T10:00:00.000Z',
      },
    ]);
    fixture.componentInstance.isOffline.set(true);
    fixture.componentInstance.offlineNotice.set(offlineMessage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="notification-badge"]')?.textContent?.trim()).toBe('1');

    const bellButton = root.querySelector<HTMLButtonElement>(
      '[data-testid="notification-bell-button"]',
    )!;
    bellButton.click();
    await fixture.whenStable();

    const offlineBanner = root.querySelector<HTMLElement>(
      '[data-testid="notifications-offline-notice"]',
    );
    expect(offlineBanner).not.toBeNull();
    expect(offlineBanner!.getAttribute('role')).toBe('status');
    expect(offlineBanner!.textContent).toContain('cache');
    expect(offlineBanner!.textContent).toContain(offlineMessage);

    const items = root.querySelectorAll('[data-testid="notification-item"]');
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain(
      'A carona Batel → UTFPR Neoville foi cancelada pelo motorista.',
    );

    fixture.componentInstance.isOffline.set(false);
    await fixture.whenStable();

    expect(root.querySelector('[data-testid="notifications-offline-notice"]')).toBeNull();
    expect(root.querySelectorAll('[data-testid="notification-item"]').length).toBe(1);
  });
});
