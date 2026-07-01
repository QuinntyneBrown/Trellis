import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

/** Modal prompting for a document name before it is created/updated. */
@Component({
  selector: 'app-save-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './save-dialog.component.html',
  styleUrl: './save-dialog.component.scss',
})
export class SaveDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() initialName = '';

  @Output() readonly confirm = new EventEmitter<string>();
  @Output() readonly cancel = new EventEmitter<void>();

  readonly name = signal('');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.name.set(this.initialName);
    }
  }

  onNameInput(value: string): void {
    this.name.set(value);
  }

  onConfirmClicked(): void {
    const trimmed = this.name().trim();
    if (trimmed) {
      this.confirm.emit(trimmed);
    }
  }

  onCancelClicked(): void {
    this.cancel.emit();
  }
}
