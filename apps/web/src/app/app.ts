import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ErrorNotice } from './core/services/error-notice';
import { NetworkStatus } from './core/services/network-status';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly notice = inject(ErrorNotice);
  protected readonly network = inject(NetworkStatus);
  protected readonly title = signal('web');
}
