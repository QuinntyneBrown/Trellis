import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import type * as Monaco from 'monaco-editor';

import { MonacoLoaderService } from '../../../core/services/monaco-loader.service';

/**
 * Thin wrapper around the raw `monaco-editor` package. Kept as a standalone
 * component (rather than a third-party Angular wrapper) so we have direct
 * access to editor.addCommand for a focus-scoped Ctrl+Enter binding, and so
 * the real Monaco JS only ever loads through MonacoLoaderService's lazily
 * injected script tag instead of the main application bundle.
 */
@Component({
  selector: 'app-monaco-editor',
  standalone: true,
  imports: [],
  templateUrl: './monaco-editor.component.html',
  styleUrl: './monaco-editor.component.scss',
})
export class MonacoEditorComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() value = '';
  /** Monaco language id ('plaintext' for PlantUML source, 'markdown' for markdown documents). */
  @Input() language = 'plaintext';
  @Output() readonly valueChange = new EventEmitter<string>();
  @Output() readonly renderRequested = new EventEmitter<string>();

  @ViewChild('editorContainer', { static: true })
  private readonly editorContainerRef!: ElementRef<HTMLDivElement>;

  private editorInstance: Monaco.editor.IStandaloneCodeEditor | null = null;
  /** Kept for setModelLanguage after language changes; null until load resolves. */
  private monacoNamespace: typeof Monaco | null = null;

  constructor(private readonly monacoLoader: MonacoLoaderService) {}

  ngAfterViewInit(): void {
    this.monacoLoader.load().then((monaco) => {
      this.monacoNamespace = monaco;
      this.editorInstance = monaco.editor.create(this.editorContainerRef.nativeElement, {
        value: this.value,
        // Reads the input at creation time, so a language set before the
        // async load resolves is picked up here without a separate call.
        language: this.language,
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
      });

      this.editorInstance.onDidChangeModelContent(() => {
        this.valueChange.emit(this.editorInstance!.getValue());
      });

      // Scoped to this editor instance's own focus -- never a document-level
      // listener -- and this also suppresses the default newline that a bare
      // Enter would otherwise insert.
      this.editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        this.renderRequested.emit(this.editorInstance!.getValue());
      });
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    const languageChange = changes['language'];
    if (languageChange && !languageChange.firstChange && this.editorInstance && this.monacoNamespace) {
      const model = this.editorInstance.getModel();
      if (model) {
        this.monacoNamespace.editor.setModelLanguage(model, languageChange.currentValue as string);
      }
    }

    const valueChange = changes['value'];
    if (!valueChange || valueChange.firstChange || !this.editorInstance) {
      return;
    }

    const incoming = valueChange.currentValue as string;
    if (incoming !== this.editorInstance.getValue()) {
      this.editorInstance.setValue(incoming);
    }
  }

  ngOnDestroy(): void {
    this.editorInstance?.dispose();
  }
}
