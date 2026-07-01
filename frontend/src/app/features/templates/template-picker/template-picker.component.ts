import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { Template } from '../../../core/models/template.model';
import { TemplatesService } from '../../../core/services/templates.service';
import { RailButtonComponent } from '../../../shared/components/rail-button/rail-button.component';

/**
 * Fetches the template catalog once and lets the user pick a starter
 * template. Guarding against discarding unsaved editor content is left to
 * the consumer (editor-page owns the notion of "unsaved"), so this component
 * simply reports which template was picked.
 */
@Component({
  selector: 'app-template-picker',
  standalone: true,
  imports: [RailButtonComponent],
  templateUrl: './template-picker.component.html',
  styleUrl: './template-picker.component.scss',
})
export class TemplatePickerComponent {
  @Output() readonly templateSelected = new EventEmitter<Template>();

  private readonly templatesService = inject(TemplatesService);

  readonly templates = toSignal(this.templatesService.list(), { initialValue: [] as Template[] });
  readonly isOpen = signal(false);

  toggle(): void {
    this.isOpen.update((open) => !open);
  }

  select(template: Template): void {
    this.templateSelected.emit(template);
    this.isOpen.set(false);
  }
}
