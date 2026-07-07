import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DocumentKind } from '../../../core/models/document-kind.model';
import { Folder } from '../../../core/models/folder.model';
import { FolderOption, flattenFolderOptions } from '../../../shared/folder-options';

/** Emitted by the new-document dialog's Create button. */
export interface NewDocumentDialogResult {
  name: string;
  /** The chosen destination folder's id, or null for the root ("(No folder)"). */
  folderId: string | null;
  kind: DocumentKind;
  /** Whether the dialog should stay open (name cleared) for another create, rather than closing. */
  createAnother: boolean;
}

/**
 * Modal for creating a brand-new blank document -- always a create (unlike
 * SaveDialogComponent, which doubles as the update flow), so Type and Folder
 * are always shown. Purely presentational: the folder list arrives via the
 * `folders` input, and EditorPageComponent performs the actual create call
 * and decides what happens on success.
 */
@Component({
  selector: 'app-new-document-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './new-document-dialog.component.html',
  styleUrl: './new-document-dialog.component.scss',
})
export class NewDocumentDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() folders: Folder[] = [];
  /**
   * Bumped by the host after each successful "create another" so the name
   * field clears (and regains focus) for the next entry, while the Folder
   * and Type choices carry over -- distinct from the full re-seed below,
   * which only runs when the dialog transitions from closed to open.
   */
  @Input() clearNameToken = 0;

  @Output() readonly create = new EventEmitter<NewDocumentDialogResult>();
  @Output() readonly close = new EventEmitter<void>();

  @ViewChild('nameInput') private readonly nameInputRef?: ElementRef<HTMLInputElement>;

  readonly name = signal('');
  /** null = "(No folder)" = root. */
  readonly selectedFolderId = signal<string | null>(null);
  readonly selectedKind = signal<DocumentKind>('plantuml');
  readonly createAnother = signal(false);

  folderOptions: FolderOption[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.name.set('');
      this.selectedFolderId.set(null);
      this.selectedKind.set('plantuml');
      this.createAnother.set(false);
    }
    if (changes['folders']) {
      this.folderOptions = flattenFolderOptions(this.folders);
    }
    if (changes['clearNameToken'] && !changes['clearNameToken'].isFirstChange()) {
      this.name.set('');
      this.focusNameInput();
    }
  }

  private focusNameInput(): void {
    this.nameInputRef?.nativeElement.focus();
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

  onCreateAnotherChange(value: boolean): void {
    this.createAnother.set(value);
  }

  onCreateClicked(): void {
    const trimmed = this.name().trim();
    if (!trimmed) {
      return;
    }
    this.create.emit({
      name: trimmed,
      folderId: this.selectedFolderId(),
      kind: this.selectedKind(),
      createAnother: this.createAnother(),
    });
  }

  onCloseClicked(): void {
    this.close.emit();
  }
}
