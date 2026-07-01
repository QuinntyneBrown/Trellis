import { Location } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { Document } from '../../../core/models/document.model';
import { DocumentSummary } from '../../../core/models/document-summary.model';
import { Template } from '../../../core/models/template.model';
import { DiagramHubService } from '../../../core/services/diagram-hub.service';
import { DocumentsService } from '../../../core/services/documents.service';
import { EditorLayoutPreferencesService } from '../../../core/services/editor-layout-preferences.service';
import { DocumentsPanelComponent } from '../../documents/documents-panel/documents-panel.component';
import { DiagramPreviewComponent } from '../diagram-preview/diagram-preview.component';
import { MIN_EDITOR_PANE_RATIO, MAX_EDITOR_PANE_RATIO } from '../editor-pane-ratio.constants';
import { EditorToolbarComponent } from '../editor-toolbar/editor-toolbar.component';
import { MonacoEditorComponent } from '../monaco-editor/monaco-editor.component';
import { ResizeDividerComponent } from '../resize-divider/resize-divider.component';
import { clampRatio } from '../resize-divider/clamp-ratio';
import { SaveDialogComponent } from '../save-dialog/save-dialog.component';

const BLANK_DOCUMENT_NAME = 'Untitled diagram';

/**
 * Route root for both 'editor' (blank) and 'editor/:documentId' (resolved
 * document). Owns the document identity/name/content state and wires the
 * Monaco editor, toolbar, live preview and save/documents panels together.
 */
