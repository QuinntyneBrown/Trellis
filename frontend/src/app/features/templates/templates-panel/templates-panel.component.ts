import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';

import { DocumentKind } from '../../../core/models/document-kind.model';
import { TemplateSummary } from '../../../core/models/template-summary.model';
import { TemplatesService } from '../../../core/services/templates.service';
import { TreeActionButtonComponent } from '../../../shared/components/tree-action-button/tree-action-button.component';

/**
 * Slide-out panel for browsing and managing editor templates -- the third
 * exclusive side panel alongside the Explorer and Documents panels. Replaces
 * the old pop-out template picker: templates are now ordinary CRUD rows (the
 * six built-in starters are migration-seeded and just as editable), and the
 * panel stays open when a template is applied.
 *
 * Deliberately a single flat component: no folders, so none of the Documents
 * panel's recursive-node/drag-drop/reveal machinery -- only its
 * open-transition refresh and stale-response-token idioms carry over.
 *
 * The EDITOR is the content source for mutations: creating a template
 * captures the current editor buffer and kind (via the editorContent /
 * editorKind inputs), and "Update from editor" overwrites a template with
 * them after a confirm. Row actions use the app-wide native
 * window.prompt/window.confirm conventions.
 */
@Component({
  selector: 'app-templates-panel',
  standalone: true,
  imports: [TreeActionButtonComponent],
  templateUrl: './templates-panel.component.html',
  styleUrl: './templates-panel.component.scss',
})
export class TemplatesPanelComponent implements OnChanges {
  @Input() open = false;
  /** The editor's current buffer -- the content captured by New Template / Update from editor. */
  @Input() editorContent = '';
  /** The editor's current kind -- captured alongside the content. */
  @Input() editorKind: DocumentKind = 'plantuml';

  /** Fires when a template row (or its Apply action) is chosen; the editor page fetches the full content. */
  @Output() readonly templateApplied = new EventEmitter<TemplateSummary>();

  private readonly templatesService = inject(TemplatesService);

  /** Monotonically increasing token so a slow earlier refresh can never clobber a newer one's state. */
  private refreshSequence = 0;

  readonly templates = signal<TemplateSummary[]>([]);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      this.refresh();
    }
  }

  refresh(): void {
    const refreshToken = ++this.refreshSequence;

    this.templatesService.list().subscribe((templates) => {
      if (refreshToken !== this.refreshSequence) {
        return;
      }

      this.templates.set(
        [...templates].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
      );
    });
  }

  onApplyRowClicked(template: TemplateSummary): void {
    this.templateApplied.emit(template);
  }

  /** event.stopPropagation() runs first so the button click never also triggers the row's own (click). */
  onApplyClicked(event: MouseEvent, template: TemplateSummary): void {
    event.stopPropagation();
    this.templateApplied.emit(template);
  }

  /** The header's New Template captures the current editor content and kind under a prompted name. */
  onNewTemplateClicked(): void {
    const name = window.prompt('New template name')?.trim();
    if (name) {
      this.templatesService
        .create({ name, content: this.editorContent, kind: this.editorKind })
        .subscribe(() => this.refresh());
    }
  }

  /** Overwrites the template's content (and kind) with the current editor buffer, after a confirm. */
  onUpdateFromEditorClicked(event: MouseEvent, template: TemplateSummary): void {
    event.stopPropagation();
    if (window.confirm(`Overwrite "${template.name}" with the current editor content?`)) {
      this.templatesService
        .update(template.id, { name: template.name, content: this.editorContent, kind: this.editorKind })
        .subscribe(() => this.refresh());
    }
  }

  /** Seeds the prompt with the current name; a blank or unchanged answer is a no-op. */
  onRenameClicked(event: MouseEvent, template: TemplateSummary): void {
    event.stopPropagation();
    const newName = window.prompt('Rename template', template.name)?.trim();
    if (newName && newName !== template.name) {
      this.templatesService.rename(template.id, newName).subscribe(() => this.refresh());
    }
  }

  onDeleteClicked(event: MouseEvent, template: TemplateSummary): void {
    event.stopPropagation();
    if (window.confirm(`Delete "${template.name}"? This cannot be undone.`)) {
      this.templatesService.delete(template.id).subscribe(() => this.refresh());
    }
  }
}
