import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { Document } from '../../../core/models/document.model';
import { DocumentKind, inferDocumentKindFromFileName } from '../../../core/models/document-kind.model';
import { DocumentSummary } from '../../../core/models/document-summary.model';
import { ExplainPrompt } from '../../../core/models/explain-prompt.model';
import { OpenedDiskFile } from '../../../core/models/opened-disk-file.model';
import { TemplateSummary } from '../../../core/models/template-summary.model';
import { Folder } from '../../../core/models/folder.model';
import { ClipboardService } from '../../../core/services/clipboard.service';
import { DiagramHubService } from '../../../core/services/diagram-hub.service';
import { DocumentsService } from '../../../core/services/documents.service';
import { EditorLayoutPreferencesService } from '../../../core/services/editor-layout-preferences.service';
import { FileSystemAccessService } from '../../../core/services/file-system-access.service';
import { FoldersService } from '../../../core/services/folders.service';
import { TemplatesService } from '../../../core/services/templates.service';
import { ErrorBannerComponent } from '../../../shared/components/error-banner/error-banner.component';
import { DocumentsPanelComponent } from '../../documents/documents-panel/documents-panel.component';
import { ExplainPanelComponent } from '../../explain/explain-panel/explain-panel.component';
import { ExplorerPanelComponent } from '../../explorer/explorer-panel/explorer-panel.component';
import { TemplatesPanelComponent } from '../../templates/templates-panel/templates-panel.component';
import { DiagramPreviewComponent } from '../diagram-preview/diagram-preview.component';
import {
  DEFAULT_EDITOR_PANE_RATIO,
  EDITOR_PANE_RATIO_KEYBOARD_STEP,
  MAX_EDITOR_PANE_RATIO,
  MIN_EDITOR_PANE_RATIO,
} from '../editor-pane-ratio.constants';
import { EditorToolbarComponent } from '../editor-toolbar/editor-toolbar.component';
import { MonacoEditorComponent } from '../monaco-editor/monaco-editor.component';
import { NewDocumentDialogComponent, NewDocumentDialogResult } from '../new-document-dialog/new-document-dialog.component';
import { ResizeDividerComponent } from '../resize-divider/resize-divider.component';
import { clamp } from '../resize-divider/clamp';
import { SaveDialogComponent } from '../save-dialog/save-dialog.component';
import { TitleBarComponent } from '../title-bar/title-bar.component';
import {
  DEFAULT_SIDE_PANEL_WIDTH_PX,
  MAX_SIDE_PANEL_WIDTH_PX,
  MIN_SIDE_PANEL_WIDTH_PX,
  SIDE_PANEL_WIDTH_KEYBOARD_STEP_PX,
} from '../side-panel-width.constants';

const BLANK_DOCUMENT_NAME = 'Untitled diagram';

