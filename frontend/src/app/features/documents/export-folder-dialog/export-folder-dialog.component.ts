import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

/** Emitted by the export dialog's Export button. */
export interface ExportFolderDialogResult {
  /** Whether the export should also include documents marked as excluded. */
  includeExcluded: boolean;
}

/**
 * Modal confirming a folder markdown export, whose whole reason to exist is
 * the "include excluded documents" override checkbox. Purely presentational,
 * mirroring MoveDocumentDialogComponent: DocumentsPanelComponent owns the
 * open/close state and the actual export call.
 */
@Component({
  selector: 'app-export-folder-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './export-folder-dialog.component.html',
  styleUrl: './export-folder-dialog.component.scss',
})
export class ExportFolderDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() folderName = '';

  @Output() readonly confirm = new EventEmitter<ExportFolderDialogResult>();
  @Output() readonly cancel = new EventEmitter<void>();

  /** Re-seeded to unchecked on every open -- the override is a per-export choice, never sticky. */
  readonly includeExcluded = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.includeExcluded.set(false);
    }
  }

  onIncludeExcludedChange(value: boolean): void {
    this.includeExcluded.set(value);
  }

  onConfirmClicked(): void {
    this.confirm.emit({ includeExcluded: this.includeExcluded() });
  }

  onCancelClicked(): void {
    this.cancel.emit();
  }
}
