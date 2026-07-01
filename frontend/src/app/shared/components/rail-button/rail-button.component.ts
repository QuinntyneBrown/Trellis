import { Component, EventEmitter, Input, Output } from '@angular/core';

import { RAIL_ICON_PATHS, RailIconName } from './rail-icons';

/**
 * VS Code activity-bar-style icon button: a 40x40 icon-only button with a
 * hover/focus-revealed tooltip. `tooltipText` is the single source of truth
 * for both the visible tooltip and the `aria-label`, so the two can never
 * drift apart from one another.
 */
@Component({
  selector: 'app-rail-button',
  standalone: true,
  imports: [],
  templateUrl: './rail-button.component.html',
  styleUrl: './rail-button.component.scss',
})
export class RailButtonComponent {
  @Input({ required: true }) icon!: RailIconName;
  @Input({ required: true }) label = '';
  @Input() shortcut?: string;
  @Input({ required: true }) testId!: string;

  @Output() readonly clicked = new EventEmitter<void>();

  get paths(): string[] {
    return RAIL_ICON_PATHS[this.icon];
  }

  get tooltipText(): string {
    return this.shortcut ? `${this.label} (${this.shortcut})` : this.label;
  }
}
