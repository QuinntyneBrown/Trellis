import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Folder } from '../../../core/models/folder.model';
import { FolderOption, flattenFolderOptions } from './folder-options';

/** Emitted by the save dialog's Save button. */
export interface SaveDialogResult {
  name: string;
  /** The chosen destination folder's id, or null for the root ("(No folder)"). */
  folderId: string | null;
}

/**
 * Modal prompting for a document name (and, for first-time saves, a
 * destination folder) before it is created/updated. Purely presentational:
 * the folder list arrives via the `folders` input -- EditorPageComponent
 * fetches it when opening the dialog.
 */
@Component({
  selector: 'app-save-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './save-dialog.component.html',
  styleUrl: './save-dialog.component.scss',
})
export class SaveDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() initialName = '';
  @Input() folders: Folder[] = [];
  /**
   * Whether the destination-folder select is shown. Only true for
   * first-time saves: an existing document's folder cannot be changed
   * (moving is unsupported), so offering the select there would silently
   * discard the user's choice.
   */
  @Input() folderSelectionEnabled = false;

  @Output() readonly confirm = new EventEmitter<SaveDialogResult>();
  @Output() readonly cancel = new EventEmitter<void>();

  readonly name = signal('');
  /** null = "(No folder)" = root; reset on every open so a prior choice never leaks into the next save. */
  readonly selectedFolderId = signal<string | null>(null);

  folderOptions: FolderOption[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.name.set(this.initialName);
      this.selectedFolderId.set(null);
    }
    if (changes['folders']) {
      this.folderOptions = flattenFolderOptions(this.folders);
    }
  }

  onNameInput(value: string): void {
    this.name.set(value);
  }

  /** The select's empty-string value maps to null (root). */
  onFolderChange(value: string): void {
    this.selectedFolderId.set(value || null);
  }

  onConfirmClicked(): void {
    const trimmed = this.name().trim();
    if (trimmed) {
      this.confirm.emit({ name: trimmed, folderId: this.selectedFolderId() });
    }
  }

  onCancelClicked(): void {
    this.cancel.emit();
  }
}
