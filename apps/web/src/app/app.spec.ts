import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorNotice } from './core/services/error-notice';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('apresenta e permite fechar uma notificação de falha', async () => {
    const fixture = TestBed.createComponent(App);
    TestBed.inject(ErrorNotice).message.set('Falha no servidor. Tente novamente.');
    await fixture.whenStable();
    const alert = (fixture.nativeElement as HTMLElement).querySelector('[role=alert]')!;
    expect(alert.textContent).toContain('Falha no servidor');
    alert.querySelector('button')!.click();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role=alert]')).toBeNull();
  });

  it('should render the router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });

  it('não exibe o banner offline enquanto o navegador está online', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const banner = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="offline-banner"]');
    expect(banner).toBeNull();
  });

  it('exibe o banner offline com estilo Opção C ao perder conexão e remove automaticamente ao voltar online', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="offline-banner"]')).toBeNull();

    window.dispatchEvent(new Event('offline'));
    await fixture.whenStable();

    const banner = root.querySelector('[data-testid="offline-banner"]');
    expect(banner).not.toBeNull();
    expect(banner?.getAttribute('role')).toBe('status');
    expect(banner?.textContent).toContain('Você está offline. Visualizando dados salvos');
    expect(banner?.classList.contains('bg-primaria')).toBe(true);
    expect(banner?.classList.contains('text-texto')).toBe(true);
    expect(banner?.classList.contains('border-b')).toBe(true);
    expect(banner?.classList.contains('border-borda')).toBe(true);

    window.dispatchEvent(new Event('online'));
    await fixture.whenStable();

    expect(root.querySelector('[data-testid="offline-banner"]')).toBeNull();
  });

  it('exibe o banner offline imediatamente quando navigator.onLine inicia falso', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const banner = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="offline-banner"]');
    expect(banner).not.toBeNull();
    expect(banner?.getAttribute('role')).toBe('status');
    expect(banner?.textContent).toContain('Você está offline. Visualizando dados salvos');
  });
});
