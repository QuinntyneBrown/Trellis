import { Component, EventEmitter, Input, Output } from '@angular/core';

import { DocumentSummary } from '../../../core/models/document-summary.model';
import { RenameEvent } from './rename-event.model';

/** A single row in a documents list, with open/rename/delete actions. */
@Component({
  selector: 'app-document-list-item',
  standalone: true,
  imports: [],
  templateUrl: './document-list-item.component.html',
  styleUrl: './document-list-item.component.scss',
})
export class DocumentListItemComponent {
  @Input({ required: true }) document!: DocumentSummary;

  @Output() readonly open = new EventEmitter<DocumentSummary>();
  @Output() readonly delete = new EventEmitter<DocumentSummary>();
  @Output() readonly rename = new EventEmitter<RenameEvent>();

  onOpenClicked(): void {
    this.open.emit(this.document);
  }

  onDeleteClicked(): void {
    if (window.confirm(`Delete "${this.document.name}"? This cannot be undone.`)) {
      this.delete.emit(this.document);
    }
  }

  onRenameClicked(): void {
    const newName = window.prompt('Rename document', this.document.name);
    const trimmed = newName?.trim();
    if (trimmed && trimmed !== this.document.name) {
      this.rename.emit({ document: this.document, newName: trimmed });
    }
  }
}