@Component({
  selector: 'app-editor-page',
  standalone: true,
  imports: [
    MonacoEditorComponent,
    EditorToolbarComponent,
    DiagramPreviewComponent,
    ResizeDividerComponent,
    SaveDialogComponent,
    DocumentsPanelComponent,
  ],
  templateUrl: './editor-page.component.html',
  styleUrl: './editor-page.component.scss',
})
export class EditorPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly documentsService = inject(DocumentsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly layoutPreferences = inject(EditorLayoutPreferencesService);
  readonly hubService = inject(DiagramHubService);

  // Exposed as fields (rather than referenced as free module-level constants)
  // because the template binds [minRatio]/[maxRatio] on <app-resize-divider>,
  // and Angular templates can only bind to members of the component instance.
  readonly MIN_EDITOR_PANE_RATIO = MIN_EDITOR_PANE_RATIO;
  readonly MAX_EDITOR_PANE_RATIO = MAX_EDITOR_PANE_RATIO;

  readonly documentId = signal<string | null>(null);
  readonly documentName = signal<string>(BLANK_DOCUMENT_NAME);
  readonly sourceCode = signal<string>('');
  /** The last-saved (or last-loaded) content, used to detect unsaved edits. */
  readonly savedSourceCode = signal<string>('');

  readonly isSaveDialogOpen = signal(false);
  readonly isDocumentsPanelOpen = signal(false);

  // Seeded from persisted preferences (clamped to the divider's own UX
  // bounds, since the preferences service only enforces the much looser
  // (0, 1) structural invariant, not these product-level min/max).
  readonly editorPaneRatio = signal(
    clampRatio(this.layoutPreferences.getEditorPaneRatio(), MIN_EDITOR_PANE_RATIO, MAX_EDITOR_PANE_RATIO),
  );
  readonly editorPaneRatioPercent = computed(() => this.editorPaneRatio() * 100);

  /** Monotonically increasing token identifying the most recent upload; see onFileSelected. */
  private uploadSequence = 0;

  readonly hasUnsavedChanges = computed(
    () => this.sourceCode().trim().length > 0 && this.sourceCode() !== this.savedSourceCode(),
  );

  ngOnInit(): void {
    // Subscribed (rather than a one-off snapshot read) because Angular's
    // default route reuse strategy keeps this component alive when
    // navigating between 'editor/:documentId' instances -- only the
    // resolved route data changes, ngOnInit does not re-run.
    this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      this.applyDocument((data['document'] as Document | null | undefined) ?? null);
    });
  }

  private applyDocument(document: Document | null): void {
    if (document) {
      this.documentId.set(document.id);
      this.documentName.set(document.name);
      this.sourceCode.set(document.content);
      this.savedSourceCode.set(document.content);
      // Loading a document's real, saved content is expected to update the
      // preview to match it immediately, rather than leaving the preview
      // showing whatever was rendered previously (or the placeholder).
      void this.hubService.render(document.content);
    } else {
      this.documentId.set(null);
      this.documentName.set(BLANK_DOCUMENT_NAME);
      this.sourceCode.set('');
      this.savedSourceCode.set('');
    }
  }

  onEditorValueChange(value: string): void {
    this.sourceCode.set(value);
  }

  onRenderRequested(value: string): void {
    void this.hubService.render(value);
  }

  /**
   * Live layout updates during an in-progress drag/nudge -- deliberately
   * does NOT persist. A drag can fire this dozens of times per second, and
   * calling localStorage.setItem that often would be wasteful (and, in the
   * worst case, noticeably janky).
   */
  onDividerRatioChange(ratio: number): void {
    this.editorPaneRatio.set(ratio);
  }

  /**
   * Fired exactly once per completed resize gesture (pointerup, a single
   * arrow-key nudge, or a dblclick-reset) -- the only point at which the
   * chosen ratio is persisted.
   */
  onDividerResizeEnd(ratio: number): void {
    this.editorPaneRatio.set(ratio);
    this.layoutPreferences.setEditorPaneRatio(ratio);
  }

  onNewDocument(): void {
    if (this.hasUnsavedChanges() && !window.confirm('Discard unsaved changes and start a new document?')) {
      return;
    }
    this.applyDocument(null);
    this.location.go('/editor');
  }

  onSaveClicked(): void {
    this.isSaveDialogOpen.set(true);
  }

  onSaveConfirm(name: string): void {
    // Deliberately NOT closed until the request actually succeeds: closing
    // optimistically here would let a caller (or a test) observe "dialog is
    // hidden" as a false signal that the save has landed, while the
    // create/update request is still in flight.
    const id = this.documentId();

    const request$ = id
      ? this.documentsService.update(id, { name, content: this.sourceCode() })
      : this.documentsService.create({ name, content: this.sourceCode() });

    request$.subscribe((saved) => {
      this.isSaveDialogOpen.set(false);
      this.documentName.set(saved.name);
      this.savedSourceCode.set(saved.content);
      if (!id) {
        this.documentId.set(saved.id);
        // Reflects the newly created document's id in the URL (for
        // deep-linking/refresh) without routing through the Router - we
        // already have the authoritative saved document in hand, so there is
        // nothing for a resolver-driven re-fetch to usefully add, and doing
        // one here would race any content change already in flight (see
        // onFileSelected).
        this.location.go(`/editor/${saved.id}`);
      }
    });
  }

  onSaveCancel(): void {
    this.isSaveDialogOpen.set(false);
  }

  onFileSelected(file: File): void {
    // Guards against a slow *previous* upload's response arriving after a
    // faster, more recent one and clobbering its result: only the response
    // matching the most recently initiated upload is ever applied.
    const uploadToken = ++this.uploadSequence;

    // Read via FileReader (rather than the newer Blob.text()) so this also
    // works against jsdom's FileReader implementation in unit tests.
    void readFileAsText(file).then((text) => {
      if (uploadToken === this.uploadSequence) {
        this.sourceCode.set(text);
      }
    });

    this.documentsService.upload(file, this.documentId() ?? undefined).subscribe((saved) => {
      if (uploadToken !== this.uploadSequence) {
        return;
      }
      this.applyDocument(saved);
      this.location.go(`/editor/${saved.id}`);
    });
  }

  onTemplateSelected(template: Template): void {
    if (this.hasUnsavedChanges() && !window.confirm('Discard unsaved changes and load this template?')) {
      return;
    }
    this.sourceCode.set(template.content);
  }

  onDocumentsPanelToggle(): void {
    this.isDocumentsPanelOpen.update((open) => !open);
  }

  onDocumentOpenedFromPanel(document: DocumentSummary): void {
    this.isDocumentsPanelOpen.set(false);

    // Always fetches directly (rather than routing through the Router,
    // whose default onSameUrlNavigation is 'ignore' and would otherwise
    // silently no-op when re-opening the document that is already active)
    // so "open" always reloads the real saved content from the server, and
    // updates the URL via Location rather than Router.navigate so this
    // can never race a resolver-driven re-fetch of possibly-stale data.
    this.documentsService.getById(document.id).subscribe((full) => this.applyDocument(full));
    this.location.go(`/editor/${document.id}`);
  }
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
