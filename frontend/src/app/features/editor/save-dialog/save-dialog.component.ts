import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DocumentKind } from '../../../core/models/document-kind.model';
import { Folder } from '../../../core/models/folder.model';
import { FolderOption, flattenFolderOptions } from '../../../shared/folder-options';

/** Emitted by the save dialog's Save button. */
export interface SaveDialogResult {
  name: string;
  /** The chosen destination folder's id, or null for the root ("(No folder)"). */
  folderId: string | null;
  /** The chosen document kind (only choosable while kindSelectionEnabled; otherwise the seeded value). */
  kind: DocumentKind;
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
  /** Dialog title -- "Save document" normally, "Save Document As" for the Ctrl+Shift+S flow. */
  @Input() heading = 'Save document';
  @Input() initialName = '';
  @Input() folders: Folder[] = [];
  /**
   * Whether the destination-folder select is shown. Only true for
   * first-time saves: an existing document's folder isn't changed on
   * re-save (moving lives in the Documents panel), so offering the select
   * there would silently discard the user's choice.
   */
  @Input() folderSelectionEnabled = false;
  /**
   * Whether the document Type select is shown -- same create-only rule as
   * the folder select: the kind is fixed once a document exists.
   */
  @Input() kindSelectionEnabled = false;
  /** Seeds the Type select on open with what the editor is currently holding. */
  @Input() initialKind: DocumentKind = 'plantuml';

  @Output() readonly confirm = new EventEmitter<SaveDialogResult>();
  @Output() readonly cancel = new EventEmitter<void>();

  readonly name = signal('');
  /** null = "(No folder)" = root; reset on every open so a prior choice never leaks into the next save. */
  readonly selectedFolderId = signal<string | null>(null);
  /** Re-seeded from initialKind on every open, mirroring selectedFolderId's no-leak rule. */
  readonly selectedKind = signal<DocumentKind>('plantuml');

  folderOptions: FolderOption[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.name.set(this.initialName);
      this.selectedFolderId.set(null);
      this.selectedKind.set(this.initialKind);
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

  onKindChange(value: string): void {
    this.selectedKind.set(value === 'markdown' ? 'markdown' : 'plantuml');
  }

  onConfirmClicked(): void {
    const trimmed = this.name().trim();
    if (trimmed) {
      this.confirm.emit({ name: trimmed, folderId: this.selectedFolderId(), kind: this.selectedKind() });
    }
  }

  onCancelClicked(): void {
    this.cancel.emit();
  }
}
