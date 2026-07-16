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
  /**
   * VS Code activity-bar-style selected state, for rail buttons that toggle
   * a persistent panel (Explorer/Documents) rather than fire a one-off
   * action -- momentary-action buttons (New/Save/Upload/Templates) never
   * pass this and stay at its default false, unaffected visually.
   */
  @Input() active = false;
  /**
   * When set (non-null) this rail button is a menu trigger, vscode.dev
   * hamburger-style: it renders `aria-haspopup="menu"` and mirrors the
   * menu's open state through `aria-expanded` (which also keeps the
   * hover-wash fill while the menu is open). Plain action/toggle buttons
   * leave this null and render neither attribute.
   */
  @Input() menuExpanded: boolean | null = null;

  @Output() readonly clicked = new EventEmitter<void>();

  get paths(): string[] {
    return RAIL_ICON_PATHS[this.icon];
  }

  get tooltipText(): string {
    return this.shortcut ? `${this.label} (${this.shortcut})` : this.label;
  }
}
