import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { Template } from '../../../core/models/template.model';
import { TemplatesService } from '../../../core/services/templates.service';
import { TemplatePickerComponent } from './template-picker.component';

describe('TemplatePickerComponent', () => {
  let fixture: ComponentFixture<TemplatePickerComponent>;
  let component: TemplatePickerComponent;
  const templates: Template[] = [
    { key: 'c4-context', name: 'C4 - Context', category: 'C4', content: '@startuml\n@enduml' },
    { key: 'blank', name: 'Blank', category: 'General', content: '' },
  ];
  let templatesServiceMock: { list: jest.Mock };

  beforeEach(async () => {
    templatesServiceMock = { list: jest.fn().mockReturnValue(of(templates)) };

    await TestBed.configureTestingModule({
      imports: [TemplatePickerComponent],
      providers: [{ provide: TemplatesService, useValue: templatesServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(TemplatePickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the toggle button and keeps the panel closed by default', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="template-picker-toggle"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="template-picker"]')).toBeNull();
  });

  it('fetches the catalog once and opens the panel with an option per template', () => {
    expect(templatesServiceMock.list).toHaveBeenCalledTimes(1);

    (fixture.nativeElement.querySelector('[data-testid="template-picker-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="template-picker"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="template-option-c4-context"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="template-option-blank"]')).toBeTruthy();
  });

  it('emits templateSelected and closes the panel when an option is clicked', () => {
    const emitted: Template[] = [];
    component.templateSelected.subscribe((t) => emitted.push(t));

    component.toggle();
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector('[data-testid="template-option-c4-context"]') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(emitted).toEqual([templates[0]]);
    expect(fixture.nativeElement.querySelector('[data-testid="template-picker"]')).toBeNull();
  });
});
