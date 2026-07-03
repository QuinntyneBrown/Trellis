import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Folder } from '../../../core/models/folder.model';
import { FolderOption, flattenFolderOptions } from '../../../shared/folder-options';

/** Emitted by the move dialog's Move button. */
export interface MoveDocumentDialogResult {
  /** The chosen destination folder's id, or null for the root ("(No folder)"). */
  folderId: string | null;
}

/**
 * Modal prompting for a document's destination folder -- the
 * keyboard-accessible fallback to dragging a document row onto a folder.
 * Purely presentational, mirroring SaveDialogComponent: the folder list
 * arrives via the `folders` input and DocumentsPanelComponent owns the
 * open/close state and the actual move call.
 */
@Component({
  selector: 'app-move-document-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './move-document-dialog.component.html',
  styleUrl: './move-document-dialog.component.scss',
})
export class MoveDocumentDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() documentName = '';
  @Input() folders: Folder[] = [];
  /** The document's current folder, preselected on open so "no change" is the default. */
  @Input() currentFolderId: string | null = null;

  @Output() readonly confirm = new EventEmitter<MoveDocumentDialogResult>();
  @Output() readonly cancel = new EventEmitter<void>();

  /** null = "(No folder)" = root; re-seeded from currentFolderId on every open. */
  readonly selectedFolderId = signal<string | null>(null);

  folderOptions: FolderOption[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.selectedFolderId.set(this.currentFolderId);
    }
    if (changes['folders']) {
      this.folderOptions = flattenFolderOptions(this.folders);
    }
  }

  /** The select's empty-string value maps to null (root). */
  onFolderChange(value: string): void {
    this.selectedFolderId.set(value || null);
  }

  onConfirmClicked(): void {
    this.confirm.emit({ folderId: this.selectedFolderId() });
  }

  onCancelClicked(): void {
    this.cancel.emit();
  }
}
