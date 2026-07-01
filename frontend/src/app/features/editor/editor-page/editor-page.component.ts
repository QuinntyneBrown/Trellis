import { Location } from '@angular/common';
import { Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { Document } from '../../../core/models/document.model';
import { DocumentSummary } from '../../../core/models/document-summary.model';
import { OpenedDiskFile } from '../../../core/models/opened-disk-file.model';
import { Template } from '../../../core/models/template.model';
import { DiagramHubService } from '../../../core/services/diagram-hub.service';
import { DocumentsService } from '../../../core/services/documents.service';
import { EditorLayoutPreferencesService } from '../../../core/services/editor-layout-preferences.service';
import { FileSystemAccessService } from '../../../core/services/file-system-access.service';
import { ErrorBannerComponent } from '../../../shared/components/error-banner/error-banner.component';
import { DocumentsPanelComponent } from '../../documents/documents-panel/documents-panel.component';
import { ExplorerPanelComponent } from '../../explorer/explorer-panel/explorer-panel.component';
import { DiagramPreviewComponent } from '../diagram-preview/diagram-preview.component';
import { MIN_EDITOR_PANE_RATIO, MAX_EDITOR_PANE_RATIO } from '../editor-pane-ratio.constants';
import { EditorToolbarComponent } from '../editor-toolbar/editor-toolbar.component';
import { MonacoEditorComponent } from '../monaco-editor/monaco-editor.component';
import { clampWidthPx } from '../pixel-resize-divider/clamp-width';
import { PixelResizeDividerComponent } from '../pixel-resize-divider/pixel-resize-divider.component';
import { ResizeDividerComponent } from '../resize-divider/resize-divider.component';
import { clampRatio } from '../resize-divider/clamp-ratio';
import { SaveDialogComponent } from '../save-dialog/save-dialog.component';
import { MIN_SIDE_PANEL_WIDTH_PX, MAX_SIDE_PANEL_WIDTH_PX } from '../side-panel-width.constants';

const BLANK_DOCUMENT_NAME = 'Untitled diagram';

/** Which (if either) of the exclusive side panels is currently showing. */
export type SidePanel = 'explorer' | 'documents' | null;

/**
 * Route root for both 'editor' (blank) and 'editor/:documentId' (resolved
 * document). Owns the document identity/name/content state and wires the
 * Monaco editor, toolbar, live preview and side-panel/save surfaces
 * together.
 */
@Component({
  selector: 'app-editor-page',
  standalone: true,
  imports: [
    MonacoEditorComponent,
    EditorToolbarComponent,
    DiagramPreviewComponent,
    ResizeDividerComponent,
    PixelResizeDividerComponent,
    SaveDialogComponent,
    DocumentsPanelComponent,
    ExplorerPanelComponent,
    ErrorBannerComponent,
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
  private readonly fileSystemAccessService = inject(FileSystemAccessService);
  readonly hubService = inject(DiagramHubService);

  // Exposed as fields (rather than referenced as free module-level constants)
  // because the template binds [minRatio]/[maxRatio]/[minWidthPx]/
  // [maxWidthPx] on <app-resize-divider>/<app-pixel-resize-divider>, and
  // Angular templates can only bind to members of the component instance.
  readonly MIN_EDITOR_PANE_RATIO = MIN_EDITOR_PANE_RATIO;
  readonly MAX_EDITOR_PANE_RATIO = MAX_EDITOR_PANE_RATIO;
  readonly MIN_SIDE_PANEL_WIDTH_PX = MIN_SIDE_PANEL_WIDTH_PX;
  readonly MAX_SIDE_PANEL_WIDTH_PX = MAX_SIDE_PANEL_WIDTH_PX;

  readonly documentId = signal<string | null>(null);
  readonly documentName = signal<string>(BLANK_DOCUMENT_NAME);
  readonly sourceCode = signal<string>('');
  /** The last-saved (or last-loaded) content, used to detect unsaved edits. */
  readonly savedSourceCode = signal<string>('');

  readonly isSaveDialogOpen = signal(false);

  /**
   * The single shared selection behind both the Explorer and Documents rail
   * icons: setting one value always replaces whatever was there (giving
   * exclusivity for free -- opening one panel always closes the other), and
   * toggleSidePanel's use of .update() gives the VS-Code-real
   * click-the-active-icon-to-collapse behavior for free too.
   */
  readonly activeSidePanel = signal<SidePanel>(null);

  /** Computed once -- the browser either has the File System Access API or it doesn't, for the whole session. */
  readonly explorerSupported = this.fileSystemAccessService.isSupported();

  /** Set when the currently-open document/content came from a local disk file rather than the SQLite backend. */
  readonly openFileHandle = signal<FileSystemFileHandle | null>(null);
  /** Surfaced through app-error-banner when a direct disk write (see performDiskSave) fails. */
  readonly diskSaveError = signal<string | null>(null);

  // Seeded from persisted preferences (clamped to the divider's own UX
  // bounds, since the preferences service only enforces the much looser
  // (0, 1) structural invariant, not these product-level min/max).
  readonly editorPaneRatio = signal(
    clampRatio(this.layoutPreferences.getEditorPaneRatio(), MIN_EDITOR_PANE_RATIO, MAX_EDITOR_PANE_RATIO),
  );
  readonly editorPaneRatioPercent = computed(() => this.editorPaneRatio() * 100);

  // Seeded the same way, but pixel-native (no percent conversion needed --
  // the side panel's width is bound directly in px, not as a flex-basis
  // percentage of its container).
  readonly sidePanelWidthPx = signal(
    clampWidthPx(this.layoutPreferences.getSidePanelWidthPx(), MIN_SIDE_PANEL_WIDTH_PX, MAX_SIDE_PANEL_WIDTH_PX),
  );

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
    // Shared by every flow that replaces the editor's content wholesale
    // (New, Documents-panel open, upload, route-resolved load) -- any of
    // those loading real SQLite-backed (or blank) content means whatever
    // disk file handle was previously open no longer applies.
    this.openFileHandle.set(null);

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

  /** Live layout updates during an in-progress side-panel drag/nudge -- deliberately does NOT persist; see onDividerRatioChange. */
  onSidePanelDividerWidthChange(px: number): void {
    this.sidePanelWidthPx.set(px);
  }

  /** Fired exactly once per completed side-panel resize gesture -- the only point at which the chosen width is persisted. */
  onSidePanelDividerResizeEnd(px: number): void {
    this.sidePanelWidthPx.set(px);
    this.layoutPreferences.setSidePanelWidthPx(px);
  }

  onNewDocument(): void {
    if (this.hasUnsavedChanges() && !window.confirm('Discard unsaved changes and start a new document?')) {
      return;
    }
    this.applyDocument(null);
    this.location.go('/editor');
  }

  onSaveClicked(): void {
    if (this.openFileHandle()) {
      this.performDiskSave();
      return;
    }
    this.isSaveDialogOpen.set(true);
  }

  onSaveConfirm(name: string): void {
    this.performSave(name);
  }

  onSaveCancel(): void {
    this.isSaveDialogOpen.set(false);
  }

  /**
   * Ctrl/Cmd+S quick-save, mirroring VS Code: a disk-backed file (see
   * openFileHandle) always performs a silent, no-dialog, no-name-prompt
   * direct write straight to that file -- checked first, before any of the
   * SQLite-document branching below even runs. Otherwise: a no-op while the
   * dialog is already open (avoids double-triggering mid-dialog) or while
   * there is nothing unsaved; otherwise saves immediately under the current
   * name if this document already has an id, or opens the save dialog for a
   * first-time save (there is no name yet to quick-save with). The native
   * Save-Page-As dialog is prevented unconditionally on every matching
   * keypress, even on the no-op paths above, since letting it fire even once
   * would be jarring.
   */
  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') {
      return;
    }

    event.preventDefault();

    if (this.openFileHandle()) {
      this.performDiskSave();
      return;
    }

    if (this.isSaveDialogOpen()) {
      return;
    }
    if (!this.hasUnsavedChanges()) {
      return;
    }

    if (this.documentId()) {
      this.performSave(this.documentName());
    } else {
      this.onSaveClicked();
    }
  }

  /**
   * Shared by the save dialog's confirm and the Ctrl/Cmd+S quick-save: not
   * closed until the request actually succeeds -- closing optimistically
   * here would let a caller (or a test) observe "dialog is hidden" as a
   * false signal that the save has landed, while the create/update request
   * is still in flight.
   */
  private performSave(name: string): void {
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

  /**
   * Writes the current editor content straight to the open disk file handle
   * -- no dialog, no name prompt, exactly VS Code's Ctrl+S-on-an-open-file
   * behavior. Failures are surfaced via diskSaveError (rendered through
   * app-error-banner) rather than thrown, since this runs from a
   * HostListener/click handler with no caller to catch a rejection.
   */
  private performDiskSave(): void {
    const handle = this.openFileHandle();
    if (!handle) {
      return;
    }

    this.diskSaveError.set(null);
    void this.fileSystemAccessService
      .writeTextFile(handle, this.sourceCode())
      .then(() => this.savedSourceCode.set(this.sourceCode()))
      .catch((error: unknown) => {
        this.diskSaveError.set(error instanceof Error ? error.message : `Could not save "${this.documentName()}".`);
      });
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
    // Does not route through applyDocument (only sourceCode is touched
    // here), so openFileHandle needs its own explicit clear.
    this.openFileHandle.set(null);
    this.sourceCode.set(template.content);
  }

  /** Sets the shared selection to `panel`, or clears it if `panel` is already active -- see activeSidePanel's own doc comment. */
  toggleSidePanel(panel: 'explorer' | 'documents'): void {
    this.activeSidePanel.update((current) => (current === panel ? null : panel));
  }

  onExplorerPanelToggle(): void {
    this.toggleSidePanel('explorer');
  }

  onDocumentsPanelToggle(): void {
    this.toggleSidePanel('documents');
  }

  onDocumentOpenedFromPanel(document: DocumentSummary): void {
    this.activeSidePanel.set(null);

    // Always fetches directly (rather than routing through the Router,
    // whose default onSameUrlNavigation is 'ignore' and would otherwise
    // silently no-op when re-opening the document that is already active)
    // so "open" always reloads the real saved content from the server, and
    // updates the URL via Location rather than Router.navigate so this
    // can never race a resolver-driven re-fetch of possibly-stale data.
    this.documentsService.getById(document.id).subscribe((full) => this.applyDocument(full));
    this.location.go(`/editor/${document.id}`);
  }

  /**
   * Fired when a file row is clicked in the Explorer panel. Guarded behind
   * the same unsaved-changes confirm as onNewDocument/onTemplateSelected --
   * on confirm (or when there is nothing unsaved to lose), the disk file's
   * content fully replaces the editor's, this becomes a disk-backed
   * (non-SQLite) document, and the URL is reset to the bare '/editor' route
   * since a local disk file has no server-side document id to deep-link to.
   */
  onDiskFileOpened(file: OpenedDiskFile): void {
    if (this.hasUnsavedChanges() && !window.confirm('Discard unsaved changes and open this file?')) {
      return;
    }

    this.documentId.set(null);
    this.documentName.set(file.name);
    this.sourceCode.set(file.content);
    this.savedSourceCode.set(file.content);
    this.openFileHandle.set(file.handle);
    this.location.go('/editor');
    void this.hubService.render(file.content);
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
