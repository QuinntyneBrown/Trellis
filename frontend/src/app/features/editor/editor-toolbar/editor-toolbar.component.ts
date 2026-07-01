import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

import { HubConnectionState } from '../../../core/models/hub-connection-state.model';
import { Template } from '../../../core/models/template.model';
import { ConnectionStatusComponent } from '../../../shared/components/connection-status/connection-status.component';
import { TemplatePickerComponent } from '../../templates/template-picker/template-picker.component';

/**
 * Presentational toolbar: New/Save/Upload actions, the template picker, the
 * documents-panel toggle, and the connection status indicator. Emits events
 * up rather than owning document/document-hub state itself.
 */
@Component({
  selector: 'app-editor-toolbar',
  standalone: true,
  imports: [ConnectionStatusComponent, TemplatePickerComponent],
  templateUrl: './editor-toolbar.component.html',
  styleUrl: './editor-toolbar.component.scss',
})
export class EditorToolbarComponent {
  @Input() connectionState: HubConnectionState = 'disconnected';

  @Output() readonly newDocument = new EventEmitter<void>();
  @Output() readonly save = new EventEmitter<void>();
  @Output() readonly fileSelected = new EventEmitter<File>();
  @Output() readonly templateSelected = new EventEmitter<Template>();
  @Output() readonly documentsPanelToggle = new EventEmitter<void>();

  @ViewChild('fileInput') private readonly fileInputRef!: ElementRef<HTMLInputElement>;

  onNewClicked(): void {
    this.newDocument.emit();
  }

  onSaveClicked(): void {
    this.save.emit();
  }

  onUploadClicked(): void {
    this.fileInputRef.nativeElement.click();
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.fileSelected.emit(file);
    }
    input.value = '';
  }

  onTemplateSelected(template: Template): void {
    this.templateSelected.emit(template);
  }

  onDocumentsPanelToggleClicked(): void {
    this.documentsPanelToggle.emit();
  }
}
