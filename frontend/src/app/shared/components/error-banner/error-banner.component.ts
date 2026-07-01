import { Component, Input } from '@angular/core';

/** Small presentational error message banner, reused across features. */
@Component({
  selector: 'app-error-banner',
  standalone: true,
  imports: [],
  templateUrl: './error-banner.component.html',
  styleUrl: './error-banner.component.scss',
})
export class ErrorBannerComponent {
  @Input() message: string | null = null;
}
