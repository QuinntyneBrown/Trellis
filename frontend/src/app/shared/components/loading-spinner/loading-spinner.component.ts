import { Component } from '@angular/core';

/** Small presentational spinner used anywhere an async operation is pending. */
@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [],
  templateUrl: './loading-spinner.component.html',
  styleUrl: './loading-spinner.component.scss',
})
export class LoadingSpinnerComponent {}