/** Which (if either) of the exclusive side panels is currently showing. */
export type SidePanel = 'explorer' | 'documents' | 'templates' | 'explain' | null;

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
    TitleBarComponent,
    DiagramPreviewComponent,
    ResizeDividerComponent,
    SaveDialogComponent,
    NewDocumentDialogComponent,
    DocumentsPanelComponent,
    ExplorerPanelComponent,
    TemplatesPanelComponent,
    ExplainPanelComponent,
    ErrorBannerComponent,
  ],
  templateUrl: './editor-page.component.html',
  styleUrl: './editor-page.component.scss',
})
export class EditorPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly documentsService = inject(DocumentsService);
  private readonly foldersService = inject(FoldersService);
  private readonly templatesService = inject(TemplatesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly layoutPreferences = inject(EditorLayoutPreferencesService);
  private readonly fileSystemAccessService = inject(FileSystemAccessService);
  private readonly clipboardService = inject(ClipboardService);
  readonly hubService = inject(DiagramHubService);

  // Exposed as fields (rather than referenced as free module-level constants)
  // because the template binds them onto the two <app-resize-divider>
  // instances, and Angular templates can only bind to members of the
  // component instance.
  readonly MIN_EDITOR_PANE_RATIO = MIN_EDITOR_PANE_RATIO;
  readonly MAX_EDITOR_PANE_RATIO = MAX_EDITOR_PANE_RATIO;
  readonly DEFAULT_EDITOR_PANE_RATIO = DEFAULT_EDITOR_PANE_RATIO;
  readonly EDITOR_PANE_RATIO_KEYBOARD_STEP = EDITOR_PANE_RATIO_KEYBOARD_STEP;
  readonly MIN_SIDE_PANEL_WIDTH_PX = MIN_SIDE_PANEL_WIDTH_PX;
  readonly MAX_SIDE_PANEL_WIDTH_PX = MAX_SIDE_PANEL_WIDTH_PX;
  readonly DEFAULT_SIDE_PANEL_WIDTH_PX = DEFAULT_SIDE_PANEL_WIDTH_PX;
  readonly SIDE_PANEL_WIDTH_KEYBOARD_STEP_PX = SIDE_PANEL_WIDTH_KEYBOARD_STEP_PX;

  readonly documentId = signal<string | null>(null);
  readonly documentName = signal<string>(BLANK_DOCUMENT_NAME);
  /**
   * What the editor's content is (PlantUML or markdown) -- drives the render
   * pipeline, the Monaco language, and the save dialog's Type default.
   * Adopted from the loaded document / disk file / upload; templates and new
   * documents reset it to plantuml.
   */
  readonly documentKind = signal<DocumentKind>('plantuml');
  readonly sourceCode = signal<string>('');
  /** The last-saved (or last-loaded) content, used to detect unsaved edits. */
  readonly savedSourceCode = signal<string>('');

  readonly isSaveDialogOpen = signal(false);
  /**
   * Which flavor the open save dialog is: 'save' names a first-time save
   * (updates thereafter), 'saveAs' (Ctrl+Shift+S) ALWAYS creates a new
   * document -- so its dialog always offers the destination-folder select,
   * and confirming never overwrites the currently open document.
   */
  readonly saveDialogMode = signal<'save' | 'saveAs'>('save');
  /**
   * The folder list handed to the save dialog's destination select --
   * re-fetched every time the dialog opens so just-created folders always
   * appear. A fetch failure degrades to an empty list (the dialog stays
   * usable with "(No folder)") rather than blocking the save.
   */
  readonly saveDialogFolders = signal<Folder[]>([]);

  readonly isNewDocumentDialogOpen = signal(false);
  /** Folder list for the new-document dialog's destination select -- fetched the same way as saveDialogFolders. */
  readonly newDocumentFolders = signal<Folder[]>([]);
  /** Bumped after each successful "create another" -- see NewDocumentDialogComponent's clearNameToken input. */
  readonly newDocumentClearNameToken = signal(0);
  /**
   * The most recently created document during the current new-document
   * dialog session (reset to null on open). Adopted into the editor once
   * the dialog closes -- either right after a single create, or after a
   * "create another" streak ends -- so the editor only ever navigates once
   * per dialog session rather than on every intermediate create.
   */
  private lastCreatedInSession: Document | null = null;

  /** Computed once -- the browser either has the File System Access API or it doesn't, for the whole session. */
  readonly explorerSupported = this.fileSystemAccessService.isSupported();

  /**
   * The single shared selection behind both the Explorer and Documents rail
   * icons: setting one value always replaces whatever was there (giving
   * exclusivity for free -- opening one panel always closes the other), and
   * toggleSidePanel's use of .update() gives the VS-Code-real
   * click-the-active-icon-to-collapse behavior for free too.
   *
   * Seeded from persisted preferences like the pane sizes, so the open
   * panel survives a browser refresh (D-005). A stored 'explorer' choice is
   * dropped when the browser lacks the File System Access API -- the icon
   * wouldn't even render, so restoring that panel would strand the user.
   */
  readonly activeSidePanel = signal<SidePanel>(this.restoreSidePanel());

  /** Set when the currently-open document/content came from a local disk file rather than the SQLite backend. */
  readonly openFileHandle = signal<FileSystemFileHandle | null>(null);

  /** The hidden file input behind File > Upload and Ctrl+U. */
  @ViewChild('uploadInput') private readonly uploadInputRef!: ElementRef<HTMLInputElement>;
  /** Surfaced through the app-error-banner toast when a save/upload/open/load request fails. */
  readonly saveError = signal<string | null>(null);

  /** Transient "copied!" confirmation for the title bar's copy-contents button. */
  readonly documentCopied = signal(false);
  private documentCopiedResetTimer: number | undefined;

  // Seeded from persisted preferences: the preferences service is dumb
  // storage (stored number or null), so the default and the product-level
  // min/max bounds are applied here.
  readonly editorPaneRatio = signal(
    clamp(
      this.layoutPreferences.getEditorPaneRatio() ?? DEFAULT_EDITOR_PANE_RATIO,
      MIN_EDITOR_PANE_RATIO,
      MAX_EDITOR_PANE_RATIO,
    ),
  );
  readonly editorPaneRatioPercent = computed(() => this.editorPaneRatio() * 100);

  // Seeded the same way, but pixel-native (no percent conversion needed --
  // the side panel's width is bound directly in px, not as a flex-basis
  // percentage of its container).
  readonly sidePanelWidthPx = signal(
    clamp(
      this.layoutPreferences.getSidePanelWidthPx() ?? DEFAULT_SIDE_PANEL_WIDTH_PX,
      MIN_SIDE_PANEL_WIDTH_PX,
      MAX_SIDE_PANEL_WIDTH_PX,
    ),
  );

  /** Monotonically increasing token identifying the most recent upload; see onFileSelected. */
  private uploadSequence = 0;

  /** Same token pattern for the save dialog's folder fetch: only the most recent open's response is applied. */
  private folderFetchSequence = 0;

  readonly hasUnsavedChanges = computed(
    () => this.sourceCode().trim().length > 0 && this.sourceCode() !== this.savedSourceCode(),
  );

  ngOnInit(): void {
    // The documentId in the URL is the single source of truth for which
    // SQLite-backed document is open: this component fetches it directly
    // (there is no route resolver or custom route-reuse machinery). In-app
    // URL updates go through location.go, which deliberately does not
    // re-emit paramMap -- those flows already hold the loaded document.
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const documentId = params.get('documentId');
          if (!documentId) {
            return of(null);
          }

          return this.documentsService.getById(documentId).pipe(
            catchError((error: unknown) => {
              if (error instanceof HttpErrorResponse && error.status === 404) {
                // A stale or mistyped deep link: fall back to a blank editor.
                this.location.go('/editor');
              } else {
                this.saveError.set('Could not load the requested document.');
              }
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((document) => this.applyDocument(document));
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
      this.documentKind.set(document.kind ?? 'plantuml');
      this.sourceCode.set(document.content);
      this.savedSourceCode.set(document.content);
      // Loading a document's real, saved content is expected to update the
      // preview to match it immediately, rather than leaving the preview
      // showing whatever was rendered previously (or the placeholder).
      void this.hubService.render(document.content, this.documentKind());
    } else {
      this.documentId.set(null);
      this.documentName.set(BLANK_DOCUMENT_NAME);
      this.documentKind.set('plantuml');
      this.sourceCode.set('');
      this.savedSourceCode.set('');
    }
  }

  // Live drag/nudge updates bind straight to the signals in the template and
  // deliberately do NOT persist -- a drag can fire dozens of times per
  // second, and calling localStorage.setItem that often would be wasteful.
  // Only the two resizeEnd handlers below (fired exactly once per completed
  // gesture) persist the chosen value.

  onDividerResizeEnd(ratio: number): void {
    this.editorPaneRatio.set(ratio);
    this.layoutPreferences.setEditorPaneRatio(ratio);
  }

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
    this.openNewDocumentDialog();
  }

  private openNewDocumentDialog(): void {
    this.lastCreatedInSession = null;
    this.saveError.set(null);
    this.isNewDocumentDialogOpen.set(true);
    this.loadFolders((folders) => this.newDocumentFolders.set(folders));
  }

  /**
   * Persists a blank document. While createAnother is checked, a successful
   * create just clears the dialog's name field (via newDocumentClearNameToken)
   * and leaves the editor untouched -- the editor only adopts the newly
   * created document once the dialog actually closes (see
   * onCloseNewDocumentDialog), so back-to-back creates never yank focus away
   * from the dialog.
   */
  onCreateNewDocument(result: NewDocumentDialogResult): void {
    this.saveError.set(null);

    this.documentsService
      .create({ name: result.name, content: '', folderId: result.folderId, kind: result.kind })
      .subscribe({
        next: (saved) => {
          this.lastCreatedInSession = saved;
          if (result.createAnother) {
            this.newDocumentClearNameToken.update((token) => token + 1);
            return;
          }
          this.isNewDocumentDialogOpen.set(false);
          this.applyDocument(saved);
          this.location.go(`/editor/${saved.id}`);
        },
        error: () => this.saveError.set(`Could not create "${result.name}".`),
      });
  }

  /**
   * Closing (Close button or backdrop click): if at least one document was
   * created this session, the editor adopts the LAST one made -- otherwise
   * this is a pure no-op, since the editor is already showing the blank
   * document onNewDocument put it in before the dialog ever opened.
   */
  onCloseNewDocumentDialog(): void {
    this.isNewDocumentDialogOpen.set(false);
    if (this.lastCreatedInSession) {
      this.applyDocument(this.lastCreatedInSession);
      this.location.go(`/editor/${this.lastCreatedInSession.id}`);
    }
  }

  onSaveClicked(): void {
    if (this.openFileHandle()) {
      this.performDiskSave();
      return;
    }

    this.openSaveDialog('save');
  }

  /**
   * "Save As" (Ctrl+Shift+S): always the dialog, always a new document.
   * Deliberately no disk-save shortcut here -- from a disk-backed file this
   * imports the content into the document library as a fresh document.
   */
  onSaveAsClicked(): void {
    this.openSaveDialog('saveAs');
  }

  /** Title bar copy button: puts the raw editor source on the clipboard. */
  onCopyDocumentContents(): void {
    this.clipboardService
      .copyText(this.sourceCode())
      .then(() => {
        window.clearTimeout(this.documentCopiedResetTimer);
        this.documentCopied.set(true);
        this.documentCopiedResetTimer = window.setTimeout(() => this.documentCopied.set(false), 1500);
      })
      .catch(() => this.saveError.set('Could not copy the document contents to the clipboard.'));
  }

  private openSaveDialog(mode: 'save' | 'saveAs'): void {
    this.saveDialogMode.set(mode);

    // Opened immediately (not gated on the folder fetch) so a slow or failing
    // folders request can never delay or block saving.
    this.isSaveDialogOpen.set(true);
    this.loadFolders((folders) => this.saveDialogFolders.set(folders));
  }

  /**
   * Shared by both the save dialog and the new-document dialog's destination
   * select: fetches the folder list, applying it via `apply` only if this is
   * still the most recent fetch -- the token guards against a slow earlier
   * open's response arriving after (and clobbering) a more recent one. A
   * fetch failure degrades to an empty list rather than blocking either
   * dialog.
   */
  private loadFolders(apply: (folders: Folder[]) => void): void {
    const fetchToken = ++this.folderFetchSequence;
    this.foldersService.list().subscribe({
      next: (folders) => {
        if (fetchToken === this.folderFetchSequence) {
          apply(folders);
        }
      },
      error: () => {
        if (fetchToken === this.folderFetchSequence) {
          apply([]);
        }
      },
    });
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
   *
   * Listens on document (not the component host): focus routinely lands on
   * <body> after a click removes its target from the DOM (e.g. picking a
   * template closes the picker), and the save shortcuts must keep working
   * from there -- host-scoped keydown would silently miss them.
   */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    const primary = event.ctrlKey || event.metaKey;

    // Alt+N = New. Deliberately NOT Ctrl+N: browsers reserve it at the
    // browser level (new window) and never deliver it to the page, so the
    // shortcut the File menu advertises must be one that actually works.
    if (event.altKey && !primary && key === 'n') {
      event.preventDefault();
      this.onNewDocument();
      return;
    }

    // Ctrl/Cmd+U = Upload (view-source is interceptable, unlike Ctrl+N).
    if (primary && !event.shiftKey && !event.altKey && key === 'u') {
      event.preventDefault();
      this.onUploadRequested();
      return;
    }

    if (!primary || key !== 's') {
      return;
    }

    event.preventDefault();

    // Ctrl/Cmd+Shift+S = Save As: always the dialog (name + destination
    // folder), always a new document -- checked before every quick-save
    // branch below so it can never silently overwrite the open document
    // (or write to the open disk file). No unsaved-changes gate either:
    // Save As of an unmodified document is a deliberate "save a copy".
    if (event.shiftKey) {
      if (!this.isSaveDialogOpen()) {
        this.onSaveAsClicked();
      }
      return;
    }

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
   * Shared by the save dialog's confirm and the Ctrl/Cmd+S quick-save: the
   * dialog is not closed until the request actually succeeds -- closing
   * optimistically here would let a caller (or a test) observe "dialog is
   * hidden" as a false signal that the save has landed, while the request is
   * still in flight. On failure the dialog (if open) stays open and the
   * error toast reports the failure.
   *
   * folderId only matters on the create path (the dialog's destination
   * select): updates structurally cannot move a document, so quick-saves of
   * an existing document keep its folder without having to know it.
   */
  performSave(name: string, folderId: string | null = null, kind: DocumentKind | null = null): void {
    this.saveError.set(null);

    // Save As structurally ignores the current id: it always creates,
    // which is exactly what makes it safe to invoke over an open document.
    const id = this.saveDialogMode() === 'saveAs' ? null : this.documentId();

    const request$ = id
      ? this.documentsService.update(id, { name, content: this.sourceCode() })
      : this.documentsService.create({ name, content: this.sourceCode(), folderId, kind: kind ?? this.documentKind() });

    request$.subscribe({
      next: (saved) => {
        this.closeSaveDialog();
        this.documentName.set(saved.name);
        this.savedSourceCode.set(saved.content);
        if (!id) {
          this.documentId.set(saved.id);
          this.documentKind.set(saved.kind ?? 'plantuml');
          // A Save As from a disk-backed file imports the content into the
          // library: the editor now points at the new database document, so
          // whatever disk handle was open no longer applies.
          this.openFileHandle.set(null);
          // Reflects the newly created document's id in the URL (for
          // deep-linking/refresh) without routing through the Router - we
          // already have the authoritative saved document in hand, so a
          // re-fetch would add nothing and would race any content change
          // already in flight (see onFileSelected).
          this.location.go(`/editor/${saved.id}`);
        }
      },
      error: () => this.saveError.set(`Could not save "${name}".`),
    });
  }

  /**
   * Closing always resets the mode to plain 'save': the mode only means
   * anything while its dialog is open, and a stale 'saveAs' would otherwise
   * make a later Ctrl+S quick-save create a duplicate instead of updating.
   */
  closeSaveDialog(): void {
    this.isSaveDialogOpen.set(false);
    this.saveDialogMode.set('save');
  }

  /**
   * Writes the current editor content straight to the open disk file handle
   * -- no dialog, no name prompt, exactly VS Code's Ctrl+S-on-an-open-file
   * behavior. Failures are surfaced via saveError (rendered through
   * app-error-banner) rather than thrown, since this runs from a
   * HostListener/click handler with no caller to catch a rejection.
   */
  private performDiskSave(): void {
    const handle = this.openFileHandle();
    if (!handle) {
      return;
    }

    this.saveError.set(null);
    void this.fileSystemAccessService
      .writeTextFile(handle, this.sourceCode())
      .then(() => this.savedSourceCode.set(this.sourceCode()))
      .catch((error: unknown) => {
        this.saveError.set(error instanceof Error ? error.message : `Could not save "${this.documentName()}".`);
      });
  }

  /** File > Upload / Ctrl+U: opens the native file picker via the hidden input. */
  onUploadRequested(): void {
    this.uploadInputRef.nativeElement.click();
  }

  onUploadInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.onFileSelected(file);
    }
    // Reset so choosing the same file again still fires a change event.
    input.value = '';
  }

  onFileSelected(file: File): void {
    // Guards against a slow *previous* upload's response arriving after a
    // faster, more recent one and clobbering its result: only the response
    // (or failure) matching the most recently initiated upload is applied.
    const uploadToken = ++this.uploadSequence;

    this.saveError.set(null);

    this.documentsService.upload(file, this.documentId() ?? undefined).subscribe({
      next: (saved) => {
        if (uploadToken !== this.uploadSequence) {
          return;
        }
        this.applyDocument(saved);
        this.location.go(`/editor/${saved.id}`);
      },
      error: () => {
        if (uploadToken === this.uploadSequence) {
          this.saveError.set(`Could not upload "${file.name}".`);
        }
      },
    });
  }

  /**
   * Applies a template chosen in the Templates panel. The discard confirm
   * runs BEFORE the fetch so the dialog stays synchronous with the click;
   * only then is the full template (content + kind) loaded by id -- the
   * panel's list rows deliberately carry no content.
   */
  onTemplateApplied(summary: TemplateSummary): void {
    if (this.hasUnsavedChanges() && !window.confirm('Discard unsaved changes and load this template?')) {
      return;
    }

    this.templatesService.getById(summary.id).subscribe({
      next: (template) => {
        // Does not route through applyDocument (no document identity is
        // involved), so openFileHandle and the kind need explicit handling.
        this.openFileHandle.set(null);
        this.documentKind.set(template.kind);
        this.sourceCode.set(template.content);
      },
      error: () => this.saveError.set(`Could not apply "${summary.name}".`),
    });
  }

  /**
   * Loads a generated "Explain This" prompt as an unsaved markdown document
   * (the template-apply idiom: no document identity, savedSourceCode
   * untouched so the buffer counts as unsaved and the normal save flow can
   * persist it). The preview pane renders the prompt's markdown through the
   * existing hub pipeline.
   */
  onExplainPromptGenerated(result: ExplainPrompt): void {
    if (this.hasUnsavedChanges() && !window.confirm('Discard unsaved changes and load the generated prompt?')) {
      return;
    }

    this.documentId.set(null);
    this.documentName.set('Explain This');
    this.documentKind.set('markdown');
    this.sourceCode.set(result.prompt);
    this.openFileHandle.set(null);
    this.location.go('/editor');
    void this.hubService.render(result.prompt, 'markdown');
  }

  /**
   * The panel the title bar's sidebar toggle reopens after a close --
   * whichever was open most recently, the way VS Code's own toggle restores
   * the last-used sidebar view. Falls back to 'documents' when nothing has
   * been opened yet this session ('explorer' additionally requires the File
   * System Access API).
   */
  private lastOpenSidePanel: 'explorer' | 'documents' | 'templates' | 'explain' | null = this.activeSidePanel();

  /**
   * Sets the shared selection to `panel`, or clears it if `panel` is already
   * active -- see activeSidePanel's own doc comment. The result is persisted
   * (including an explicit null for a deliberate close) so the layout comes
   * back identically after a refresh.
   */
  toggleSidePanel(panel: 'explorer' | 'documents' | 'templates' | 'explain'): void {
    this.activeSidePanel.update((current) => (current === panel ? null : panel));
    const active = this.activeSidePanel();
    if (active) {
      this.lastOpenSidePanel = active;
    }
    this.layoutPreferences.setActiveSidePanel(active);
  }

  /** The title bar's primary-sidebar toggle: close whatever is open, or reopen the last-used panel. */
  onTitleBarSidebarToggle(): void {
    const current = this.activeSidePanel();
    if (current) {
      this.toggleSidePanel(current);
      return;
    }

    let target = this.lastOpenSidePanel ?? 'documents';
    if (target === 'explorer' && !this.explorerSupported) {
      target = 'documents';
    }
    this.toggleSidePanel(target);
  }

  /** Seeds activeSidePanel from persisted preferences -- see its doc comment. */
  private restoreSidePanel(): SidePanel {
    const stored = this.layoutPreferences.getActiveSidePanel();
    if (stored === 'explorer' && !this.explorerSupported) {
      return null;
    }
    return stored;
  }

  /**
   * The panel deliberately stays open on open (VS Code explorer idiom): the
   * editor sits beside it, and the panel highlights the now-active row via
   * the activeDocumentId binding, so the user keeps their place in the tree.
   */
  onDocumentOpenedFromPanel(document: DocumentSummary): void {
    this.saveError.set(null);

    // Always fetches directly (rather than routing through the Router,
    // whose default onSameUrlNavigation is 'ignore' and would otherwise
    // silently no-op when re-opening the document that is already active)
    // so "open" always reloads the real saved content from the server. The
    // URL is only rewritten once the document has actually arrived -- a
    // failed open must not leave it pointing at a document that never
    // loaded.
    this.documentsService.getById(document.id).subscribe({
      next: (full) => {
        this.applyDocument(full);
        this.location.go(`/editor/${document.id}`);
      },
      error: () => this.saveError.set(`Could not open "${document.name}".`),
    });
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

    const kind = inferDocumentKindFromFileName(file.name);

    this.documentId.set(null);
    this.documentName.set(file.name);
    this.documentKind.set(kind);
    this.sourceCode.set(file.content);
    this.savedSourceCode.set(file.content);
    this.openFileHandle.set(file.handle);
    this.location.go('/editor');
    void this.hubService.render(file.content, kind);
  }

  /**
   * Fired when a file is deleted from the Explorer panel. Only resets the
   * editor when the deleted handle is the one currently open -- deleting
   * some other, unrelated file must not disturb the editor's current
   * content. Unlike onDiskFileOpened, there is no confirm here: the user
   * already confirmed the delete itself inside FileTreeNodeComponent.
   * Mirrors onNewDocument's reset shape, minus the discard-guard.
   *
   * Compares via FileSystemHandle.isSameEntry() rather than `===`:
   * FileSystemFileHandle objects are NOT reference-stable across separate
   * directory reads -- every ExplorerPanelComponent.loadChildren() call
   * (e.g. from creating a sibling entry, or any other refresh of the same
   * parent directory) hands back brand-new handle objects for entries that
   * are, on disk, unchanged. A same-instance `===` check would silently
   * stop matching the very next time the open file's parent directory got
   * reloaded for any reason, leaving the editor showing stale content
   * against a handle for a file that no longer exists. isSameEntry() is the
   * File System Access API's own, identity-correct comparison for exactly
   * this situation.
   */
  async onDiskFileDeleted(handle: FileSystemFileHandle): Promise<void> {
    const openHandle = this.openFileHandle();
    if (openHandle && (await openHandle.isSameEntry(handle))) {
      this.applyDocument(null);
      this.location.go('/editor');
    }
  }
}
