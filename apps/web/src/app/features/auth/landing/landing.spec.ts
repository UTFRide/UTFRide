import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';

describe('Landing institucional', () => {
  it('apresenta a marca no destaque e a imagem do campus', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const harness = await RouterTestingHarness.create('/');
    const root = harness.routeNativeElement as HTMLElement;
    expect(root.querySelector('section img[alt*="UTFRide"]')).not.toBeNull();
    expect(root.querySelector('header img[alt*="UTFRide"]')).not.toBeNull();
    expect(root.querySelector('[role="img"][aria-label*="campus"]')).not.toBeNull();
  });
});
