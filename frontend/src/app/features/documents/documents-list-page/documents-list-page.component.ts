import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { switchMap } from 'rxjs/operators';

import { DocumentSummary } from '../../../core/models/document-summary.model';
import { DocumentsService } from '../../../core/services/documents.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { DocumentListItemComponent } from '../document-list-item/document-list-item.component';
import { RenameEvent } from '../document-list-item/rename-event.model';

/** Routed 'documents' page listing every saved document. */
@Component({
  selector: 'app-documents-list-page',
  standalone: true,
  imports: [DocumentListItemComponent, LoadingSpinnerComponent],
  templateUrl: './documents-list-page.component.html',
  styleUrl: './documents-list-page.component.scss',
})
export class DocumentsListPageComponent {
  private readonly documentsService = inject(DocumentsService);
  private readonly router = inject(Router);

  readonly documents = signal<DocumentSummary[]>([]);
  readonly isLoading = signal(true);

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.isLoading.set(true);
    this.documentsService.list().subscribe((documents) => {
      this.documents.set(documents);
      this.isLoading.set(false);
    });
  }

  onOpen(document: DocumentSummary): void {
    void this.router.navigate(['/editor', document.id]);
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
