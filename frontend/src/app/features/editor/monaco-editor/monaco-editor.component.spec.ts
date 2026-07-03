import { SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MonacoLoaderService } from '../../../core/services/monaco-loader.service';
import { MonacoEditorComponent } from './monaco-editor.component';

interface EditorStub {
  getValue: jest.Mock<string, []>;
  setValue: jest.Mock<void, [string]>;
  onDidChangeModelContent: jest.Mock;
  addCommand: jest.Mock;
  dispose: jest.Mock;
  getModel: jest.Mock;
}

describe('MonacoEditorComponent', () => {
  let fixture: ComponentFixture<MonacoEditorComponent>;
  let component: MonacoEditorComponent;
  let editorStub: EditorStub;
  let changeCallback: (() => void) | undefined;
  let commandCallback: (() => void) | undefined;
  let monacoLoaderStub: { load: jest.Mock };
  let currentValue: string;
  let createdWithLanguage: string | undefined;
  let setModelLanguageMock: jest.Mock;
  const fakeModel = { id: 'fake-model' };

  beforeEach(async () => {
    currentValue = '';
    changeCallback = undefined;
    commandCallback = undefined;

    editorStub = {
      getValue: jest.fn(() => currentValue),
      setValue: jest.fn((v: string) => {
        currentValue = v;
      }),
      onDidChangeModelContent: jest.fn((cb: () => void) => {
        changeCallback = cb;
      }),
      addCommand: jest.fn((_keybinding: number, cb: () => void) => {
        commandCallback = cb;
      }),
      dispose: jest.fn(),
      getModel: jest.fn(() => fakeModel),
    };

    const fakeMonaco = {
      editor: {
        create: jest.fn((_el: HTMLElement, options: { value: string; language: string }) => {
          currentValue = options.value;
          createdWithLanguage = options.language;
          return editorStub;
        }),
        setModelLanguage: jest.fn(),
      },
      KeyMod: { CtrlCmd: 2048 },
      KeyCode: { Enter: 3 },
    };

    setModelLanguageMock = fakeMonaco.editor.setModelLanguage;
    createdWithLanguage = undefined;
    monacoLoaderStub = { load: jest.fn().mockResolvedValue(fakeMonaco) };

    await TestBed.configureTestingModule({
      imports: [MonacoEditorComponent],
      providers: [{ provide: MonacoLoaderService, useValue: monacoLoaderStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(MonacoEditorComponent);
    component = fixture.componentInstance;
  });

  it('creates the editor with the language bound before the async load resolved', async () => {
    component.language = 'markdown';
    fixture.detectChanges();
    await fixture.whenStable();

    expect(createdWithLanguage).toBe('markdown');
  });

  it('switches the model language at runtime via setModelLanguage', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(createdWithLanguage).toBe('plaintext');

    component.language = 'markdown';
    component.ngOnChanges({ language: new SimpleChange('plaintext', 'markdown', false) });

    expect(setModelLanguageMock).toHaveBeenCalledWith(fakeModel, 'markdown');
  });

  it('renders the editor container carrying the monaco-editor testid', () => {
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="monaco-editor"]')).toBeTruthy();
  });

  it('loads monaco exactly once and creates the editor with the initial value', async () => {
    component.value = '@startuml\n@enduml';
    fixture.detectChanges();
    await fixture.whenStable();

    expect(monacoLoaderStub.load).toHaveBeenCalledTimes(1);
    expect(editorStub.getValue()).toBe('@startuml\n@enduml');
  });

  it('emits valueChange whenever the model content changes', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const emitted: string[] = [];
    component.valueChange.subscribe((v) => emitted.push(v));

    editorStub.getValue.mockReturnValue('new content');
    changeCallback?.();

    expect(emitted).toEqual(['new content']);
  });

  it('registers a Ctrl+Enter command scoped to this editor instance and emits renderRequested', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(editorStub.addCommand).toHaveBeenCalledTimes(1);
    const [keybinding] = editorStub.addCommand.mock.calls[0];
    expect(keybinding).toBe(2048 | 3);

    const emitted: string[] = [];
    component.renderRequested.subscribe((v) => emitted.push(v));

    editorStub.getValue.mockReturnValue('@startuml\nrender me\n@enduml');
    commandCallback?.();

    expect(emitted).toEqual(['@startuml\nrender me\n@enduml']);
  });

  it('pushes external value changes into the editor when they differ from current content', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    component.value = 'external update';
    component.ngOnChanges({ value: new SimpleChange('old', 'external update', false) });

    expect(editorStub.setValue).toHaveBeenCalledWith('external update');
  });

  it('does not call setValue when the incoming value already matches the editor (no feedback loop)', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    editorStub.getValue.mockReturnValue('already there');
    component.value = 'already there';
    component.ngOnChanges({ value: new SimpleChange('old', 'already there', false) });

    expect(editorStub.setValue).not.toHaveBeenCalled();
  });

  it('disposes the underlying editor instance on destroy', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.destroy();

    expect(editorStub.dispose).toHaveBeenCalledTimes(1);
  });
});
