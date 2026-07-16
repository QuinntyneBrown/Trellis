import { Component, EventEmitter, Input, Output } from '@angular/core';

import { ExplorerTreeNode } from '../../../core/models/explorer-tree-node.model';
import { TreeContextMenuRequest } from '../../../shared/components/tree-context-menu/tree-context-menu.model';

const INDENT_STEP_PX = 16;
const BASE_PADDING_PX = 8;

export interface CreateEntryEvent {
  parent: ExplorerTreeNode;
  name: string;
  kind: 'file' | 'directory';
}

export interface DeleteEntryEvent {
  node: ExplorerTreeNode;
  parentNode: ExplorerTreeNode;
}

export interface ExplorerContextTarget {
  node: ExplorerTreeNode;
  parentNode: ExplorerTreeNode | null;
}

/** Recursive presentational row. Disk operations and context-menu commands are owned by ExplorerPanelComponent. */
@Component({
  selector: 'app-file-tree-node',
  standalone: true,
  imports: [FileTreeNodeComponent],
  templateUrl: './file-tree-node.component.html',
  styleUrl: './file-tree-node.component.scss',
})
export class FileTreeNodeComponent {
  @Input({ required: true }) node!: ExplorerTreeNode;
  @Input() depth = 0;
  @Input() parentNode: ExplorerTreeNode | null = null;
  @Input() contextMenuTarget: ExplorerTreeNode | null = null;

  @Output() readonly toggleExpand = new EventEmitter<ExplorerTreeNode>();
  @Output() readonly fileClicked = new EventEmitter<ExplorerTreeNode>();
  @Output() readonly contextMenuRequested = new EventEmitter<TreeContextMenuRequest<ExplorerContextTarget>>();

  get indentPx(): number {
    return BASE_PADDING_PX + this.depth * INDENT_STEP_PX;
  }

  onRowClick(): void {
    if (this.node.kind === 'directory') {
      this.toggleExpand.emit(this.node);
    } else {
      this.fileClicked.emit(this.node);
    }
  }

  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.emitContextMenu(event.clientX, event.clientY, event.currentTarget as HTMLElement);
  }

  onRowKeydown(event: KeyboardEvent): void {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      event.stopPropagation();
      const trigger = event.currentTarget as HTMLElement;
      const rect = trigger.getBoundingClientRect();
      this.emitContextMenu(rect.left + 24, rect.bottom, trigger);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      this.onRowClick();
    }
  }

  private emitContextMenu(clientX: number, clientY: number, triggerElement: HTMLElement): void {
    this.contextMenuRequested.emit({
      target: { node: this.node, parentNode: this.parentNode },
      clientX,
      clientY,
      triggerElement,
    });
  }
}
