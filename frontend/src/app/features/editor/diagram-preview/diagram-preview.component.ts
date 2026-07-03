import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { RenderResult } from '../../../core/models/render-result.model';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

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
 */
@Component({
  selector: 'app-diagram-preview',
  standalone: true,
  imports: [LoadingSpinnerComponent],
  templateUrl: './diagram-preview.component.html',
  styleUrl: './diagram-preview.component.scss',
})
export class DiagramPreviewComponent implements OnChanges {
  @Input() result: RenderResult | null = null;
  @Input() isRendering = false;

  readonly renderSeq = signal(0);
  readonly safeSvg = signal<SafeHtml | null>(null);
  readonly safeMarkdownHtml = signal<SafeHtml | null>(null);

  constructor(private readonly sanitizer: DomSanitizer) {}

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
}
