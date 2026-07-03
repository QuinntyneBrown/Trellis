import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

import { HubConnectionState } from '../../../core/models/hub-connection-state.model';
import { ConnectionStatusComponent } from '../../../shared/components/connection-status/connection-status.component';
import { RailButtonComponent } from '../../../shared/components/rail-button/rail-button.component';

/**
 * Presentational toolbar: New/Save/Upload actions, the Explorer, Templates
 * and Documents panel toggles, and the connection status indicator. Emits
 * events up rather than owning document/document-hub state itself.
 */
@Component({
  selector: 'app-editor-toolbar',
  standalone: true,
  imports: [ConnectionStatusComponent, RailButtonComponent],
  templateUrl: './editor-toolbar.component.html',
  styleUrl: './editor-toolbar.component.scss',
})
export class EditorToolbarComponent {
  @Input() connectionState: HubConnectionState = 'disconnected';
  /** Gates the Explorer rail button entirely (hidden, not disabled) in browsers without the File System Access API. */
  @Input() explorerSupported = false;
  /** Which (if any) side panel is currently active -- drives the [active] state of the three panel-toggle rail buttons. */
  @Input() activeSidePanel: 'explorer' | 'documents' | 'templates' | null = null;

  @Output() readonly newDocument = new EventEmitter<void>();
  @Output() readonly save = new EventEmitter<void>();
  @Output() readonly fileSelected = new EventEmitter<File>();
  @Output() readonly explorerPanelToggle = new EventEmitter<void>();
  @Output() readonly documentsPanelToggle = new EventEmitter<void>();
  @Output() readonly templatesPanelToggle = new EventEmitter<void>();

  @ViewChild('fileInput') private readonly fileInputRef!: ElementRef<HTMLInputElement>;

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
}
