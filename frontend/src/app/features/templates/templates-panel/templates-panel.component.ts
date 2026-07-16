import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';

import { DocumentKind } from '../../../core/models/document-kind.model';
import { TemplateSummary } from '../../../core/models/template-summary.model';
import { TemplatesService } from '../../../core/services/templates.service';
import { TreeActionButtonComponent } from '../../../shared/components/tree-action-button/tree-action-button.component';
import { TreeContextMenuComponent } from '../../../shared/components/tree-context-menu/tree-context-menu.component';
import {
  TreeContextMenuItem,
  TreeContextMenuRequest,
} from '../../../shared/components/tree-context-menu/tree-context-menu.model';

/**
 * Slide-out panel for browsing and managing editor templates -- the third
 * exclusive side panel alongside the Explorer and Documents panels. Replaces
 * the old pop-out template picker: templates are now ordinary CRUD rows (the
 * six built-in starters are migration-seeded and just as editable), and the
 * panel stays open when a template is applied.
 *
 * Deliberately a single flat component: no folders, so none of the Documents
 * panel's recursive-node/drag-drop/reveal machinery -- only its
 * open-transition refresh, stale-response-token, and context-menu idioms
 * carry over.
 *
 * The EDITOR is the content source for mutations: creating a template
 * captures the current editor buffer and kind (via the editorContent /
 * editorKind inputs), and "Update from editor" overwrites a template with
 * them after a confirm. Like the Documents panel, rows carry no inline
 * action icons: clicking a row applies it, and everything else lives in the
 * right-click context menu (a background right-click offers New Template
 * from Editor). Mutations use the app-wide native window.prompt /
 * window.confirm conventions.
 */
@Component({
  selector: 'app-templates-panel',
  standalone: true,
  imports: [TreeActionButtonComponent, TreeContextMenuComponent],
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

  /** A null target means the list background was right-clicked (create surface), mirroring the Documents panel. */
  readonly contextMenuRequest = signal<TreeContextMenuRequest<TemplateSummary | null> | null>(null);

  // A computed, not a getter: the menu's [items] binding needs a stable
  // array reference for the lifetime of one open. A getter would mint a new
  // array on every change-detection pass, which the menu's ngOnChanges sees
  // as a fresh change each tick -- the feedback loop that used to wedge the
  // tab (see TreeContextMenuComponent.ngOnChanges).
  readonly contextMenuItems = computed<TreeContextMenuItem[]>(() => {
    const request = this.contextMenuRequest();
    if (!request) {
      return [];
    }
    if (!request.target) {
      return [{ id: 'new-template', label: 'New Template from Editor' }];
    }
    return [
      { id: 'apply', label: 'Apply to Editor' },
      { id: 'update', label: 'Update from Editor' },
      { id: 'rename', label: 'Rename' },
      { id: 'delete', label: 'Delete', separatorBefore: true, danger: true },
    ];
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      this.refresh();
    } else if (changes['open']?.currentValue === false) {
      // The panel markup lives behind @if (open) -- drop a stale request so
      // the menu can't reappear targeting old data on the next open.
      this.closeContextMenu(false);
    }
  }

  refresh(): void {
    this.closeContextMenu(false);
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

  /** The header's New Template captures the current editor content and kind under a prompted name. */
  onNewTemplateClicked(): void {
    this.createTemplateFromEditor();
  }

  onRowContextMenu(event: MouseEvent, template: TemplateSummary): void {
    event.preventDefault();
    // Never bubble to the list container's own (contextmenu) -- that would
    // replace this row-targeted request with a background one.
    event.stopPropagation();
    this.contextMenuRequest.set({
      target: template,
      clientX: event.clientX,
      clientY: event.clientY,
      triggerElement: event.currentTarget as HTMLElement,
    });
  }

  onListContextMenu(event: MouseEvent): void {
    event.preventDefault();
    this.contextMenuRequest.set({
      target: null,
      clientX: event.clientX,
      clientY: event.clientY,
      triggerElement: event.currentTarget as HTMLElement,
    });
  }

  /** Same keyboard affordances as the Explorer/Documents rows: menu keys open the row menu, Enter/Space activate (apply). */
  onRowKeydown(event: KeyboardEvent, template: TemplateSummary): void {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      event.stopPropagation();
      const trigger = event.currentTarget as HTMLElement;
      const rect = trigger.getBoundingClientRect();
      this.contextMenuRequest.set({
        target: template,
        clientX: rect.left + 24,
        clientY: rect.bottom,
        triggerElement: trigger,
      });
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      this.templateApplied.emit(template);
    }
  }

  onListKeydown(event: KeyboardEvent): void {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      const trigger = event.currentTarget as HTMLElement;
      const rect = trigger.getBoundingClientRect();
      this.contextMenuRequest.set({ target: null, clientX: rect.left + 24, clientY: rect.top + 24, triggerElement: trigger });
    }
  }

  onContextMenuCommand(command: string): void {
    const request = this.contextMenuRequest();
    if (!request) {
      return;
    }
    const template = request.target;
    // A selected command takes over focus itself (a prompt/confirm dialog or
    // the editor). Restoring focus while its menu button is still handling
    // the click can leave browser automation -- and some assistive
    // technology -- attached to a removed control. Escape remains the path
    // that deliberately returns focus to the originating row.
    this.closeContextMenu(false);

    switch (command) {
      case 'new-template':
        this.createTemplateFromEditor();
        break;
      case 'apply':
        if (template) {
          this.templateApplied.emit(template);
        }
        break;
      case 'update':
        if (template) {
          this.updateTemplateFromEditor(template);
        }
        break;
      case 'rename':
        if (template) {
          this.renameTemplate(template);
        }
        break;
      case 'delete':
        if (template) {
          this.deleteTemplate(template);
        }
        break;
    }
  }

  closeContextMenu(restoreFocus: boolean): void {
    const trigger = this.contextMenuRequest()?.triggerElement;
    this.contextMenuRequest.set(null);
    if (restoreFocus) {
      trigger?.focus();
    }
  }

  private createTemplateFromEditor(): void {
    const name = window.prompt('New template name')?.trim();
    if (name) {
      this.templatesService
        .create({ name, content: this.editorContent, kind: this.editorKind })
        .subscribe(() => this.refresh());
    }
  }

  /** Overwrites the template's content (and kind) with the current editor buffer, after a confirm. */
  private updateTemplateFromEditor(template: TemplateSummary): void {
    if (window.confirm(`Overwrite "${template.name}" with the current editor content?`)) {
      this.templatesService
        .update(template.id, { name: template.name, content: this.editorContent, kind: this.editorKind })
        .subscribe(() => this.refresh());
    }
  }

  /** Seeds the prompt with the current name; a blank or unchanged answer is a no-op. */
  private renameTemplate(template: TemplateSummary): void {
    const newName = window.prompt('Rename template', template.name)?.trim();
    if (newName && newName !== template.name) {
      this.templatesService.rename(template.id, newName).subscribe(() => this.refresh());
    }
  }

  private deleteTemplate(template: TemplateSummary): void {
    if (window.confirm(`Delete "${template.name}"? This cannot be undone.`)) {
      this.templatesService.delete(template.id).subscribe(() => this.refresh());
    }
  }
}
