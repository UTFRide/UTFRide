import { Component, inject, signal } from '@angular/core';
import { ErrorNotice } from './core/services/error-notice';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly notice = inject(ErrorNotice);
  protected readonly title = signal('web');
}
