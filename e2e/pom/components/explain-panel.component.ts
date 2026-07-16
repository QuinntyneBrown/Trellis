import { Locator, Page, expect } from '@playwright/test';
import { byTestId } from '../base.page';

/**
 * Component object for the "Explain This" side panel: toggle at
 * [data-testid="explain-panel-toggle"] (owned by the toolbar), panel root
 * at [data-testid="explain-panel"], native picker buttons, a repository
 * URL input, the Confirm button, and (after a successful generation) the
 * result block with its copy-to-clipboard button.
 *
 * The panel element itself is always mounted inside the editor page (its
 * host is display-toggled), so visibility assertions -- not existence
 * assertions -- are the meaningful ones here.
 */
export class ExplainPanelComponent {
  readonly root: Locator;
  readonly toggle: Locator;
  readonly pickFileButton: Locator;
  readonly pickFolderButton: Locator;
  readonly urlInput: Locator;
  readonly confirmButton: Locator;
  readonly selection: Locator;
  readonly error: Locator;
  readonly result: Locator;
  readonly copyPromptButton: Locator;

  constructor(page: Page) {
    this.root = byTestId(page, 'explain-panel');
    this.toggle = byTestId(page, 'explain-panel-toggle');
    this.pickFileButton = byTestId(page, 'explain-pick-file');
    this.pickFolderButton = byTestId(page, 'explain-pick-folder');
    this.urlInput = byTestId(page, 'explain-url-input');
    this.confirmButton = byTestId(page, 'explain-confirm');
    this.selection = byTestId(page, 'explain-selection');
    this.error = byTestId(page, 'explain-error');
    this.result = byTestId(page, 'explain-result');
    this.copyPromptButton = byTestId(page, 'explain-copy-prompt');
  }

  /** Opens the Explain This panel via its toolbar toggle. */
  async open(): Promise<void> {
    await this.toggle.click();
    await expect(this.root).toBeVisible();
  }
}
