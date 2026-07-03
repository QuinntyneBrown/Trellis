import { Component, EventEmitter, Input, Output } from '@angular/core';

import { TREE_ACTION_ICON_PATHS, TreeActionIconName } from './tree-action-icons';

/**
 * Compact icon-only action button for tree rows, shared by the Explorer's
 * file-tree-node, the Documents panel's document-tree-node, and the Documents
 * panel header -- the in-row sibling of the activity bar's RailButtonComponent.
 *
 * `label` is the single source of truth for both the native `title` tooltip
 * and the `aria-label`, so the two can never drift apart. A native title is
 * used (not rail-button's absolutely-positioned tooltip span) because these
 * buttons repeat in every row inside an overflow-y:auto panel, where a
 * positioned span would clip against the scroll container.
 *
 * `clicked` re-emits the original MouseEvent: emission is synchronous during
 * native event propagation, so parents keep their established
 * `event.stopPropagation()`-first handler convention unchanged.
 */
@Component({
  selector: 'app-tree-action-button',
  standalone: true,
  imports: [],
  templateUrl: './tree-action-button.component.html',
  styleUrl: './tree-action-button.component.scss',
})
export class TreeActionButtonComponent {
  @Input({ required: true }) icon!: TreeActionIconName;
  @Input({ required: true }) label = '';
  @Input({ required: true }) testId!: string;
  /** Destructive actions (Delete) render in the danger palette. */
  @Input() danger = false;

  @Output() readonly clicked = new EventEmitter<MouseEvent>();

  get paths(): string[] {
    return TREE_ACTION_ICON_PATHS[this.icon];
  }
}
