import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { TemplatesService } from '../../../core/services/templates.service';
import { EditorToolbarComponent } from './editor-toolbar.component';

describe('EditorToolbarComponent', () => {
  let fixture: ComponentFixture<EditorToolbarComponent>;
  let component: EditorToolbarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorToolbarComponent],
      providers: [{ provide: TemplatesService, useValue: { list: jest.fn().mockReturnValue(of([])) } }],
    }).compileComponents();

    fixture = TestBed.createComponent(EditorToolbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function byTestId(testId: string): HTMLElement {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  it('renders all required toolbar controls', () => {
    expect(byTestId('editor-toolbar')).toBeTruthy();
    expect(byTestId('toolbar-new')).toBeTruthy();
    expect(byTestId('toolbar-save')).toBeTruthy();
    expect(byTestId('toolbar-upload')).toBeTruthy();
    expect(byTestId('toolbar-upload-input')).toBeTruthy();
    expect(byTestId('template-picker-toggle')).toBeTruthy();
    expect(byTestId('documents-panel-toggle')).toBeTruthy();
    expect(byTestId('connection-status')).toBeTruthy();
  });

  it('emits newDocument when New is clicked', () => {
    const spy = jest.fn();
    component.newDocument.subscribe(spy);

    byTestId('toolbar-new').click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emits save when Save is clicked', () => {
    const spy = jest.fn();
    component.save.subscribe(spy);

    byTestId('toolbar-save').click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emits documentsPanelToggle when the documents panel toggle is clicked', () => {
    const spy = jest.fn();
    component.documentsPanelToggle.subscribe(spy);

    byTestId('documents-panel-toggle').click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('clicking Upload delegates to the hidden file input', () => {
    const clickSpy = jest.spyOn(byTestId('toolbar-upload-input') as HTMLInputElement, 'click');

    byTestId('toolbar-upload').click();

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('emits fileSelected with the chosen file and resets the input', () => {
    const spy = jest.fn();
    component.fileSelected.subscribe(spy);

    const file = new File(['@startuml\n@enduml'], 'diagram.puml');
    const input = byTestId('toolbar-upload-input') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });

    input.dispatchEvent(new Event('change'));

    expect(spy).toHaveBeenCalledWith(file);
  });

  it('forwards connectionState down to the connection-status indicator', () => {
    component.connectionState = 'reconnecting';
    fixture.detectChanges();

    expect(byTestId('connection-status').textContent).toBe('reconnecting');
  });

  it('shows the Ctrl+S shortcut in the Save rail button tooltip', () => {
    const tooltip = byTestId('toolbar-save').querySelector('.rail-button__tooltip') as HTMLElement;

    expect(tooltip.textContent).toBe('Save (Ctrl+S)');
  });

  it('shows a plain, parenthetical-free label in the New rail button tooltip', () => {
    const tooltip = byTestId('toolbar-new').querySelector('.rail-button__tooltip') as HTMLElement;

    expect(tooltip.textContent).toBe('New');
  });
});
