import { Locator, Page } from '@playwright/test';
import { byTestId } from '../base.page';

/**
 * Component object for the editor toolbar at
 * [data-testid="editor-toolbar"]: New, Save, Upload, the template
 * picker toggle, the documents panel toggle, and the connection status
 * indicator.
 */
export class EditorToolbarComponent {
  readonly root: Locator;

  readonly newButton: Locator;
  readonly saveButton: Locator;
  readonly uploadButton: Locator;
  readonly uploadInput: Locator;
  readonly templatesPanelToggle: Locator;
  readonly documentsPanelToggle: Locator;
  readonly connectionStatus: Locator;

  constructor(page: Page) {
    this.root = byTestId(page, 'editor-toolbar');

    this.newButton = byTestId(page, 'toolbar-new');
    this.saveButton = byTestId(page, 'toolbar-save');
    this.uploadButton = byTestId(page, 'toolbar-upload');
    this.uploadInput = byTestId(page, 'toolbar-upload-input');
    this.templatesPanelToggle = byTestId(page, 'templates-panel-toggle');
    this.documentsPanelToggle = byTestId(page, 'documents-panel-toggle');
    this.connectionStatus = byTestId(page, 'connection-status');
  }

  /** Clicks New to start a fresh, blank document. */
  async clickNew(): Promise<void> {
    await this.newButton.click();
  }

  /**
   * Uploads a .puml file by setting the hidden file input directly
   * (data-testid="toolbar-upload-input") rather than driving a native
   * OS file picker dialog, per Playwright best practice for file
   * inputs. `filePath` must be an absolute path.
   */
  async uploadFile(filePath: string): Promise<void> {
    await this.uploadInput.setInputFiles(filePath);
  }

  /** Opens the template picker dropdown/panel. */
  async openTemplatesPanel(): Promise<void> {
    await this.templatesPanelToggle.click();
  }

  /** Opens the save dialog. */
  async openSaveDialog(): Promise<void> {
    await this.saveButton.click();
  }

  /** Opens the documents panel. */
  async openDocumentsPanel(): Promise<void> {
    await this.documentsPanelToggle.click();
  }

  /** Reads the current connection status text: 'connected' | 'disconnected' | 'reconnecting'. */
  async getConnectionStatus(): Promise<string> {
    return (await this.connectionStatus.textContent())?.trim() ?? '';
  }

  /**
   * Locates a rail button's tooltip span (RailButtonComponent's
   * `.rail-button__tooltip`), scoped within the given rail button locator,
   * e.g. `tooltipFor(this.saveButton)`.
   */
  tooltipFor(railButton: Locator): Locator {
    return railButton.locator('.rail-button__tooltip');
  }
}
