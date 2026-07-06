import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { RenderResult } from '../../../core/models/render-result.model';
import { ClipboardService } from '../../../core/services/clipboard.service';
import { FileDownloadService } from '../../../core/services/file-download.service';
import { ImageExportService } from '../../../core/services/image-export.service';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { TreeActionButtonComponent } from '../../../shared/components/tree-action-button/tree-action-button.component';
import { toPngFileName } from './png-file-name';

/**
 * Renders the outcome of the most recent render: SVG for PlantUML results,
 * prose HTML for markdown results -- the branch is picked purely from which
 * field the RenderResult carries. The data-render-seq counter increments
 * exactly once per completed render outcome (success or failure) so E2E
 * tests can assert "did the preview actually update" without diffing markup.
 *
 * Both branches inject via bypassSecurityTrustHtml: the SVG comes from the
 * server's PlantUML renderer, and the markdown HTML is safe by construction
 * server-side (raw HTML escaped, URLs scheme-checked -- see the backend's
 * MarkdigMarkdownRenderer).
 *
 * Successful SVG renders additionally get a hover-revealed action overlay
 * (copy the diagram to the clipboard as PNG / download it as a .png). The
 * PNG is rasterized client-side from the raw SVG string; failures are
 * emitted through `exportError` for the parent to surface in its toast.
 */
@Component({
  selector: 'app-diagram-preview',
  standalone: true,
  imports: [LoadingSpinnerComponent, TreeActionButtonComponent],
  templateUrl: './diagram-preview.component.html',
  styleUrl: './diagram-preview.component.scss',
})
export class DiagramPreviewComponent implements OnChanges {
  @Input() result: RenderResult | null = null;
  @Input() isRendering = false;
  /** Names the exported PNG file; the document identity stays parent-owned. */
  @Input() documentName = '';

  /** Copy/export failure message for the parent's error toast. */
  @Output() readonly exportError = new EventEmitter<string>();

  readonly renderSeq = signal(0);
  readonly safeSvg = signal<SafeHtml | null>(null);
  readonly safeMarkdownHtml = signal<SafeHtml | null>(null);
  /** Transient "copied!" confirmation: swaps the copy button's glyph to a checkmark. */
  readonly imageCopied = signal(false);

  private copiedResetTimer: number | undefined;

  constructor(
    private readonly sanitizer: DomSanitizer,
    private readonly clipboardService: ClipboardService,
    private readonly imageExportService: ImageExportService,
    private readonly fileDownloadService: FileDownloadService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    const resultChange = changes['result'];
    if (!resultChange) {
      return;
    }

    const current = resultChange.currentValue as RenderResult | null;
    const previous = resultChange.previousValue as RenderResult | null;
    if (current == null || current === previous) {
      return;
    }

    this.renderSeq.update((seq) => seq + 1);
    this.safeSvg.set(current.isSuccess && current.svg ? this.sanitizer.bypassSecurityTrustHtml(current.svg) : null);
    this.safeMarkdownHtml.set(
      current.isSuccess && current.html ? this.sanitizer.bypassSecurityTrustHtml(current.html) : null,
    );
  }

  onCopyImageClicked(): void {
    const svg = this.result?.svg;
    if (!svg) {
      return;
    }
    // The pending blob promise is handed to copyPng un-awaited so the
    // ClipboardItem is constructed synchronously within the click gesture
    // (Safari rejects clipboard writes prepared after an await).
    this.clipboardService
      .copyPng(this.imageExportService.svgToPngBlob(svg))
      .then(() => this.flashImageCopied())
      .catch(() => this.exportError.emit('Could not copy the diagram image to the clipboard.'));
  }

  async onDownloadImageClicked(): Promise<void> {
    const svg = this.result?.svg;
    if (!svg) {
      return;
    }
    try {
      const png = await this.imageExportService.svgToPngBlob(svg);
      this.fileDownloadService.downloadBlob(toPngFileName(this.documentName), png);
    } catch {
      this.exportError.emit('Could not export the diagram as a PNG.');
    }
  }

  private flashImageCopied(): void {
    window.clearTimeout(this.copiedResetTimer);
    this.imageCopied.set(true);
    this.copiedResetTimer = window.setTimeout(() => this.imageCopied.set(false), 1500);
  }
}
