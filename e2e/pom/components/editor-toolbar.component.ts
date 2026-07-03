import { Locator, Page } from '@playwright/test';
import { byTestId } from '../base.page';

/**
 * Component object for the activity rail at [data-testid="editor-toolbar"]:
 * the Explorer/Templates/Documents panel toggles and the connection status
 * indicator. The New/Save/Upload actions live in the title bar's File menu
 * (see FileMenuComponent) since D-012.
 */
export class EditorToolbarComponent {
  readonly root: Locator;

  readonly templatesPanelToggle: Locator;
  readonly documentsPanelToggle: Locator;
  readonly connectionStatus: Locator;

  constructor(page: Page) {
    this.root = byTestId(page, 'editor-toolbar');

    this.templatesPanelToggle = byTestId(page, 'templates-panel-toggle');
    this.documentsPanelToggle = byTestId(page, 'documents-panel-toggle');
    this.connectionStatus = byTestId(page, 'connection-status');
  }

  /** Opens the templates panel. */
  async openTemplatesPanel(): Promise<void> {
    await this.templatesPanelToggle.click();
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
   * e.g. `tooltipFor(this.documentsPanelToggle)`.
   */
  tooltipFor(railButton: Locator): Locator {
    return railButton.locator('.rail-button__tooltip');
  }
}
