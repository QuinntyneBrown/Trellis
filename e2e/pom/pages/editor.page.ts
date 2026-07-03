import { Page, expect } from '@playwright/test';
import { BasePage } from '../base.page';
import { MonacoEditorComponent } from '../components/monaco-editor.component';
import { PreviewPaneComponent } from '../components/preview-pane.component';
import { EditorToolbarComponent } from '../components/editor-toolbar.component';
import { TemplatesPanelComponent } from '../components/templates-panel.component';
import { FileMenuComponent } from '../components/file-menu.component';
import { SaveDocumentDialogComponent } from '../components/save-document-dialog.component';
import { DocumentsPanelComponent } from '../components/documents-panel.component';
import { DividerComponent } from '../components/divider.component';
import { ExplorerPanelComponent } from '../components/explorer-panel.component';

/**
 * The single routed page of the Trellis app: the editor route at '/',
 * rooted at [data-testid="editor-page"].
 *
 * Trellis is, in effect, a one-page application with several
 * modal/overlay interaction surfaces (template picker, save dialog,
 * documents panel) layered on top of the same route, rather than
 * several distinct pages to navigate between. Modeling it as a single
 * flat EditorPage that owns navigation plus one readonly property per
 * component-level object (rather than a family of separate "Page"
 * classes) keeps the POM structure matched to the app's actual shape.
 */
export class EditorPage extends BasePage {
  readonly editor: MonacoEditorComponent;
  readonly preview: PreviewPaneComponent;
  readonly toolbar: EditorToolbarComponent;
  readonly templatesPanel: TemplatesPanelComponent;
  readonly fileMenu: FileMenuComponent;
  readonly saveDialog: SaveDocumentDialogComponent;
  readonly documentsPanel: DocumentsPanelComponent;
  readonly divider: DividerComponent;
  readonly explorerPanel: ExplorerPanelComponent;
  readonly sidePanelDivider: DividerComponent;

  constructor(page: Page) {
    super(page);
    this.editor = new MonacoEditorComponent(page);
    this.preview = new PreviewPaneComponent(page);
    this.toolbar = new EditorToolbarComponent(page);
    this.templatesPanel = new TemplatesPanelComponent(page);
    this.fileMenu = new FileMenuComponent(page);
    this.saveDialog = new SaveDocumentDialogComponent(page);
    this.documentsPanel = new DocumentsPanelComponent(page);
    this.divider = new DividerComponent(page, 'resize-divider');
    this.explorerPanel = new ExplorerPanelComponent(page);
    this.sidePanelDivider = new DividerComponent(page, 'pixel-resize-divider');
  }

  /** Navigates to the editor route and waits for it to mount. */
  async goto(): Promise<void> {
    await this.page.goto('/');
    await expect(this.byTestId('editor-page')).toBeVisible();
    await this.editor.waitForReady();
  }

  /**
   * Uploads a file by setting the hidden upload input directly
   * (data-testid="upload-input", owned by the editor page) rather than
   * driving a native OS picker, per Playwright best practice. `filePath`
   * must be an absolute path.
   */
  async uploadFile(filePath: string): Promise<void> {
    await this.byTestId('upload-input').setInputFiles(filePath);
  }
}
