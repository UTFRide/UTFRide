import { afterNextRender, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { Ride } from '../../../../core/models/ride.model';
import { CurrencyBrlPipe } from '../../../../shared/pipes/currency-brl-pipe';

const dragThreshold = 24;

@Component({
  imports: [CurrencyBrlPipe],
  selector: 'app-ride-request-confirm-panel',
  templateUrl: './ride-request-confirm-panel.html',
  host: { '(keydown.escape)': 'dismissed.emit()' },
})
export class RideRequestConfirmPanel {
  readonly ride = input.required<Ride>();
  readonly submitting = input.required<boolean>();
  readonly errorMessage = input('');
  readonly confirmed = output<void>();
  readonly dismissed = output<void>();

  protected readonly collapsed = signal(false);
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');
  private dragStart: { pointerId: number; y: number } | null = null;
  private ignorePointerClick = false;

  constructor() {
    afterNextRender({ write: () => this.heading().nativeElement.focus() });
  }

  protected toggleCollapsed(event: MouseEvent): void {
    if (this.ignorePointerClick && event.detail > 0) {
      this.ignorePointerClick = false;
      return;
    }
    this.collapsed.update((collapsed) => !collapsed);
  }

  protected startDrag(event: PointerEvent, handle: HTMLButtonElement): void {
    if (!event.isPrimary || event.button !== 0) return;
    this.dragStart = { pointerId: event.pointerId, y: event.clientY };
    this.ignorePointerClick = false;
    handle.setPointerCapture?.(event.pointerId);
  }

  protected finishDrag(event: PointerEvent, handle: HTMLButtonElement): void {
    if (this.dragStart?.pointerId !== event.pointerId) return;
    const delta = event.clientY - this.dragStart.y;
    this.dragStart = null;
    if (Math.abs(delta) < dragThreshold) return;

    // Impede que o clique gerado ao soltar o puxador reverta o gesto.
    this.ignorePointerClick = true;
    this.collapsed.set(delta > 0);
    handle.focus();
  }

  protected cancelDrag(event: PointerEvent): void {
    if (this.dragStart?.pointerId === event.pointerId) this.dragStart = null;
  }
}
