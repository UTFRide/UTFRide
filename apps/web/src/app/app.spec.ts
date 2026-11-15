import { TestBed } from '@angular/core/testing';
import { ErrorNotice } from './core/services/error-notice';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
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
});
