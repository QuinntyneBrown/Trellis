import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { switchMap } from 'rxjs/operators';

import { DocumentSummary } from '../../../core/models/document-summary.model';
import { DocumentsService } from '../../../core/services/documents.service';
import { DocumentListItemComponent } from '../document-list-item/document-list-item.component';
import { RenameEvent } from '../document-list-item/rename-event.model';

/**
 * Slide-out panel for quickly switching between saved documents from within
 * the editor, without leaving the editor route. Complements (rather than
 * replaces) the dedicated 'documents' list page.
 */
@Component({
  selector: 'app-documents-panel',
  standalone: true,
  imports: [DocumentListItemComponent],
  templateUrl: './documents-panel.component.html',
  styleUrl: './documents-panel.component.scss',
})
export class DocumentsPanelComponent implements OnChanges {
  @Input() open = false;

  @Output() readonly documentOpened = new EventEmitter<DocumentSummary>();

  private readonly documentsService = inject(DocumentsService);

  readonly documents = signal<DocumentSummary[]>([]);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      this.refresh();
    }
  }

  refresh(): void {
    this.documentsService.list().subscribe((documents) => this.documents.set(documents));
  }

  onOpen(document: DocumentSummary): void {
    this.documentOpened.emit(document);
  }

  onDelete(document: DocumentSummary): void {
    this.documentsService.delete(document.id).subscribe(() => this.refresh());
  }

  onRename(event: RenameEvent): void {
    this.documentsService
      .getById(event.document.id)
      .pipe(
        switchMap((full) =>
          this.documentsService.update(full.id, { name: event.newName, content: full.content }),
        ),
      )
      .subscribe(() => this.refresh());
  }
}
