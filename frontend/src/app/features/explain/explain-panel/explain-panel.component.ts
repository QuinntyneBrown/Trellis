import { Component, EventEmitter, Output, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { ExplainFileEntry } from '../../../core/models/explain-file-entry.model';
import { ExplainPrompt } from '../../../core/models/explain-prompt.model';
import { ExplainService } from '../../../core/services/explain.service';
import { ClipboardService } from '../../../core/services/clipboard.service';
import { FileDownloadService } from '../../../core/services/file-download.service';
import { FileSystemAccessService } from '../../../core/services/file-system-access.service';
import { ExplainCollectionError, collectExplainFiles, isExplainableFile } from '../collect-explain-files';

/** How long the Copy button shows its transient "Copied!" confirmation. */
const COPIED_RESET_MS = 2000;

/**
 * The "Explain This" wizard -- the fourth exclusive side panel. Two-step
 * flow: pick a source (a local file or folder via the native File System
 * Access pickers -- the vscode.dev Ctrl+O idiom -- or a GitHub/GitLab URL),
 * then Confirm to generate the LLM "explain this" prompt. Local selections
 * are read in the browser and posted as path+content pairs; URLs are
 * fetched and aggregated entirely server-side.
 *
 * On success the compact prompt is emitted to the editor page (which loads it
 * as an unsaved markdown document, so the preview pane renders it). The result
 * actions copy that prompt and download the separately aggregated source-file
 * attachment for use together in any LLM/ollama chat.
 *
 * The three source choices are mutually exclusive: picking a file clears a
 * picked folder and vice versa, and typing a URL clears both -- the
 * Confirm button always acts on exactly one unambiguous selection.
 */
@Component({
  selector: 'app-explain-panel',
  standalone: true,
  templateUrl: './explain-panel.component.html',
  styleUrl: './explain-panel.component.scss',
})
export class ExplainPanelComponent {
  /** Fires when a prompt was generated; the editor page loads it as an unsaved markdown document. */
  @Output() readonly promptGenerated = new EventEmitter<ExplainPrompt>();

  private readonly explainService = inject(ExplainService);
  private readonly clipboardService = inject(ClipboardService);
  private readonly fileDownloadService = inject(FileDownloadService);
  private readonly fileSystemAccess = inject(FileSystemAccessService);

  /** Hides the native-picker buttons in browsers without the File System Access API (same gate as the Explorer). */
  readonly pickersSupported = this.fileSystemAccess.isSupported() && this.fileSystemAccess.isFilePickerSupported();

  readonly pickedFile = signal<FileSystemFileHandle | null>(null);
  readonly pickedFolder = signal<FileSystemDirectoryHandle | null>(null);
  readonly url = signal('');

  readonly isGenerating = signal(false);
  readonly error = signal<string | null>(null);
  readonly lastPrompt = signal<ExplainPrompt | null>(null);
  readonly copied = signal(false);

  private copiedResetHandle: ReturnType<typeof setTimeout> | null = null;

  /** Human-readable description of the pending selection, shown between the pickers and Confirm. */
  readonly selectionLabel = computed(() => {
    const file = this.pickedFile();
    if (file) {
      return `File: ${file.name}`;
    }
    const folder = this.pickedFolder();
    if (folder) {
      return `Folder: ${folder.name}`;
    }
    return null;
  });

  readonly canConfirm = computed(
    () =>
      !this.isGenerating() && (this.pickedFile() !== null || this.pickedFolder() !== null || this.url().trim() !== ''),
  );

  async onPickFileClicked(): Promise<void> {
    const handle = await this.fileSystemAccess.pickFile();
    if (handle === null) {
      return;
    }
    if (!isExplainableFile(handle.name)) {
      this.error.set(`"${handle.name}" is not a supported file type.`);
      return;
    }
    this.pickedFile.set(handle);
    this.pickedFolder.set(null);
    this.url.set('');
    this.error.set(null);
  }

  async onPickFolderClicked(): Promise<void> {
    const handle = await this.fileSystemAccess.pickDirectory('read');
    if (handle === null) {
      return;
    }
    this.pickedFolder.set(handle);
    this.pickedFile.set(null);
    this.url.set('');
    this.error.set(null);
  }

  onUrlInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.url.set(value);
    if (value.trim() !== '') {
      this.pickedFile.set(null);
      this.pickedFolder.set(null);
    }
  }

  async onConfirmClicked(): Promise<void> {
    if (!this.canConfirm()) {
      return;
    }

    this.isGenerating.set(true);
    this.error.set(null);

    try {
      const files = await this.readLocalSelection();
      const request =
        files === null
          ? this.explainService.aggregateUrl(this.url().trim())
          : this.explainService.aggregateFiles(files);

      request.subscribe({
        next: (prompt) => {
          this.isGenerating.set(false);
          this.lastPrompt.set(prompt);
          this.promptGenerated.emit(prompt);
        },
        error: (err: unknown) => {
          this.isGenerating.set(false);
          this.error.set(extractErrorMessage(err));
        },
      });
    } catch (err: unknown) {
      this.isGenerating.set(false);
      this.error.set(extractErrorMessage(err));
    }
  }

  /**
   * Reads a picked local file/folder into path+content entries, or returns
   * null when the selection is a URL (nothing to read client-side).
   */
  private async readLocalSelection(): Promise<ExplainFileEntry[] | null> {
    const file = this.pickedFile();
    if (file) {
      const contents = await file.getFile();
      return [{ path: file.name, content: await contents.text() }];
    }

    const folder = this.pickedFolder();
    if (folder) {
      return collectExplainFiles(folder);
    }

    return null;
  }

  onCopyPromptClicked(): void {
    const prompt = this.lastPrompt();
    if (!prompt) {
      return;
    }

    this.clipboardService
      .copyText(prompt.prompt)
      .then(() => {
        this.copied.set(true);
        if (this.copiedResetHandle !== null) {
          clearTimeout(this.copiedResetHandle);
        }
        this.copiedResetHandle = setTimeout(() => this.copied.set(false), COPIED_RESET_MS);
      })
      .catch((err: unknown) => this.error.set(extractErrorMessage(err)));
  }

  /** Downloads only the aggregated source blocks; the prompt names this file for the LLM. */
  onDownloadAttachmentClicked(): void {
    const prompt = this.lastPrompt();
    if (!prompt) {
      return;
    }

    this.fileDownloadService.downloadTextFile(prompt.attachmentFileName, prompt.attachmentContent);
  }
}

/**
 * Prefers the ProblemDetails title the backend puts on 400s (bad URL, no
 * matching files, oversized selection), falling back to generic messages.
 */
function extractErrorMessage(err: unknown): string {
  if (err instanceof ExplainCollectionError) {
    return err.message;
  }
  if (err instanceof HttpErrorResponse) {
    const problem = err.error as { title?: unknown } | null;
    if (problem && typeof problem.title === 'string' && problem.title.trim() !== '') {
      return problem.title;
    }
    return 'Generating the prompt failed. Check the server is running and try again.';
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return 'Something went wrong generating the prompt.';
}
